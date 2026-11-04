import "server-only";
import sharp from "sharp";
import { contentBox, knockOut, placement } from "./pixels";

// Large enough for any website header, small enough to clear quickly on each request
const MAX_SIDE = 1600;
// Empty space left round the artwork, as in the kit's see-through file
const MARGIN = 0.06;

// The logo as a PNG with its plain background removed and trimmed to the artwork; null when that can't be done reliably
export async function seeThroughPng(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: 50_000_000, pages: 1 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const clear = knockOut({ data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height });
    const box = clear && contentBox(clear);
    if (!clear || !box) return null;
    const placed = placement(box, null, MARGIN);
    const pad = placed.draw.x;
    const png = await sharp(Buffer.from(clear.data.buffer, clear.data.byteOffset, clear.data.byteLength), { raw: { width: clear.width, height: clear.height, channels: 4 } })
      .extract({ left: box.x, top: box.y, width: box.width, height: box.height })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    return new Uint8Array(png);
  } catch {
    return null;
  }
}
