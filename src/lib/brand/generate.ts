import { ImageEditError, type ImageEditResult, type ImageInput, type ImageModel, type ModelProvider } from "@/lib/ai";
import { OwnerFacingError } from "@/lib/errors";
import { imageInfo } from "@/lib/photos/image-info";
import { checkBrandImage, checkLogo, checkVersion, type Expected, failedCheck, marksFor, skippedCheck } from "./checks";
import { kitColors } from "./colors";
import { clearFrame, logoColors, oneColor, type Pixels } from "./pixels";
import { decodePng, encodePng } from "./png";
import { practiceSvg } from "./practice";
import { brandImagePrompt, logoPrompt, ownLogoEditPrompt, pictureEditPrompt, refinePrompt, retryLines, versionPrompt } from "./prompts";
import { applyDesign, inherited } from "./refine";
import { sizeFor } from "./sizes";
import { EXAMPLE_IMAGE } from "./slots";
import {
  type AssetCheck,
  type AssetKind,
  type BrandBrief,
  type BrandDesign,
  type BrandImageKind,
  type ConceptReply,
  IMAGE_KINDS,
  LOGO_KINDS,
  type PaletteColor,
  type VersionKind,
} from "./types";

// Each file is saved only once its bytes check out, so a failed try leaves nothing behind.
// Limits are checked before paying, and a request key already used returns the saved file instead of paying again.

// With the check after it, stays inside the 300-second limit
const IMAGE_TIMEOUT_MS = 180_000;
// Far above what the service returns; guards the database
const MAX_RESULT_BYTES = 25_000_000;

export interface NewBrandAsset {
  kind: AssetKind;
  // Null for files made from the owner's uploaded logo
  conceptId: string | null;
  sourceId: string | null;
  change: string | null;
  // One-click changes this file carries, inherited from the logo it was made from
  design: BrandDesign | null;
  // An edit of the owner's own logo keeps the words they said it has
  words?: string | null;
  prompt: string;
  model: string;
  simulated: boolean;
  requestKey: string;
  mimeType: string;
  data: Uint8Array;
  width: number;
  height: number;
}

export type Room = "ok" | "too_many" | "too_large";

// Where files are saved; actions pass the owner's wrappers, tests a test database
export interface AssetStore {
  findByRequest(requestKey: string): Promise<string | null>;
  room(adding: number): Promise<Room | "not_found">;
  add(asset: NewBrandAsset): Promise<{ ok: true; id: string } | { ok: false; reason: "not_found" }>;
  setCheck(assetId: string, check: AssetCheck): Promise<void>;
}

export const ROOM_MESSAGES = {
  not_found: "Your brand wasn’t found. Reload the page and try again.",
  too_many: "You’ve made as many brand files as First Sale can keep. Remove ideas you don’t need, then try again.",
  too_large: "Your brand files are taking up all the space First Sale allows. Remove ideas you don’t need, then try again.",
} as const;

export interface Models {
  image: ImageModel;
  vision: ModelProvider;
}

// The concept a file belongs to, with the brief it was written from; for a logo, with its one-click changes applied
export interface ConceptRef {
  id: string;
  concept: ConceptReply;
  brief: BrandBrief;
}

// id and concept are null for the owner's uploaded logo, which wasn't drawn from an idea
export interface LogoRef {
  id: string | null;
  concept: ConceptReply | null;
  brief: BrandBrief;
  logoId: string;
  logo: ImageInput;
  design: BrandDesign | null;
  // Uploaded logos: the words in it as the owner typed them; "" when it has none or they didn't say
  words?: string;
}

export const UPLOAD_ONE_CLICK = "One-click changes are only for logos drawn here. Say what you’d like changed instead, and First Sale makes an edited copy of your logo.";

interface Job {
  kind: AssetKind;
  concept: LogoRef | ConceptRef;
  sourceId: string | null;
  change: string | null;
  design: BrandDesign | null;
  words?: string | null;
  prompt: string;
  requestKey: string;
  call: () => Promise<ImageEditResult>;
  check: (file: ImageInput) => Promise<AssetCheck>;
  // Fixes code can guarantee, run on the returned pixels before saving
  fix?: (image: Pixels) => Pixels;
  // One more try, written from what the first one's check flagged
  retry?: (check: AssetCheck) => Job;
}

export interface BatchResult {
  ids: string[];
  // Owner-facing, when some didn't come back
  failed: string | null;
}

// An uploaded logo is checked against the words the owner said it has, if any
const expected = (ref: LogoRef | ConceptRef, kind: AssetKind): Expected =>
  ref.concept
    ? { name: ref.brief.name, tagline: ref.brief.tagline, marks: marksFor(ref.concept, kind) }
    : { name: ("words" in ref && ref.words) || "", tagline: "", marks: "initials" };

