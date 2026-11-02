import { ImageEditError, type ImageInput, type ImageModel } from "@/lib/ai";
import { feel } from "@/lib/brand/prompts";
import { MEDIUM_WORDS, PRACTICE_LABEL, PRACTICE_LABEL_COLORS } from "@/lib/brand/practice";
import type { ImageStyle } from "@/lib/brand/image-style";
import type { BrandBrief } from "@/lib/brand/types";
import { OwnerFacingError } from "@/lib/errors";
import { imageInfo } from "@/lib/photos/image-info";
import type { ItemKind } from "@/lib/rules/products";

// A picture of an item made from its description, in the brand's image style. Saved only once its bytes check out;
// the owner approves it before it's used.

export const MAX_PICTURE_CHANGE = 300;
export const PICTURES_PER_ITEM = 12;
const SIZE = "1024x1024";
const IMAGE_TIMEOUT_MS = 180_000;
const MAX_RESULT_BYTES = 25_000_000;

export interface PictureItem {
  kind: ItemKind;
  name: string;
  description: string;
  location: string;
  included: string;
}

export interface NewItemPicture {
  sourceId: string | null;
  change: string | null;
  prompt: string;
  model: string;
  simulated: boolean;
  requestKey: string;
  mimeType: string;
  data: Uint8Array;
  width: number;
  height: number;
}

export interface PictureStore {
  findByRequest(requestKey: string): Promise<string | null>;
  room(): Promise<"ok" | "too_many" | "not_found">;
  add(picture: NewItemPicture): Promise<{ ok: true; id: string } | { ok: false; reason: "not_found" | "too_many" }>;
}

const ROOM_MESSAGES = {
  not_found: "That item wasn’t found. It may have been removed. Reload the page.",
  too_many: `Each item keeps up to ${PICTURES_PER_ITEM} pictures. Remove the item’s older pictures, or pick one you have.`,
} as const;

const clean = (text: string, max: number) => text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function styleLines(style: ImageStyle): string[] {
  if (style.medium === "illustration") {
    return ["Style: a polished, flat illustration with simple shapes and motifs, in the brand’s drawing style.", "No 3D, gradients or drop shadows, and no photos."];
  }
  return [
    `Style: a photorealistic, professionally styled product photograph: ${style.light}, shallow depth of field, real textures and materials.`,
    style.lively ? "Bright, punchy and colorful, but still a real photograph." : null,
    "Not an illustration, cartoon, flat vector art or 3D render. No collage, frames or borders.",
  ].filter((line): line is string => line !== null);
}

