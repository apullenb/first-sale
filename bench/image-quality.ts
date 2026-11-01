import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ImageEditResult, ImageModel, ModelProvider } from "@/lib/ai";
import { writeConcepts } from "@/lib/brand/concepts";
import {
  type AssetStore,
  type BatchResult,
  type ConceptRef,
  drawConcepts,
  editPicture,
  type LogoRef,
  makeBrandImages,
  makeVersions,
  type NewBrandAsset,
  refineLogo,
} from "@/lib/brand/generate";
import { imageStyle } from "@/lib/brand/image-style";
import { EXAMPLE_IMAGE } from "@/lib/brand/slots";
import { logoPrompt } from "@/lib/brand/prompts";
import { applyDesign } from "@/lib/brand/refine";
import { sizeFor } from "@/lib/brand/sizes";
import { writeStory } from "@/lib/brand/story";
import { suggestTaglines } from "@/lib/brand/tagline";
import { type AssetCheck, type AssetKind, type BrandBrief, type BrandImageKind, CODE_MODEL, IMAGE_KINDS, VERSION_KINDS } from "@/lib/brand/types";
import { checkPhoto } from "@/lib/photos/check";
import { makePhotoVersion, type NewPhotoVersion, type VersionStore } from "@/lib/photos/edit";
import { imageInfo } from "@/lib/photos/image-info";
import { MAX_CHANGE, ownerText } from "@/lib/photos/instructions";
import { CROPS } from "@/lib/photos/looks";
import type { PhotoCheck, PhotoReview } from "@/lib/photos/types";
import type { Budget } from "./budget";
import type { ImageScenario } from "./image-scenarios";
import { productPhoto } from "./images";
import type { Prices } from "./pricing";
import type { CallRecord } from "./recorder";

// Image-quality run: every kind of picture the app makes, through the app's own functions, saved to disk
// with what produced it and the app's own checks, for a person to judge.

export interface PictureEntry {
  scenario: string;
  // File name without extension; sorts in the order the owner meets them
  step: string;
  title: string;
  // The app function that made it
  via: string;
  status: "made" | "failed" | "skipped";
  reason: string | null;
  // Relative to the run folder
  file: string | null;
  kind: string;
  prompt: string | null;
  model: string;
  simulated: boolean;
  // Logo versions and edits: built in code from the logo's pixels, or drawn by the image model
  built: "code" | "model" | null;
  // Shape asked for, "WxH"
  requested: string | null;
  width: number | null;
  height: number | null;
  ms: number | null;
  // The image call only; checks are in the totals
  costUsd: number | null;
  check: string;
  checkDetail: AssetCheck | PhotoCheck | PhotoReview | null;
}

export interface ScenarioResult {
  id: string;
  label: string;
  story: string;
  concepts: { title: string; kind: string }[];
  taglines: string[];
  pictures: PictureEntry[];
  // Text steps that failed or were skipped
  notes: string[];
}

export interface ImageRunContext {
  model: ModelProvider;
  image: ImageModel;
  prices: Prices;
  budget: Budget | null;
  now: Date;
  // The run folder; pictures go under images/<scenario>/
  dir: string;
}

const IMAGE_TIMEOUT_MS = 180_000;
const BUDGET = "Budget reached";

const describe = (error: unknown) => (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).replace(/\s+/g, " ").slice(0, 300);

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

interface ImageCall {
  ms: number;
  ok: boolean;
  error: string | null;
}

// Times each image call by its prompt, so a picture finished out of order still gets its own time
export function trackImages(inner: ImageModel) {
  const calls = new Map<string, ImageCall[]>();
  const run = async (prompt: string, call: () => Promise<ImageEditResult>) => {
    const started = Date.now();
    const entry: ImageCall = { ms: 0, ok: false, error: null };
    calls.set(prompt, [...(calls.get(prompt) ?? []), entry]);
    try {
      const result = await call();
      entry.ok = true;
      return result;
    } catch (error) {
      entry.error = describe(error);
      throw error;
    } finally {
      entry.ms = Date.now() - started;
    }
  };
  const generate = inner.generate;
  const image: ImageModel = {
    name: inner.name,
    model: inner.model,
    simulated: inner.simulated,
    edit: (request) => run(request.instruction, () => inner.edit(request)),
    generate: generate ? (request) => run(request.prompt, () => generate.call(inner, request)) : undefined,
  };
  return { image, take: (prompt: string): ImageCall | null => calls.get(prompt)?.shift() ?? null };
}

