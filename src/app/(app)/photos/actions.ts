"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getImageModel, getModel } from "@/lib/ai";
import {
  addMyPhotoVersion,
  approveMyPhotoVersion,
  createMyPhoto,
  deleteMyPhoto,
  findMyPhotoVersionByRequest,
  getMyPhoto,
  getMyPhotoFile,
  getMyPhotoVersionFile,
  myAiKey,
  myPhotoVersionRoom,
  setMyPhotoVersionReview,
  updateMyPhoto,
} from "@/lib/data/my-business";
import type { PhotoSummary } from "@/lib/data/product-photos";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { checkPhoto } from "@/lib/photos/check";
import { makePhotoVersion, type MakeVersionInput, type VersionStore } from "@/lib/photos/edit";
import { MAX_ANSWER, MAX_CHANGE, ownerText } from "@/lib/photos/instructions";
import { PHOTO_CATEGORIES, PHOTO_CROPS, PHOTO_LOOKS, type PhotoCategory } from "@/lib/photos/types";
import { checkPhotoUpload } from "@/lib/photos/upload";
import { changesFor, firstOf } from "@/lib/photos/versions";
import { runWorkflow } from "@/lib/workflow-runner";

const NOT_FOUND = "That photo wasn’t found. It may have been deleted.";
const id = z.string().min(1).max(60);

// --- Adding a photo

export async function uploadPhotoAction(form: FormData): Promise<ActionResult<string>> {
  const file = form.get("file");
  const name = form.get("name");
  if (!(file instanceof File)) return { ok: false, message: "Choose a photo to upload." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "That photo is over 4 MB. Choose it again on this page and it will be made smaller for you." };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkPhotoUpload(bytes, file.name, typeof name === "string" ? name : "");
  if (!check.ok) return check;

  const created = await createMyPhoto({ title: check.title, mimeType: check.type, sha256: check.sha256, width: check.width, height: check.height, data: bytes });
  if (!created.ok) {
    return {
      ok: false,
      message: created.reason === "no_business" ? "Tell us about your business first." : "Your photo library is full. Delete photos you don’t need, then try again.",
    };
  }
  // Kept even if the check fails: the photo's page offers to check again
  await runCheck(created.id, { mimeType: check.type, data: bytes, width: check.width, height: check.height });
  refresh();
  return { ok: true, value: created.id };
}

async function runCheck(photoId: string, photo: Parameters<typeof checkPhoto>[1]) {
  return runWorkflow("photo_check", photoId, async () => {
    const check = await checkPhoto(getModel(), photo, new Date(), await myAiKey());
    const objects = check.objects;
    await updateMyPhoto(photoId, {
      check,
      // Without a model that can see, the owner picks it
      category: check.method === "ai" ? check.category : null,
      forSale: objects.length === 1 ? [objects[0].name] : objects.filter((object) => object.likelyForSale).map((object) => object.name),
      answer: null,
    });
  });
}

export async function checkAgainAction(photoId: unknown): Promise<ActionResult> {
  const parsed = id.safeParse(photoId);
  const found = parsed.success ? await getMyPhoto(parsed.data) : null;
  const file = found ? await getMyPhotoFile(found.photo.id) : null;
  if (!found || !file) return { ok: false, message: NOT_FOUND };
  const result = await runCheck(found.photo.id, { mimeType: file.mimeType, data: file.data, width: found.photo.width, height: found.photo.height });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}

// --- Making versions

// What has to be true before paying for an edit; rules, not the model, decide
function readyProblem(photo: Omit<PhotoSummary, "versionCount" | "approvedCount">, choices: { category: PhotoCategory | null; forSale: string[]; answer: string | null }): string | null {
  const check = photo.check;
  if (!check) return "Your photo hasn’t been checked yet. Choose “Check the photo again”, then try.";
  if (!check.usable) return "This photo can’t be edited accurately. See what to change, then upload a new photo.";
  if (!choices.category) return "Choose what kind of product this is.";
  if (check.objects.length > 1 && choices.forSale.length === 0) return "Choose what you’re selling in this photo.";
  if (check.question && !choices.answer?.trim()) return "Answer the question about your photo first.";
  return null;
}

function storeFor(photoId: string): VersionStore {
  return {
    findByRequest: (requestKey) => findMyPhotoVersionByRequest(photoId, requestKey),
    room: () => myPhotoVersionRoom(photoId),
    add: (version) => addMyPhotoVersion(photoId, version),
    setReview: async (versionId, review) => {
      await setMyPhotoVersionReview(versionId, review);
    },
  };
}

