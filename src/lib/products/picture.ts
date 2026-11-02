import { ImageEditError, type ImageInput, type ImageModel } from "@/lib/ai";
import { feel } from "@/lib/brand/prompts";
import { MEDIUM_WORDS, PRACTICE_LABEL, PRACTICE_LABEL_COLORS } from "@/lib/brand/practice";
import type { ImageStyle } from "@/lib/brand/image-style";
import type { BrandBrief } from "@/lib/brand/types";
import { OwnerFacingError } from "@/lib/errors";
import { imageInfo } from "@/lib/photos/image-info";
import { KEEP_PRODUCT } from "@/lib/photos/instructions";
import { type PictureView, VIEW_LABELS, type Wearer } from "@/lib/rules/picture-views";
import type { ItemKind } from "@/lib/rules/products";

// An item's picture set, made in the brand's image style: a main photo from the description or the owner's photo, then
// extra views made from the approved main so the item stays identical. Saved only once the bytes check out.

export const MAX_PICTURE_CHANGE = 300;
export const PICTURES_PER_ITEM = 24;
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
  view: PictureView;
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
  too_many: `Each item keeps up to ${PICTURES_PER_ITEM} pictures. Remove pictures you’re not using, then try again.`,
} as const;

const clean = (text: string, max: number) => text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const NO_TEXT = "No words, letters, logos, labels or numbers added anywhere, and nothing added to the item itself.";

function styleLines(style: ImageStyle): string[] {
  if (style.medium === "illustration") {
    return ["Style: a polished, flat illustration with simple shapes and motifs, in the brand’s drawing style.", "No 3D, gradients or drop shadows, and no photos."];
  }
  return [
    `Style: a photorealistic, professionally styled photograph: ${style.light}, real textures and materials.`,
    style.lively ? "Bright, punchy and colorful, but still a real photograph." : null,
    "Not an illustration, cartoon, flat vector art or 3D render. No collage, frames or borders.",
  ].filter((line): line is string => line !== null);
}

function about(item: PictureItem): string[] {
  const description = clean(item.description, 300);
  return [
    description ? `The owner’s description: “${description}”` : null,
    item.kind === "service" && item.location ? `Where it happens: ${clean(item.location, 120)}.` : null,
    item.kind === "service" && item.included ? `What’s included: ${clean(item.included, 300)}.` : null,
  ].filter((line): line is string => line !== null);
}

const MAIN_SCENE: Record<ItemKind, string> = {
  product: "The product alone, centered on a plain, clean white or light neutral background, with even, soft light and a natural contact shadow. No props, no hands, no text.",
  service: "A clean, professional photo of the finished result of the work, or of the place where the service happens, as a customer would see it. Not an object on a plain background. No text.",
};

// Products keep the product photo rules; a service keeps the work shown in image 1
const keepLines = (kind: ItemKind) =>
  kind === "product"
    ? KEEP_PRODUCT.map((rule) => `- ${rule}`)
    : ["- Keep the work shown in image 1 the same: its result, materials, colors and setting. Don’t invent a different result or make it look better than it is."];

const WEARER_WORDS: Record<Wearer, string> = { women: "a woman", men: "a man", kids: "a child", anyone: "an adult" };

// What each extra view shows; the in-use view of something worn shows the person it's for
export function viewScene(kind: ItemKind, view: Exclude<PictureView, "main">, wearer: Wearer | null): string {
  if (kind === "service") {
    return {
      angle: "The same service in progress: hands doing the work in the same setting, natural and tasteful.",
      detail: "A close-up of a detail of the finished result, or a before-and-after side by side, showing the care in the work.",
      in_use: "The person doing the work with a customer, natural and not posed. Show people generically: no particular gender, age or look unless the description says.",
    }[view];
  }
  return {
    angle: "The same product from a different angle, such as its side, back or a three-quarter view, on the same plain background and light.",
    detail: "A close-up of one detail of the same product, such as its texture, finish, stitching or label, on the same plain background.",
    in_use: wearer
      ? `The product worn by ${WEARER_WORDS[wearer]}, the way it’s naturally worn, in a simple real-life setting. The person is natural and not the focus.`
      : "The product in use, the way it’s naturally used, in a real setting that fits it, such as a cutting board on a kitchen counter with food, a blanket draped on a sofa, or a mug in a hand at a table.",
  }[view];
}

