import "server-only";
import sharp from "sharp";
import { OwnerFacingError } from "@/lib/errors";
import { checkFrame, framePlanFor } from "./frame";
import { IMAGE_SPECS } from "./sizes";
import type { BrandImageKind } from "./types";

// Brand images are cropped and resized here to their exact final size, so the drawn safe area lands on the platform's.

const LIMIT = { limitInputPixels: 50_000_000, pages: 1 } as const;

export interface Fitted {
  mimeType: "image/jpeg";
  data: Uint8Array;
  width: number;
  height: number;
  note: string;
}

export async function fitBrandImage(kind: BrandImageKind, bytes: Uint8Array): Promise<Fitted> {
  const { final } = IMAGE_SPECS[kind];
  // Upright first, so the crop works on what's seen
  const upright = await sharp(bytes, LIMIT).rotate().png().toBuffer({ resolveWithObject: true });
  const plan = framePlanFor(kind, { width: upright.info.width, height: upright.info.height });
  const { crop, pad } = plan;
  let source: Buffer = upright.data;
  if (pad.left || pad.top || pad.right || pad.bottom) {
    source = await sharp(source).extend({ ...pad, extendWith: "mirror" }).png().toBuffer();
  }
  const out = await sharp(source, LIMIT)
    .extract({ left: crop.left + pad.left, top: crop.top + pad.top, width: crop.width, height: crop.height })
    .resize(final.width, final.height, { fit: "fill" })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const problems = checkFrame(kind, { width: out.info.width, height: out.info.height }, plan);
  if (problems.length) throw new OwnerFacingError("The picture couldn’t be made at the right size, and nothing was saved. Try again.");
  const padded = pad.left || pad.top || pad.right || pad.bottom;
  return {
    mimeType: "image/jpeg",
    data: new Uint8Array(out.data),
    width: out.info.width,
    height: out.info.height,
    note: `Cropped and resized in code to exactly ${final.width} × ${final.height}${padded ? ", with the edges extended to keep the safe area" : ""}.`,
  };
}