async function makeVersion(photoId: string, input: Omit<MakeVersionInput, "original" | "userKey" | "now">): Promise<ActionResult<string>> {
  const image = (() => {
    try {
      return getImageModel();
    } catch {
      return null;
    }
  })();
  if (!image) return { ok: false, message: "Photo editing isn’t turned on for SnapStart yet." };
  const original = await getMyPhotoFile(photoId);
  if (!original) return { ok: false, message: NOT_FOUND };

  const result = await runWorkflow("photo_edit", photoId, async () =>
    makePhotoVersion({ image, vision: getModel() }, storeFor(photoId), {
      ...input,
      original: { mimeType: original.mimeType, data: original.data },
      userKey: await myAiKey(),
      now: new Date(),
    }),
  );
  refresh();
  return result;
}

const generateSchema = z.object({
  photoId: id,
  requestKey: z.uuid(),
  look: z.enum(PHOTO_LOOKS),
  crop: z.enum(PHOTO_CROPS),
  category: z.enum(PHOTO_CATEGORIES),
  forSale: z.array(z.string().max(120)).max(10),
  answer: z.string().max(MAX_ANSWER * 2),
});

// A fresh version from the original, with the chosen look and crop
export async function generatePhotoAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some choices are missing. Reload the page and try again." };
  const { photoId, requestKey, look, crop, category } = parsed.data;
  const found = await getMyPhoto(photoId);
  if (!found) return { ok: false, message: NOT_FOUND };
  // Already made by an earlier try of this same request
  const existing = await findMyPhotoVersionByRequest(photoId, requestKey);
  if (existing) return { ok: true, value: existing };

  const names = new Set(found.photo.check?.objects.map((object) => object.name));
  const forSale = parsed.data.forSale.filter((name) => names.has(name));
  const answer = ownerText(parsed.data.answer, MAX_ANSWER) || null;
  const problem = readyProblem(found.photo, { category, forSale, answer });
  if (problem) return { ok: false, message: problem };
  await updateMyPhoto(photoId, { category, forSale, answer, look, crop });

  return makeVersion(photoId, {
    requestKey,
    photo: { category, check: found.photo.check, forSale, answer },
    look,
    crop,
    parent: null,
    refinement: null,
  });
}

const refineSchema = z.object({ photoId: id, versionId: id, requestKey: z.uuid(), change: z.string().max(MAX_CHANGE * 2) });

// A change to one version in the owner's words; the original still goes with it as the product reference
export async function refinePhotoAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = refineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: `Describe the change in up to ${MAX_CHANGE} characters.` };
  const { photoId, versionId, requestKey } = parsed.data;
  const change = ownerText(parsed.data.change, MAX_CHANGE);
  if (change.length < 3) return { ok: false, message: "Say what you’d like changed, such as “Make the background ivory”." };
  const found = await getMyPhoto(photoId);
  const parent = found?.versions.find((version) => version.id === versionId);
  if (!found || !parent) return { ok: false, message: NOT_FOUND };
  const existing = await findMyPhotoVersionByRequest(photoId, requestKey);
  if (existing) return { ok: true, value: existing };

  const { photo } = found;
  const problem = readyProblem(photo, photo);
  if (problem || !photo.category) return { ok: false, message: problem ?? "Choose what kind of product this is." };
  const draft = await getMyPhotoVersionFile(photoId, versionId);
  if (!draft) return { ok: false, message: NOT_FOUND };

  return makeVersion(photoId, {
    requestKey,
    photo: { category: photo.category, check: photo.check, forSale: photo.forSale, answer: photo.answer },
    look: parent.look,
    crop: parent.crop,
    parent: { id: parent.id, image: { mimeType: draft.mimeType, data: draft.data }, changes: changesFor(found.versions, parent.id) },
    refinement: change,
    seasonDate: firstOf(found.versions, parent.id)?.createdAt,
  });
}

// --- Reviewing

const approveSchema = z.object({ photoId: id, versionId: id, confirmed: z.literal(true) });

// Only after the owner confirms it shows the product as it really is
export async function approveVersionAction(input: unknown): Promise<ActionResult> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "First confirm that this photo shows your product accurately." };
  const found = await getMyPhoto(parsed.data.photoId);
  if (!found?.versions.some((version) => version.id === parsed.data.versionId)) return { ok: false, message: NOT_FOUND };
  if (!(await approveMyPhotoVersion(parsed.data.versionId, true))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

export async function removeFromLibraryAction(versionId: unknown): Promise<ActionResult> {
  const parsed = id.safeParse(versionId);
  if (!parsed.success || !(await approveMyPhotoVersion(parsed.data, false))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

export async function deletePhotoAction(photoId: unknown): Promise<ActionResult> {
  const parsed = id.safeParse(photoId);
  if (!parsed.success || !(await deleteMyPhoto(parsed.data))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}