const paletteOf = (ref: LogoRef) => ref.concept?.palette ?? ref.design?.palette ?? [];

async function runOne(models: Models, store: AssetStore, job: Job, now: Date): Promise<string> {
  let result: ImageEditResult;
  try {
    result = await job.call();
  } catch (error) {
    throw ownerFacing(error);
  }

  let file: { mimeType: string; data: Uint8Array; width: number; height: number };
  if (models.image.simulated) {
    // Never shown as a picture: a labeled text wordmark stands in
    const preview = practiceSvg({
      kind: job.kind,
      conceptKind: job.concept.concept?.kind ?? "wordmark",
      name: job.concept.brief.name,
      tagline: job.concept.concept ? job.concept.brief.tagline : "",
      palette: job.concept.concept?.palette ?? job.design?.palette ?? [],
      typography: job.concept.concept?.typography ?? "",
    });
    file = { mimeType: "image/svg+xml", data: new TextEncoder().encode(preview.svg), width: preview.width, height: preview.height };
  } else {
    const info = result.data.byteLength <= MAX_RESULT_BYTES ? imageInfo(result.data) : null;
    if (!info) throw new OwnerFacingError("The image service sent back something that isn’t a usable picture. Nothing was saved. Try again.");
    file = { mimeType: info.type, data: result.data, width: info.width, height: info.height };
    const fixed = job.fix ? fixPng(file.data, job.fix) : null;
    if (fixed) file = { ...file, mimeType: "image/png", data: fixed };
  }

  const added = await store.add({
    ...file,
    kind: job.kind,
    conceptId: job.concept.id,
    sourceId: job.sourceId,
    change: job.change,
    design: job.design,
    words: job.words ?? null,
    prompt: job.prompt,
    model: models.image.model,
    simulated: models.image.simulated,
    requestKey: job.requestKey,
  });
  if (!added.ok) throw new OwnerFacingError(ROOM_MESSAGES[added.reason]);

  // A failed check never loses the file: the owner is asked to look closely themselves
  const check =
    models.image.simulated || !models.vision.capabilities.vision
      ? skippedCheck(now)
      : await job.check({ mimeType: file.mimeType, data: file.data }).catch(() => failedCheck(now));
  await store.setCheck(added.id, check);
  if (!job.retry || !needsRetry(check) || (await store.room(1)) !== "ok") return added.id;
  // Both are kept: the retry shows as newest and the first try stays under "Earlier ones"
  return runOne(models, store, job.retry(check), now).catch(() => added.id);
}

// The app's own check found the version drifted from the logo, or its lettering wrong
export function needsRetry(check: AssetCheck): boolean {
  if (check.method !== "ai") return false;
  return check.drift.length > 0 || Boolean(check.lettering?.problems.length && check.lettering.status !== "unreadable");
}

// Null when the file isn't a PNG this can read, or nothing changed
function fixPng(data: Uint8Array, fix: (image: Pixels) => Pixels): Uint8Array | null {
  const image = decodePng(data);
  if (!image) return null;
  const fixed = fix(image);
  return fixed === image ? null : encodePng(fixed);
}

// The one color: the logo's darkest, as the kit uses; for an uploaded logo, read from its pixels
function solidInk(logo: LogoRef, version: Pixels): string {
  const listed = paletteOf(logo);
  if (listed.length) return kitColors(listed).ink;
  const source = decodePng(logo.logo.data) ?? version;
  return kitColors(logoColors(source).map((hex): PaletteColor => ({ hex, name: hex }))).ink;
}

// Logos never get a frame; the one-color version is made one color in code, whatever came back
function logoFix(kind: AssetKind, logo: LogoRef | null): ((image: Pixels) => Pixels) | undefined {
  if (!(LOGO_KINDS as readonly string[]).includes(kind)) return undefined;
  return (image) => {
    const unframed = clearFrame(image);
    return kind === "solid" && logo ? (oneColor(unframed, solidInk(logo, unframed)) ?? unframed) : unframed;
  };
}