// A main photo from the description alone
export function mainPrompt(item: PictureItem, style: ImageStyle, brief: BrandBrief | null): string {
  const name = clean(item.name, 80);
  return [
    item.kind === "service" ? `Make the main picture for a small US business’s service, “${name}”, for their listing.` : `Make the main photo of one product a small US business sells, “${name}”, for their online store.`,
    ...about(item),
    MAIN_SCENE[item.kind],
    "Show only what the description says. Don’t invent extra items, packaging, colors or features, and never add prices or offers.",
    ...styleLines(style),
    ...(brief ? feel(brief, style.medium === "photo") : []),
    NO_TEXT,
  ].join("\n");
}

// A main photo from the owner's own photo (image 1), with the product rules from product photos
export function mainFromPhotoPrompt(item: PictureItem, style: ImageStyle): string {
  return [
    item.kind === "service" ? `Image 1 is the owner’s own photo of their work for “${clean(item.name, 80)}”, a service their small US business offers. Make its main listing photo from it.` : `Image 1 is the owner’s own photo of “${clean(item.name, 80)}”, which their small US business sells. Make its main store photo.`,
    ...keepLines(item.kind),
    MAIN_SCENE[item.kind],
    ...styleLines(style),
    NO_TEXT,
  ].join("\n");
}

// An extra view: image 1 is the approved main photo, the only reference for the item
export function viewPrompt(item: PictureItem, view: Exclude<PictureView, "main">, style: ImageStyle, wearer: Wearer | null): string {
  return [
    `Image 1 is the approved main photo of “${clean(item.name, 80)}”, sold by a small US business. Make a new picture of the very same ${item.kind === "service" ? "work" : "product"}: ${VIEW_LABELS[item.kind][view].toLowerCase()}.`,
    ...keepLines(item.kind),
    ...about(item),
    viewScene(item.kind, view, wearer),
    ...styleLines(style),
    NO_TEXT,
  ].join("\n");
}