// The owner's description is the only source for what the item looks like
export function itemPicturePrompt(item: PictureItem, style: ImageStyle, brief: BrandBrief | null): string {
  const name = clean(item.name, 80);
  const description = clean(item.description, 300);
  const service = item.kind === "service";
  return [
    service
      ? `Make a picture of a small US business’s service, “${name}”, being done or just finished, for their online listing.`
      : `Make a picture of one product a small US business sells, “${name}”, for their online store listing.`,
    description ? `The owner’s description: “${description}”` : null,
    service && item.location ? `Where it happens: ${clean(item.location, 120)}.` : null,
    service && item.included ? `What’s included: ${clean(item.included, 300)}.` : null,
    service
      ? "Show the work or its result as the description says. Real-looking people only where the service needs them, natural and tasteful."
      : "Show the product alone as the hero, clearly and accurately as described, on a simple, uncluttered setting that fits it.",
    "Show only what the description says. Don’t invent extra items, packaging, colors or features, and never add prices or offers.",
    ...styleLines(style),
    ...(brief ? feel(brief, style.medium === "photo") : []),
    "No words, letters, logos, labels or numbers anywhere.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function itemPictureEditPrompt(item: PictureItem, change: string): string {
  return [
    `Image 1 is a picture of “${clean(item.name, 80)}”, sold by a small US business.`,
    "Make a new copy of image 1 with the change described below. Keep everything else the same: the kind of picture, the item, the light and the framing.",
    `The owner’s change: “${clean(change, MAX_PICTURE_CHANGE)}”`,
    "Don’t add words, letters, logos, prices or extra items.",
  ].join("\n");
}

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

// Practice mode: a labeled placeholder, never a picture
export function practicePicture(item: PictureItem, style: ImageStyle, change: string | null): { svg: string; width: number; height: number } {
  const size = 1024;
  const lines = [clean(item.name, 40), change ? `Change: ${clean(change, 48)}` : null].filter((line): line is string => line !== null);
  const text = lines
    .map((line, index) => `<text x="512" y="${430 + index * 64}" font-family="'Helvetica Neue', Arial, sans-serif" font-size="${index ? 30 : 48}" font-weight="${index ? 400 : 700}" fill="#1c2321" text-anchor="middle">${escape(line)}</text>`)
    .join("");
  const label = escape(`${PRACTICE_LABEL} · ${MEDIUM_WORDS[style.medium]}`.toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#f4f1ea"/><circle cx="512" cy="300" r="90" fill="#1c2321" opacity="0.08"/>${text}<rect x="152" y="640" width="720" height="56" rx="28" fill="${PRACTICE_LABEL_COLORS.pill}"/><text x="512" y="668" font-family="'Helvetica Neue', Arial, sans-serif" font-size="26" font-weight="700" fill="${PRACTICE_LABEL_COLORS.text}" text-anchor="middle" dominant-baseline="central">${label}</text></svg>`;
  return { svg, width: size, height: size };
}

export interface MakePictureInput {
  item: PictureItem;
  style: ImageStyle;
  brief: BrandBrief | null;
  // An edit: the picture to change and the owner's words
  base: { id: string; file: ImageInput } | null;
  change: string | null;
  requestKey: string;
  userKey?: string;
}

// A new picture from the description, or an edited copy of one; a request key already used returns the saved one
export async function makeItemPicture(image: ImageModel, store: PictureStore, input: MakePictureInput): Promise<string> {
  const existing = await store.findByRequest(input.requestKey);
  if (existing) return existing;
  const room = await store.room();
  if (room !== "ok") throw new OwnerFacingError(ROOM_MESSAGES[room]);

  const change = input.change ? clean(input.change, MAX_PICTURE_CHANGE) : null;
  const prompt = input.base && change ? itemPictureEditPrompt(input.item, change) : itemPicturePrompt(input.item, input.style, input.brief);
  if (!input.base && !image.generate) throw new OwnerFacingError("Making pictures isn’t turned on for SnapStart yet.");

  let result;
  try {
    result =
      input.base && change
        ? await image.edit({ instruction: prompt, images: [input.base.file], size: SIZE, format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey })
        : await image.generate!({ prompt, size: SIZE, format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey });
  } catch (error) {
    throw ownerFacing(error);
  }

  let file: { mimeType: string; data: Uint8Array; width: number; height: number };
  if (image.simulated) {
    const preview = practicePicture(input.item, input.style, change);
    file = { mimeType: "image/svg+xml", data: new TextEncoder().encode(preview.svg), width: preview.width, height: preview.height };
  } else {
    const info = result.data.byteLength <= MAX_RESULT_BYTES ? imageInfo(result.data) : null;
    if (!info) throw new OwnerFacingError("The image service sent back something that isn’t a usable picture. Nothing was saved. Try again.");
    file = { mimeType: info.type, data: result.data, width: info.width, height: info.height };
  }

  const added = await store.add({ ...file, sourceId: input.base?.id ?? null, change, prompt, model: image.model, simulated: image.simulated, requestKey: input.requestKey });
  if (!added.ok) throw new OwnerFacingError(ROOM_MESSAGES[added.reason]);
  return added.id;
}

function ownerFacing(error: unknown): unknown {
  if (!(error instanceof ImageEditError)) return error;
  if (error.code === "content_policy_violation") return new OwnerFacingError("The image service wouldn’t make this one. Try different words in the description.");
  if (error.timedOut) return new OwnerFacingError("That took too long, and nothing was saved. Try again.");
  if (error.status === 429) return new OwnerFacingError("The image service is busy. Wait a minute, then try again. Nothing was saved.");
  if (error.retryable) return new OwnerFacingError("The image service had a problem, and nothing was saved. Try again in a minute.");
  return error;
}