// Several at once; each one that comes back is kept even if others fail
async function runBatch(models: Models, store: AssetStore, jobs: Job[], now: Date): Promise<BatchResult> {
  const pending: Job[] = [];
  const ids: string[] = [];
  for (const job of jobs) {
    const existing = await store.findByRequest(job.requestKey);
    if (existing) ids.push(existing);
    else pending.push(job);
  }
  if (pending.length) {
    const room = await store.room(pending.length);
    if (room !== "ok") throw new OwnerFacingError(ROOM_MESSAGES[room]);
  }

  const results = await Promise.allSettled(pending.map((job) => runOne(models, store, job, now)));
  const failures: unknown[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") ids.push(result.value);
    else failures.push(result.reason);
  }
  if (failures.length && failures.length === pending.length && ids.length === 0) throw failures[0];
  if (!failures.length) return { ids, failed: null };
  // The runner only logs what's thrown, so setup problems in a partly failed batch are logged here
  for (const failure of failures) {
    if (failure instanceof OwnerFacingError) continue;
    const status = typeof failure === "object" && failure && "status" in failure ? String((failure as { status: unknown }).status) : "";
    console.error("Brand picture failed:", failure instanceof Error ? failure.name : "unknown error", status);
  }
  const reason = failures.find((failure) => failure instanceof OwnerFacingError) as OwnerFacingError | undefined;
  return {
    ids,
    failed: `${failures.length} of ${pending.length} didn’t come back. ${reason?.message ?? "Try again in a minute."}`,
  };
}

function generator(models: Models) {
  const generate = models.image.generate;
  if (!generate) throw new OwnerFacingError("Logo drawing isn’t turned on for First Sale yet.");
  return generate.bind(models.image);
}

// One drawing per concept; the concept id is the request key, so drawing again never pays twice
export async function drawConcepts(models: Models, store: AssetStore, input: { concepts: ConceptRef[]; userKey?: string; now: Date }): Promise<BatchResult> {
  const generate = generator(models);
  const jobs = input.concepts.map((concept): Job => {
    const prompt = logoPrompt(concept.brief, concept.concept);
    return {
      kind: "logo",
      concept,
      sourceId: null,
      change: null,
      design: null,
      prompt,
      requestKey: drawKey(concept.id),
      call: () => generate({ prompt, size: sizeFor("logo"), format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey }),
      check: (file) => checkLogo(models.vision, file, expected(concept, "logo"), input.now, input.userKey),
      fix: logoFix("logo", null),
    };
  });
  return runBatch(models, store, jobs, input.now);
}

export const drawKey = (conceptId: string) => `draw:${conceptId}`;

// The owner's own logo goes back as image 1 with their words; the edit is a new file and the original never changes
async function editOwnLogo(models: Models, store: AssetStore, input: { logo: LogoRef; change: string; requestKey: string; userKey?: string; now: Date }): Promise<string> {
  const { logo } = input;
  const prompt = ownLogoEditPrompt(logo.words ?? "", input.change);
  const job: Job = {
    kind: "logo",
    concept: logo,
    sourceId: logo.logoId,
    change: input.change,
    design: inherited(logo.design),
    words: logo.words ?? "",
    prompt,
    requestKey: input.requestKey,
    call: () => models.image.edit({ instruction: prompt, images: [logo.logo], size: sizeFor("logo"), format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey }),
    check: (file) => checkLogo(models.vision, file, expected(logo, "logo"), input.now, input.userKey),
    fix: logoFix("logo", null),
  };
  const result = await runBatch(models, store, [job], input.now);
  return result.ids[0];
}

// The draft goes back as image 1, with the owner's words or a one-click change (refine.ts)
export async function refineLogo(
  models: Models,
  store: AssetStore,
  input: { logo: LogoRef; change: string; oneClick?: { lines: string[]; design: BrandDesign }; requestKey: string; userKey?: string; now: Date },
): Promise<string> {
  const concept = input.logo.concept;
  if (!concept) {
    if (input.oneClick) throw new OwnerFacingError(UPLOAD_ONE_CLICK);
    return editOwnLogo(models, store, input);
  }
  // Drawn and checked as it will be: new colors, lettering or tagline included
  const logo = input.oneClick
    ? { ...input.logo, ...applyDesign(concept, input.logo.brief, input.oneClick.design), design: input.oneClick.design }
    : { ...input.logo, concept };
  const prompt = refinePrompt(logo.brief, logo.concept, input.oneClick?.lines ?? input.change);
  const job: Job = {
    kind: "logo",
    concept: logo,
    sourceId: logo.logoId,
    change: input.change,
    design: input.oneClick ? input.oneClick.design : inherited(logo.design),
    prompt,
    requestKey: input.requestKey,
    call: () => models.image.edit({ instruction: prompt, images: [logo.logo], size: sizeFor("logo"), format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey }),
    check: (file) => checkLogo(models.vision, file, expected(logo, "logo"), input.now, input.userKey),
    fix: logoFix("logo", null),
  };
  const result = await runBatch(models, store, [job], input.now);
  return result.ids[0];
}