interface KeptAsset extends NewBrandAsset {
  id: string;
  check: AssetCheck | null;
}

// Like the app's store, but in memory and keeping the bytes
function keepingAssets() {
  const files: KeptAsset[] = [];
  const store: AssetStore = {
    findByRequest: async (key) => files.find((file) => file.requestKey === key)?.id ?? null,
    room: async () => "ok",
    add: async (asset) => {
      const id = `asset-${files.length + 1}`;
      files.push({ ...asset, id, check: null });
      return { ok: true, id };
    },
    setCheck: async (id, check) => {
      const file = files.find((each) => each.id === id);
      if (file) file.check = check;
    },
  };
  return { files, store };
}

function keepingVersions() {
  const kept: { version: NewPhotoVersion | null; review: PhotoReview | null } = { version: null, review: null };
  const store: VersionStore = {
    findByRequest: async () => null,
    room: async () => "ok",
    add: async (version) => {
      kept.version = version;
      return { ok: true, id: "version-1" };
    },
    setReview: async (_id, review) => {
      kept.review = review;
    },
  };
  return { kept, store };
}

export function assetCheckSummary(check: AssetCheck | null): string {
  if (!check) return "Not checked";
  if (check.method === "skipped") return "Skipped (practice mode, or the model can't see)";
  if (check.method === "code") return `Built in code, nothing redrawn: ${check.layout?.note ?? ""}`.trim();
  if (check.method === "failed") return "The check itself failed";
  const parts: string[] = check.layout?.built === "model" ? [check.layout.note] : [];
  if (check.lettering) {
    const read = check.lettering.read.length ? ` (read “${check.lettering.read.join(" / ")}”)` : "";
    parts.push(`Lettering: ${check.lettering.status}${read}`);
    parts.push(...check.lettering.problems);
  }
  parts.push(check.drift.length ? `Differs from logo: ${check.drift.map((flag) => `${flag.kind}: ${flag.detail}`).join("; ")}` : "No differences flagged");
  return parts.map((part) => part.replace(/\.$/, "")).join(". ");
}

export function photoCheckSummary(check: PhotoCheck | null): string {
  if (!check) return "Not checked";
  if (check.method === "skipped") return "Skipped (the model can't see photos); scenario's category used";
  const problems = check.problems.map((problem) => `${problem.kind}: ${problem.detail}`).join("; ");
  return [`Usable: ${check.usable ? "yes" : "no"}`, `category ${check.category}`, check.summary, problems && `problems: ${problems}`, check.question && `asked: ${check.question}`]
    .filter(Boolean)
    .join(". ");
}

export function reviewSummary(review: PhotoReview | null): string {
  if (!review) return "Not checked";
  if (review.method === "skipped") return "Skipped (practice mode, or the model can't see)";
  if (review.method === "failed") return "The comparison itself failed";
  return review.flags.length ? `Flags: ${review.flags.map((flag) => `${flag.kind}: ${flag.detail}`).join("; ")}` : "No differences flagged";
}