// A change in the owner's words: image 1 the picture, image 2 the approved main it must still match
export function changePrompt(item: PictureItem, change: string, withMain: boolean): string {
  return [
    `Image 1 is a picture of “${clean(item.name, 80)}”, sold by a small US business.${withMain ? " Image 2 is its approved main photo." : ""}`,
    "Make a new copy of image 1 with the change described below. Keep everything else the same: the kind of picture, the item, the light and the framing.",
    withMain ? "The item must look exactly as in image 2: the same shape, colors, materials, label and details." : null,
    `The owner’s change: “${clean(change, MAX_PICTURE_CHANGE)}”`,
    "The change can touch the setting, light, props and framing, never the item itself.",
    NO_TEXT,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

// Practice mode: a labeled placeholder for each view, never a picture
export function practicePicture(item: PictureItem, view: PictureView, style: ImageStyle, change: string | null): { svg: string; width: number; height: number } {
  const size = 1024;
  const lines = [clean(item.name, 40), VIEW_LABELS[item.kind][view], change ? `Change: ${clean(change, 48)}` : null].filter((line): line is string => line !== null);
  const text = lines
    .map((line, index) => `<text x="512" y="${400 + index * 60}" font-family="'Helvetica Neue', Arial, sans-serif" font-size="${index ? 30 : 48}" font-weight="${index ? 400 : 700}" fill="#1c2321" text-anchor="middle">${escape(line)}</text>`)
    .join("");
  const label = escape(`${PRACTICE_LABEL} · ${MEDIUM_WORDS[style.medium]}`.toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#f4f1ea"/><circle cx="512" cy="270" r="90" fill="#1c2321" opacity="0.08"/>${text}<rect x="152" y="660" width="720" height="56" rx="28" fill="${PRACTICE_LABEL_COLORS.pill}"/><text x="512" y="688" font-family="'Helvetica Neue', Arial, sans-serif" font-size="26" font-weight="700" fill="${PRACTICE_LABEL_COLORS.text}" text-anchor="middle" dominant-baseline="central">${label}</text></svg>`;
  return { svg, width: size, height: size };
}

export interface MakePictureInput {
  item: PictureItem;
  view: PictureView;
  style: ImageStyle;
  brief: BrandBrief | null;
  // Extra views: the approved main photo
  main: ImageInput | null;
  // A main photo made from the owner's own photo
  photo: ImageInput | null;
  // A change: the picture to change and the owner's words
  base: { id: string; file: ImageInput } | null;
  change: string | null;
  wearer: Wearer | null;
  requestKey: string;
  userKey?: string;
}

// What to send for this picture: the prompt and the images, in order
export function pictureRequest(input: Omit<MakePictureInput, "requestKey" | "userKey">): { prompt: string; images: ImageInput[] } {
  const change = input.change ? clean(input.change, MAX_PICTURE_CHANGE) : null;
  if (input.base && change) {
    const main = input.view !== "main" ? input.main : null;
    return { prompt: changePrompt(input.item, change, Boolean(main)), images: main ? [input.base.file, main] : [input.base.file] };
  }
  if (input.view !== "main") {
    if (!input.main) throw new OwnerFacingError("Approve a main photo first. The other views are made from it.");
    return { prompt: viewPrompt(input.item, input.view, input.style, input.wearer), images: [input.main] };
  }
  if (input.photo) return { prompt: mainFromPhotoPrompt(input.item, input.style), images: [input.photo] };
  return { prompt: mainPrompt(input.item, input.style, input.brief), images: [] };
}

// A request key already used returns the saved picture instead of paying again
export async function makeItemPicture(image: ImageModel, store: PictureStore, input: MakePictureInput): Promise<string> {
  const existing = await store.findByRequest(input.requestKey);
  if (existing) return existing;
  const room = await store.room();
  if (room !== "ok") throw new OwnerFacingError(ROOM_MESSAGES[room]);

  const { prompt, images } = pictureRequest(input);
  if (!images.length && !image.generate) throw new OwnerFacingError("Making pictures isn’t turned on for SnapStart yet.");
  let result;
  try {
    result = images.length
      ? await image.edit({ instruction: prompt, images, size: SIZE, format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey })
      : await image.generate!({ prompt, size: SIZE, format: "png", timeoutMs: IMAGE_TIMEOUT_MS, userKey: input.userKey });
  } catch (error) {
    throw ownerFacing(error);
  }

  const change = input.base && input.change ? clean(input.change, MAX_PICTURE_CHANGE) : null;
  let file: { mimeType: string; data: Uint8Array; width: number; height: number };
  if (image.simulated) {
    const preview = practicePicture(input.item, input.view, input.style, change);
    file = { mimeType: "image/svg+xml", data: new TextEncoder().encode(preview.svg), width: preview.width, height: preview.height };
  } else {
    const info = result.data.byteLength <= MAX_RESULT_BYTES ? imageInfo(result.data) : null;
    if (!info) throw new OwnerFacingError("The image service sent back something that isn’t a usable picture. Nothing was saved. Try again.");
    file = { mimeType: info.type, data: result.data, width: info.width, height: info.height };
  }

  const added = await store.add({ ...file, view: input.view, sourceId: input.base?.id ?? null, change, prompt, model: image.model, simulated: image.simulated, requestKey: input.requestKey });
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