// The chosen logo is image 1 of every version, so the design stays the same.
// When the check flags drift, one more try is made and both are kept.
export async function makeVersions(
  models: Models,
  store: AssetStore,
  input: { logo: LogoRef; kinds: VersionKind[]; requestKey: string; userKey?: string; now: Date },
): Promise<BatchResult> {
  const { logo } = input;
  const job = (kind: VersionKind, flagged: AssetCheck | null): Job => {
    const prompt = [versionPrompt(logo.brief, logo.concept, kind, logo.words), ...(flagged ? retryLines(flagged) : [])].join("\n");
    // Tied to the logo, so a key kept from another logo's try can't return that logo's files
    const requestKey = `${logo.logoId}:${input.requestKey}:${kind}${flagged ? ":retry" : ""}`;
    return {
      kind,
      concept: logo,
      sourceId: logo.logoId,
      change: null,
      design: inherited(logo.design),
      prompt,
      requestKey,
      call: () => models.image.edit({ instruction: prompt, images: [logo.logo], size: sizeFor(kind), format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey }),
      check: (file) => checkVersion(models.vision, logo.logo, file, kind, expected(logo, kind), input.now, input.userKey),
      fix: logoFix(kind, logo),
      retry: flagged ? undefined : (check) => job(kind, check),
    };
  };
  return runBatch(models, store, input.kinds.map((kind) => job(kind, null)), input.now);
}

export async function makeBrandImages(
  models: Models,
  store: AssetStore,
  // The approved example the others match; never sent for the example's own slot
  input: { logo: LogoRef; kinds: BrandImageKind[]; change: string | null; example?: ImageInput | null; requestKey: string; userKey?: string; now: Date },
): Promise<BatchResult> {
  const { logo } = input;
  const jobs = input.kinds.map((kind): Job => {
    const example = kind !== EXAMPLE_IMAGE && input.example ? input.example : null;
    const prompt = brandImagePrompt(logo.brief, paletteOf(logo), kind, input.change, example ? EXAMPLE_IMAGE : undefined);
    return {
      kind,
      concept: logo,
      sourceId: logo.logoId,
      change: input.change,
      design: inherited(logo.design),
      prompt,
      requestKey: `${logo.logoId}:${input.requestKey}:${kind}`,
      call: () =>
        models.image.edit({ instruction: prompt, images: example ? [logo.logo, example] : [logo.logo], size: sizeFor(kind), format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey }),
      check: (file) => checkBrandImage(models.vision, file, kind, expected(logo, "logo"), input.now, input.userKey),
    };
  });
  return runBatch(models, store, jobs, input.now);
}

// A version or brand image changed in the owner's words: image 1 is the picture, image 2 the logo it must still match
export async function editPicture(
  models: Models,
  store: AssetStore,
  input: { logo: LogoRef; picture: { kind: VersionKind | BrandImageKind; file: ImageInput }; change: string; requestKey: string; userKey?: string; now: Date },
): Promise<string> {
  const { logo, picture } = input;
  const kind = picture.kind;
  const prompt = pictureEditPrompt(kind, input.change, logo);
  const isImage = (IMAGE_KINDS as readonly string[]).includes(kind);
  const job: Job = {
    kind,
    concept: logo,
    // Made from the chosen logo, so the owner can pick it like any other
    sourceId: logo.logoId,
    change: input.change,
    design: inherited(logo.design),
    prompt,
    requestKey: `${logo.logoId}:${input.requestKey}:edit`,
    call: () => models.image.edit({ instruction: prompt, images: [picture.file, logo.logo], size: sizeFor(kind), format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey }),
    check: (file) =>
      isImage
        ? checkBrandImage(models.vision, file, kind as BrandImageKind, expected(logo, "logo"), input.now, input.userKey)
        : checkVersion(models.vision, logo.logo, file, kind as VersionKind, expected(logo, kind), input.now, input.userKey),
    fix: logoFix(kind, logo),
  };
  const result = await runBatch(models, store, [job], input.now);
  return result.ids[0];
}

function ownerFacing(error: unknown): unknown {
  if (!(error instanceof ImageEditError)) return error;
  if (error.code === "content_policy_violation") {
    return new OwnerFacingError("The image service wouldn’t make this one. Try different words, or change your brief.");
  }
  if (error.timedOut) return new OwnerFacingError("That took too long, and nothing was saved. Try again.");
  if (error.status === 429) return new OwnerFacingError("The image service is busy. Wait a minute, then try again. Nothing was saved.");
  if (error.retryable) return new OwnerFacingError("The image service had a problem, and nothing was saved. Try again in a minute.");
  // Setup problems (key, model name, request shape) are logged by the workflow runner
  return error;
}
