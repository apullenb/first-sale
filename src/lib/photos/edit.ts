import { ImageEditError, type ImageInput, type ImageModel, type ModelProvider } from "@/lib/ai";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { OwnerFacingError } from "@/lib/errors";
import { compareVersion } from "./check";
import { imageInfo, type PhotoType } from "./image-info";
import { buildEditInstruction, type InstructionInput } from "./instructions";
import { CROPS } from "./looks";
import type { PhotoCategory, PhotoCheck, PhotoCrop, PhotoLook, PhotoReview } from "./types";

// One edited version: the original upload is always image 1, a refined draft image 2.
// The version is saved only once the returned bytes check out, so a failed try leaves nothing behind.

// With the comparison after it, stays inside the 300-second limit
const EDIT_TIMEOUT_MS = 180_000;
// Far above what the service returns; guards the database
const MAX_RESULT_BYTES = 25_000_000;

export interface EditedPhoto {
  mimeType: PhotoType;
  data: Uint8Array;
  width: number;
  height: number;
}

export interface NewPhotoVersion extends EditedPhoto {
  requestKey: string;
  parentId: string | null;
  look: PhotoLook;
  crop: PhotoCrop;
  refinement: string | null;
  instruction: string;
  model: string;
  simulated: boolean;
}

export type AddVersionOutcome = { ok: true; id: string } | { ok: false; reason: "not_found" };

// Where versions are saved; the action passes the owner's wrappers, tests a test database
export interface VersionStore {
  findByRequest(requestKey: string): Promise<string | null>;
  room(): Promise<"ok" | "not_found" | "too_many" | "too_large">;
  add(version: NewPhotoVersion): Promise<AddVersionOutcome>;
  setReview(versionId: string, review: PhotoReview): Promise<void>;
}

export interface MakeVersionInput {
  // Same key on a retry returns the version already made instead of paying for another
  requestKey: string;
  original: ImageInput;
  photo: { category: PhotoCategory; check: PhotoCheck | null; forSale: string[]; answer: string | null };
  look: PhotoLook;
  crop: PhotoCrop;
  // The version being refined, with the changes that led to it
  parent: { id: string; image: ImageInput; changes: string[] } | null;
  refinement: string | null;
  userKey?: string;
  now: Date;
  // A refinement keeps the season of the version it started from
  seasonDate?: Date;
}

export const ROOM_MESSAGES = {
  not_found: "That photo wasn’t found. It may have been deleted.",
  too_many: "This photo has as many versions as it can hold. Upload the photo again to start fresh.",
  too_large: "Your photo library is full. Delete photos you don’t need, then try again.",
} as const;

export async function makePhotoVersion(
  models: { image: ImageModel; vision: ModelProvider },
  store: VersionStore,
  input: MakeVersionInput,
): Promise<string> {
  const existing = await store.findByRequest(input.requestKey);
  if (existing) return existing;
  const room = await store.room();
  if (room !== "ok") throw new OwnerFacingError(ROOM_MESSAGES[room]);

  const changes = [...(input.parent?.changes ?? []), ...(input.refinement ? [input.refinement] : [])];
  const instructionInput: InstructionInput = {
    look: input.look,
    crop: input.crop,
    ...input.photo,
    changes,
    refining: input.parent !== null,
    now: input.seasonDate ?? input.now,
  };
  const instruction = buildEditInstruction(instructionInput);
  const edited = await editPhoto(models.image, {
    instruction,
    original: input.original,
    draft: input.parent?.image ?? null,
    crop: input.crop,
    userKey: input.userKey,
  });

  const added = await store.add({
    ...edited,
    requestKey: input.requestKey,
    parentId: input.parent?.id ?? null,
    look: input.look,
    crop: input.crop,
    refinement: input.refinement,
    instruction,
    model: models.image.model,
    simulated: models.image.simulated,
  });
  if (!added.ok) throw new OwnerFacingError(ROOM_MESSAGES[added.reason]);

  // A failed check never loses the photo: the owner is told to look closely themselves
  let review: PhotoReview;
  if (models.image.simulated || !models.vision.capabilities.vision) {
    review = { checkedAt: input.now.toISOString(), method: "skipped", flags: [] };
  } else {
    review = await compareVersion(models.vision, input.original, edited, input.now, input.userKey).catch(() => ({
      checkedAt: input.now.toISOString(),
      method: "failed" as const,
      flags: [],
    }));
  }
  await store.setReview(added.id, review);
  return added.id;
}

export async function editPhoto(
  model: ImageModel,
  input: { instruction: string; original: ImageInput; draft: ImageInput | null; crop: PhotoCrop; userKey?: string },
): Promise<EditedPhoto> {
  if (input.original.data.byteLength > MAX_UPLOAD_BYTES) throw new Error("Original photo is larger than uploads allow");
  let result;
  try {
    result = await model.edit({
      instruction: input.instruction,
      images: input.draft ? [input.original, input.draft] : [input.original],
      size: CROPS[input.crop].size,
      format: "png",
      timeoutMs: EDIT_TIMEOUT_MS,
      userKey: input.userKey,
    });
  } catch (error) {
    throw ownerFacing(error);
  }

  const info = result.data.byteLength <= MAX_RESULT_BYTES ? imageInfo(result.data) : null;
  if (!info) throw new OwnerFacingError("The photo service sent back something that isn’t a usable photo. No new version was saved. Try again.");
  return { mimeType: info.type, data: result.data, width: info.width, height: info.height };
}

function ownerFacing(error: unknown): unknown {
  if (!(error instanceof ImageEditError)) return error;
  if (error.code === "content_policy_violation") {
    return new OwnerFacingError("The photo service wouldn’t edit this photo. Try a different photo of your product.");
  }
  if (error.timedOut) return new OwnerFacingError("That took too long, and no new version was saved. Try again.");
  if (error.status === 429) return new OwnerFacingError("The photo service is busy. Wait a minute, then try again. No new version was saved.");
  if (error.retryable) return new OwnerFacingError("The photo service had a problem, and no new version was saved. Try again in a minute.");
  // Setup problems (key, model name, request shape) are logged by the workflow runner
  return error;
}