export async function runScenario(ctx: ImageRunContext, scenario: ImageScenario): Promise<ScenarioResult> {
  const tracked = trackImages(ctx.image);
  const models = { image: tracked.image, vision: ctx.model };
  const { files, store } = keepingAssets();
  const result: ScenarioResult = { id: scenario.id, label: scenario.label, story: "", concepts: [], taglines: [], pictures: [], notes: [] };
  const folder = path.join("images", scenario.id);
  mkdirSync(path.join(ctx.dir, folder), { recursive: true });
  const stopped = () => ctx.budget?.stopped ?? false;

  const base = (step: string, title: string, via: string, kind: string) => ({
    scenario: scenario.id,
    step,
    title,
    via,
    kind,
    model: ctx.image.model,
    simulated: ctx.image.simulated,
    built: null as PictureEntry["built"],
    requested: kind === "photo" ? null : sizeFor(kind as AssetKind),
  });
  const missing = (step: string, title: string, via: string, kind: string, status: "failed" | "skipped", reason: string, prompt: string | null = null) => {
    const call = prompt ? tracked.take(prompt) : null;
    result.pictures.push({
      ...base(step, title, via, kind),
      status,
      reason: call?.error ?? reason,
      file: null,
      prompt,
      width: null,
      height: null,
      ms: call?.ms ?? null,
      costUsd: null,
      check: "",
      checkDetail: null,
    });
  };
  const save = (
    step: string,
    title: string,
    via: string,
    kind: string,
    picture: { mimeType: string; data: Uint8Array; width: number; height: number; prompt: string },
    check: { summary: string; detail: PictureEntry["checkDetail"] },
    extra: Partial<PictureEntry> = {},
  ) => {
    const file = path.join(folder, `${step}.${EXTENSIONS[picture.mimeType] ?? "bin"}`);
    writeFileSync(path.join(ctx.dir, file), picture.data);
    const call = tracked.take(picture.prompt);
    const entry: PictureEntry = {
      ...base(step, title, via, kind),
      status: "made",
      reason: null,
      file,
      prompt: picture.prompt,
      width: picture.width,
      height: picture.height,
      ms: call?.ms ?? null,
      costUsd: call?.ok ? ctx.prices.imagePerPicture : null,
      check: check.summary,
      checkDetail: check.detail,
      ...extra,
    };
    writeFileSync(path.join(ctx.dir, folder, `${step}.json`), `${JSON.stringify(entry, null, 2)}\n`);
    result.pictures.push(entry);
  };
  const saveAsset = (step: string, title: string, via: string, asset: KeptAsset) =>
    save(step, title, via, asset.kind, asset, { summary: assetCheckSummary(asset.check), detail: asset.check }, {
      model: asset.model,
      simulated: asset.simulated,
      built: asset.check?.layout?.built ?? (asset.model === CODE_MODEL ? "code" : null),
    });
  const text = async <T>(name: string, fallback: T, call: () => Promise<T>): Promise<T> => {
    if (stopped()) {
      result.notes.push(`${name}: skipped, ${BUDGET.toLowerCase()}`);
      return fallback;
    }
    try {
      return await call();
    } catch (error) {
      result.notes.push(`${name}: ${describe(error)}`);
      return fallback;
    }
  };

  // Brand description, approved as written
  const start: BrandBrief = { ...scenario.brief, story: "", storyByOwner: false, storyApproved: false };
  result.story = await text("Brand description", "", () => writeStory(ctx.model, start));
  const brief: BrandBrief = { ...start, story: result.story, storyApproved: Boolean(result.story) };

  const concepts = await text("Logo ideas", [], () => writeConcepts(ctx.model, { brief, basedOn: null }));
  result.concepts = concepts.map((concept) => ({ title: concept.title, kind: concept.kind }));
  const refs: ConceptRef[] = concepts.map((concept, index) => ({ id: `${scenario.id}-idea-${index + 1}`, concept, brief }));

  // Every idea is drawn, as the logo page does after writing a round
  if (refs.length) {
    const drawn = stopped() ? null : await drawConcepts(models, store, { concepts: refs, now: ctx.now }).catch((error) => describe(error));
    refs.forEach((ref, index) => {
      const step = `01-logo-idea-${index + 1}`;
      const title = `Logo idea ${index + 1}: ${ref.concept.title} (${ref.concept.kind})`;
      const asset = files.find((file) => file.kind === "logo" && file.conceptId === ref.id);
      if (asset) saveAsset(step, title, "drawConcepts", asset);
      else if (drawn === null) missing(step, title, "drawConcepts", "logo", "skipped", BUDGET);
      else missing(step, title, "drawConcepts", "logo", "failed", typeof drawn === "string" ? drawn : (drawn.failed ?? "No picture came back"), logoPrompt(ref.brief, ref.concept));
    });
  }

  // The first idea that came back is chosen
  const chosen = refs.map((ref) => ({ ref, asset: files.find((file) => file.kind === "logo" && file.conceptId === ref.id) })).find((each) => each.asset);
  const logo: LogoRef | null = chosen?.asset
    ? { id: chosen.ref.id, ...applyDesign(chosen.ref.concept, brief, null), logoId: chosen.asset.id, logo: { mimeType: chosen.asset.mimeType, data: chosen.asset.data }, design: null }
    : null;
  const noLogo = "No logo came back to build on";

  // Versions of the chosen logo
  const versionTitle = { stacked: "Stacked version", profile: "Icon (profile picture)", solid: "One-color version" } as const;
  if (!logo) VERSION_KINDS.forEach((kind) => missing(`02-version-${kind}`, versionTitle[kind], "makeVersions", kind, "skipped", noLogo));
  else {
    const made = stopped() ? null : await makeVersions(models, store, { logo, kinds: [...VERSION_KINDS], requestKey: "versions", now: ctx.now }).catch((error) => describe(error));
    for (const kind of VERSION_KINDS) {
      // A flagged first try is kept beside the retry the app shows
      const [first, retry] = files.filter((file) => file.kind === kind);
      if (retry) saveAsset(`02-version-${kind}-first-try`, `${versionTitle[kind]}, first try (flagged, so the app tried once more)`, "makeVersions", first);
      const asset = retry ?? first;
      if (asset) saveAsset(`02-version-${kind}`, versionTitle[kind], "makeVersions", asset);
      else missing(`02-version-${kind}`, versionTitle[kind], "makeVersions", kind, made === null ? "skipped" : "failed", made === null ? BUDGET : typeof made === "string" ? made : (made.failed ?? "No picture came back"));
    }
  }

  // A change to the logo in the owner's words
  const change = ownerText(scenario.logoChange, MAX_CHANGE);
  const editTitle = `Logo edit: “${change}”`;
  if (!logo) missing("03-logo-edit", editTitle, "refineLogo", "logo", "skipped", noLogo);
  else if (stopped()) missing("03-logo-edit", editTitle, "refineLogo", "logo", "skipped", BUDGET);
  else {
    try {
      const id = await refineLogo(models, store, { logo, change, requestKey: "logo-edit", now: ctx.now });
      saveAsset("03-logo-edit", editTitle, "refineLogo", files.find((file) => file.id === id)!);
    } catch (error) {
      missing("03-logo-edit", editTitle, "refineLogo", "logo", "failed", describe(error));
    }
  }

  result.taglines = await text("Taglines", [], () => suggestTaglines(ctx.model, brief));

  // Brand images, as the app makes them: the example first, approved by the owner, then the rest matching it
  // Photo or illustration, as the app's rule decides from the brief the images are made from
  const medium = imageStyle(logo?.brief ?? brief).medium;
  const imageTitle = (kind: string) => `Brand image: ${kind.replace(/_/g, " ")}, ${medium}${kind === EXAMPLE_IMAGE ? " (the example, approved before the rest)" : ""}`;
  const rest = IMAGE_KINDS.filter((kind) => kind !== EXAMPLE_IMAGE);
  const report = (kinds: readonly BrandImageKind[], made: BatchResult | string | null, missingReason?: string) => {
    for (const kind of kinds) {
      const asset = files.find((file) => file.kind === kind && file.change === null);
      if (asset) saveAsset(`04-image-${kind}`, imageTitle(kind), "makeBrandImages", asset);
      else missing(`04-image-${kind}`, imageTitle(kind), "makeBrandImages", kind, made === null ? "skipped" : "failed", missingReason ?? (made === null ? BUDGET : typeof made === "string" ? made : (made.failed ?? "No picture came back")));
    }
  };
  if (!logo) report(IMAGE_KINDS, null, noLogo);
  else {
    const first = stopped() ? null : await makeBrandImages(models, store, { logo, kinds: [EXAMPLE_IMAGE], change: null, requestKey: "images", now: ctx.now }).catch((error) => describe(error));
    report([EXAMPLE_IMAGE], first);
    const example = files.find((file) => file.kind === EXAMPLE_IMAGE);
    if (!example) report(rest, null, `No ${EXAMPLE_IMAGE} came back to approve, and the others wait for it`);
    else {
      const made = stopped()
        ? null
        : await makeBrandImages(models, store, { logo, kinds: rest, change: null, example: { mimeType: example.mimeType, data: example.data }, requestKey: "images", now: ctx.now }).catch((error) =>
            describe(error),
          );
      report(rest, made);
    }
  }

  // One brand image changed in the owner's words
  const { kind: editKind } = scenario.imageEdit;
  const pictureChange = ownerText(scenario.imageEdit.change, MAX_CHANGE);
  const pictureStep = `05-image-edit-${editKind}`;
  const pictureTitle = `${imageTitle(editKind)}, edited: “${pictureChange}”`;
  const source = files.find((file) => file.kind === editKind);
  if (!logo || !source) missing(pictureStep, pictureTitle, "editPicture", editKind, "skipped", logo ? `No ${editKind} came back to edit` : noLogo);
  else if (stopped()) missing(pictureStep, pictureTitle, "editPicture", editKind, "skipped", BUDGET);
  else {
    try {
      const id = await editPicture(models, store, {
        logo,
        picture: { kind: editKind, file: { mimeType: source.mimeType, data: source.data } },
        change: pictureChange,
        requestKey: "image-edit",
        now: ctx.now,
      });
      saveAsset(pictureStep, pictureTitle, "editPicture", files.find((file) => file.id === id)!);
    } catch (error) {
      missing(pictureStep, pictureTitle, "editPicture", editKind, "failed", describe(error));
    }
  }

  await photoSteps(ctx, scenario, tracked, { save, missing, stopped });
  return result;
}

