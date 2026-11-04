import "server-only";
import sharp from "sharp";
import { OwnerFacingError } from "@/lib/errors";
import { checkFrame, extended, framePlanFor } from "./frame";
import { IMAGE_SPECS } from "./sizes";
import type { BrandImageKind } from "./types";

// Brand images are placed here at their exact final size: the drawn picture fills the visible area,
// and a blurred, slightly dimmed copy of it fills the rest of the file. Never mirrored.

const LIMIT = { limitInputPixels: 50_000_000, pages: 1 } as const;
// The soft extension is blurred small, then scaled up: fast and smooth
const SOFT_SCALE = 16;

export interface Fitted {
  mimeType: "image/jpeg";
  data: Uint8Array;
  width: number;
  height: number;
  note: string;
}

// The picture scaled to cover the whole file, heavily blurred, a little darker and less colorful
async function softExtension(picture: Buffer, final: { width: number; height: number }): Promise<Buffer> {
  const small = await sharp(picture)
    .resize(Math.max(1, Math.round(final.width / SOFT_SCALE)), Math.max(1, Math.round(final.height / SOFT_SCALE)), { fit: "cover" })
    .blur(3)
    .modulate({ brightness: 0.85, saturation: 0.75 })
    .png()
    .toBuffer();
  return sharp(small).resize(final.width, final.height, { fit: "fill" }).blur(2).png().toBuffer();
}

export async function fitBrandImage(kind: BrandImageKind, bytes: Uint8Array): Promise<Fitted> {
  const { final } = IMAGE_SPECS[kind];
  // Upright first, so the placement works on what's seen
  const upright = await sharp(bytes, LIMIT).rotate().png().toBuffer({ resolveWithObject: true });
  const plan = framePlanFor(kind, { width: upright.info.width, height: upright.info.height });
  const { crop, pad, picture } = plan;
  const shown = await sharp(upright.data, LIMIT)
    .extract({ left: crop.left + pad.left, top: crop.top + pad.top, width: crop.width - pad.left - pad.right, height: crop.height - pad.top - pad.bottom })
    .png()
    .toBuffer();
  const sharpPart = await sharp(shown).resize(picture.width, picture.height, { fit: "fill" }).png().toBuffer();
  const soft = extended(plan, final);
  const placed = soft ? await sharp(await softExtension(shown, final)).composite([{ input: sharpPart, left: picture.left, top: picture.top }]).png().toBuffer() : sharpPart;
  const out = await sharp(placed).flatten({ background: "#ffffff" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true });

  const problems = checkFrame(kind, { width: out.info.width, height: out.info.height }, plan);
  if (problems.length) throw new OwnerFacingError("The picture couldn’t be made at the right size, and nothing was saved. Try again.");
  return {
    mimeType: "image/jpeg",
    data: new Uint8Array(out.data),
    width: out.info.width,
    height: out.info.height,
    note: `Placed in code at exactly ${final.width} × ${final.height}${soft ? ", with the picture extended softly past the part screens show" : ""}.`,
  };
}

// The part of a finished file screens show, so an edit starts from the drawn picture, not the soft extension
export async function visiblePart<T extends { mimeType: string; data: Uint8Array }>(kind: BrandImageKind, file: T): Promise<T> {
  const { visible } = IMAGE_SPECS[kind];
  if (visible.w >= 1 && visible.h >= 1) return file;
  const upright = await sharp(file.data, LIMIT).rotate().png().toBuffer({ resolveWithObject: true });
  const { width, height } = upright.info;
  const left = Math.round(visible.x * width);
  const top = Math.round(visible.y * height);
  const out = await sharp(upright.data)
    .extract({ left, top, width: Math.min(width - left, Math.round(visible.w * width)), height: Math.min(height - top, Math.round(visible.h * height)) })
    .png()
    .toBuffer();
  return { ...file, mimeType: "image/png", data: new Uint8Array(out) };
}
