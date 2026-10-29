import { ImageEditError, type ImageEditResult, type ImageInput, type ImageModel, type ModelProvider } from "@/lib/ai";
import { OwnerFacingError } from "@/lib/errors";
import { imageInfo } from "@/lib/photos/image-info";
import { checkBrandImage, checkLogo, checkVersion, type Expected, failedCheck, marksFor, skippedCheck } from "./checks";
import { practiceSvg } from "./practice";
import { brandImagePrompt, logoPrompt, refinePrompt, versionPrompt } from "./prompts";
import { applyDesign, inherited } from "./refine";
import { sizeFor } from "./sizes";
import type { AssetCheck, AssetKind, BrandBrief, BrandDesign, BrandImageKind, ConceptReply, VersionKind } from "./types";

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

export const UPLOAD_UNCHANGED = "First Sale doesn’t redraw a logo you uploaded. To change it, upload a new file, or get logo ideas instead.";

interface Job {
  kind: AssetKind;
  concept: LogoRef | ConceptRef;
  sourceId: string | null;
  change: string | null;
  design: BrandDesign | null;
  prompt: string;
  requestKey: string;
  call: () => Promise<ImageEditResult>;
  check: (file: ImageInput) => Promise<AssetCheck>;
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
  }

  const added = await store.add({
    ...file,
    kind: job.kind,
    conceptId: job.concept.id,
    sourceId: job.sourceId,
    change: job.change,
    design: job.design,
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
  return added.id;
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
    };
  });
  return runBatch(models, store, jobs, input.now);
}

export const drawKey = (conceptId: string) => `draw:${conceptId}`;

// The draft goes back as image 1, with the owner's words or a one-click change (refine.ts)
export async function refineLogo(
  models: Models,
  store: AssetStore,
  input: { logo: LogoRef; change: string; oneClick?: { lines: string[]; design: BrandDesign }; requestKey: string; userKey?: string; now: Date },
): Promise<string> {
  const concept = input.logo.concept;
  if (!concept) throw new OwnerFacingError(UPLOAD_UNCHANGED);
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
  };
  const result = await runBatch(models, store, [job], input.now);
  return result.ids[0];
}

// The chosen logo is image 1 of every version, so the design stays the same
export async function makeVersions(
  models: Models,
  store: AssetStore,
  input: { logo: LogoRef; kinds: VersionKind[]; requestKey: string; userKey?: string; now: Date },
): Promise<BatchResult> {
  const { logo } = input;
  const jobs = input.kinds.map((kind): Job => {
    const prompt = versionPrompt(logo.brief, logo.concept, kind, logo.words);
    return {
      kind,
      concept: logo,
      sourceId: logo.logoId,
      change: null,
      design: inherited(logo.design),
      prompt,
      // Tied to the logo, so a key kept from another logo's try can't return that logo's files
      requestKey: `${logo.logoId}:${input.requestKey}:${kind}`,
      call: () => models.image.edit({ instruction: prompt, images: [logo.logo], size: sizeFor(kind), format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey }),
      check: (file) => checkVersion(models.vision, logo.logo, file, kind, expected(logo, kind), input.now, input.userKey),
    };
  });
  return runBatch(models, store, jobs, input.now);
}

export async function makeBrandImages(
  models: Models,
  store: AssetStore,
  input: { logo: LogoRef; kinds: BrandImageKind[]; change: string | null; requestKey: string; userKey?: string; now: Date },
): Promise<BatchResult> {
  const { logo } = input;
  const jobs = input.kinds.map((kind): Job => {
    const prompt = brandImagePrompt(logo.brief, paletteOf(logo), kind, input.change);
    return {
      kind,
      concept: logo,
      sourceId: logo.logoId,
      change: input.change,
      design: inherited(logo.design),
      prompt,
      requestKey: `${logo.logoId}:${input.requestKey}:${kind}`,
      call: () => models.image.edit({ instruction: prompt, images: [logo.logo], size: sizeFor(kind), format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey }),
      check: (file) => checkBrandImage(models.vision, file, kind, expected(logo, "logo"), input.now, input.userKey),
    };
  });
  return runBatch(models, store, jobs, input.now);
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