interface PhotoHelpers {
  save: (
    step: string,
    title: string,
    via: string,
    kind: string,
    picture: { mimeType: string; data: Uint8Array; width: number; height: number; prompt: string },
    check: { summary: string; detail: PictureEntry["checkDetail"] },
    extra?: Partial<PictureEntry>,
  ) => void;
  missing: (step: string, title: string, via: string, kind: string, status: "failed" | "skipped", reason: string, prompt?: string | null) => void;
  stopped: () => boolean;
}

// A test photo, then one edit of it through the photo page's code
async function photoSteps(ctx: ImageRunContext, scenario: ImageScenario, tracked: ReturnType<typeof trackImages>, { save, missing, stopped }: PhotoHelpers) {
  const { photo } = scenario;
  const editTitle = `Product photo edit (${photo.look}, ${photo.crop})`;
  let original: { mimeType: string; data: Uint8Array; width: number; height: number; prompt: string } | null = null;
  // Practice mode can't draw a photo, so a jar is drawn in code
  const generate = tracked.image.generate;
  if (ctx.image.simulated || !generate) {
    const drawn = productPhoto(photo.label, photo.jarColor);
    original = { ...drawn, prompt: `Drawn in code: a jar labeled ${photo.label}` };
  } else if (stopped()) {
    missing("06-photo-original", "Test photo (made by the bench)", "image.generate", "photo", "skipped", BUDGET);
  } else {
    try {
      const made = await generate({ prompt: photo.prompt, size: CROPS[photo.crop].size, format: "png", timeoutMs: IMAGE_TIMEOUT_MS });
      const info = imageInfo(made.data);
      if (!info) throw new Error("The image service sent back something that isn’t a usable picture");
      original = { mimeType: info.type, data: made.data, width: info.width, height: info.height, prompt: photo.prompt };
    } catch (error) {
      missing("06-photo-original", "Test photo (made by the bench)", "image.generate", "photo", "failed", describe(error), photo.prompt);
    }
  }
  if (!original) {
    missing("07-photo-edit", editTitle, "makePhotoVersion", "photo", "skipped", "No test photo");
    return;
  }

  const check = stopped() ? null : await checkPhoto(ctx.model, original, ctx.now).catch(() => null);
  const drawnInCode = ctx.image.simulated || !generate;
  save(
    "06-photo-original",
    "Test photo (made by the bench, not the app)",
    drawnInCode ? "productPhoto" : "image.generate",
    "photo",
    original,
    { summary: photoCheckSummary(check), detail: check },
    drawnInCode ? { model: "drawn in code", simulated: false } : { requested: CROPS[photo.crop].size },
  );
  if (!check) {
    missing("07-photo-edit", editTitle, "makePhotoVersion", "photo", "skipped", stopped() ? BUDGET : "The photo check failed");
    return;
  }
  // The app won't edit a photo its check says is unusable
  if (check.method === "ai" && !check.usable) {
    missing("07-photo-edit", editTitle, "makePhotoVersion", "photo", "skipped", "The photo check said this photo can’t be edited accurately");
    return;
  }
  const seen = check.method === "ai";
  const objects = check.objects;
  const forSale = seen ? (objects.length === 1 ? [objects[0].name] : objects.filter((object) => object.likelyForSale).map((object) => object.name)) : photo.forSale;
  if (stopped()) {
    missing("07-photo-edit", editTitle, "makePhotoVersion", "photo", "skipped", BUDGET);
    return;
  }
  const { kept, store } = keepingVersions();
  try {
    await makePhotoVersion({ image: tracked.image, vision: ctx.model }, store, {
      requestKey: `${scenario.id}-photo`,
      original: { mimeType: original.mimeType, data: original.data },
      photo: { category: seen ? check.category : photo.category, check, forSale, answer: check.question ? photo.answer : null },
      look: photo.look,
      crop: photo.crop,
      parent: null,
      refinement: null,
      now: ctx.now,
    });
    const version = kept.version!;
    save(
      "07-photo-edit",
      editTitle,
      "makePhotoVersion",
      "photo",
      { ...version, prompt: version.instruction },
      { summary: reviewSummary(kept.review), detail: kept.review },
      { requested: CROPS[photo.crop].size },
    );
  } catch (error) {
    missing("07-photo-edit", editTitle, "makePhotoVersion", "photo", "failed", describe(error));
  }
}

export interface ImageRunInfo {
  startedAt: string;
  finishedAt: string;
  provider: { name: string; model: string; simulated: boolean };
  imageModel: { name: string; model: string; simulated: boolean };
  prices: Prices;
  budget: { limitUsd: number; spentUsd: number } | null;
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
export const promptSummary = (prompt: string | null, max = 280) => {
  if (!prompt) return "";
  const flat = prompt.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};
const money = (usd: number | null) => (usd === null ? "n/a" : `$${usd.toFixed(usd < 0.1 ? 4 : 2)}`);
const seconds = (ms: number | null) => (ms === null ? "" : `${(ms / 1000).toFixed(1)} s`);

export interface Totals {
  pictures: number;
  made: number;
  failed: number;
  skipped: number;
  imageCalls: number;
  textCalls: number;
  imageUsd: number | null;
  textUsd: number | null;
  ms: number;
}

export function totalsOf(results: readonly ScenarioResult[], calls: readonly CallRecord[], ms: number): Totals {
  const pictures = results.flatMap((each) => each.pictures);
  const costOf = (list: CallRecord[]) => (list.some((call) => call.costUsd === null && call.ok) ? null : list.reduce((sum, call) => sum + (call.costUsd ?? 0), 0));
  const images = calls.filter((call) => call.kind === "image");
  const text = calls.filter((call) => call.kind !== "image");
  return {
    pictures: pictures.length,
    made: pictures.filter((each) => each.status === "made").length,
    failed: pictures.filter((each) => each.status === "failed").length,
    skipped: pictures.filter((each) => each.status === "skipped").length,
    imageCalls: images.length,
    textCalls: text.length,
    imageUsd: costOf(images),
    textUsd: costOf(text),
    ms,
  };
}

export function totalsLine(totals: Totals, simulated: boolean): string {
  const both = totals.imageUsd === null || totals.textUsd === null ? null : totals.imageUsd + totals.textUsd;
  const cost = `${money(both)} (${money(totals.imageUsd)} pictures, ${money(totals.textUsd)} text and checks)`;
  return [
    `${totals.made} of ${totals.pictures} pictures made`,
    totals.failed ? `${totals.failed} failed` : null,
    totals.skipped ? `${totals.skipped} skipped` : null,
    `${totals.imageCalls} image calls, ${totals.textCalls} text and vision calls`,
    simulated ? `nothing billed; priced as Muse, about ${cost}` : `about ${cost}`,
    `${seconds(totals.ms)}`,
  ]
    .filter(Boolean)
    .join(", ");
}

export function indexMarkdown(info: ImageRunInfo, results: readonly ScenarioResult[], totals: Totals): string {
  const practice = info.imageModel.simulated || info.provider.simulated;
  const lines = [
    "# First Sale image-quality run",
    "",
    `Started ${info.startedAt}. Text and checks: ${info.provider.name} (${info.provider.model}). Pictures: ${info.imageModel.name} (${info.imageModel.model}).`,
    info.budget ? `Budget $${info.budget.limitUsd.toFixed(2)}, about $${info.budget.spentUsd.toFixed(4)} spent.` : "No budget (practice mode, nothing billed).",
    "",
    practice ? "> **Practice mode.** Every picture here is a practice placeholder, not made by Muse, and the app's picture checks are skipped." : "",
    "",
    `**Totals:** ${totalsLine(totals, practice)}.`,
    "",
    `Costs are estimates from ${info.prices.source} (checked ${info.prices.checked}); a picture's cost is its image call only.`,
    "",
  ];
  for (const result of results) {
    lines.push(`## ${result.label}`, "");
    lines.push(`**Brand description:** ${result.story || "(none)"}`, "");
    if (result.concepts.length) lines.push(`**Logo ideas:** ${result.concepts.map((concept, index) => `${index + 1}. ${concept.title} (${concept.kind})`).join("; ")}`, "");
    lines.push(`**Tagline suggestions:** ${result.taglines.length ? result.taglines.map((line) => `“${line}”`).join(", ") : "(none)"}`, "");
    if (result.notes.length) lines.push(...result.notes.map((note) => `- ${note}`), "");
    lines.push("| Picture | Made by | Model | Size | Time | Cost | App's check |", "| --- | --- | --- | --- | --- | --- | --- |");
    for (const picture of result.pictures) {
      const name = picture.file ? `[${cell(picture.title)}](${picture.file})` : `${cell(picture.title)} (${picture.status}: ${cell(picture.reason ?? "")})`;
      const size = [picture.requested && `asked ${picture.requested}`, picture.width && `got ${picture.width}×${picture.height}`].filter(Boolean).join(", ");
      const via = picture.built === "code" ? `${picture.via} (built in code)` : picture.via;
      lines.push(`| ${name} | ${via} | ${picture.model} | ${size} | ${seconds(picture.ms)} | ${money(picture.costUsd)} | ${cell(picture.check)} |`);
    }
    lines.push("");
    for (const picture of result.pictures.filter((each) => each.file)) {
      lines.push(`### ${picture.title}`, "", `![${cell(picture.title)}](${picture.file})`, "", `Prompt: ${promptSummary(picture.prompt)}`, "", `Check: ${picture.check}`, "");
    }
  }
  return lines.join("\n");
}

export function writeIndex(dir: string, info: ImageRunInfo, results: readonly ScenarioResult[], totals: Totals): void {
  writeFileSync(path.join(dir, "index.md"), `${indexMarkdown(info, results, totals)}\n`);
  writeFileSync(path.join(dir, "images.json"), `${JSON.stringify({ ...info, totals, scenarios: results }, null, 2)}\n`);
}
