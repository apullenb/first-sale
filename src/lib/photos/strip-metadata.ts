import { sniffType } from "@/lib/documents/upload";
import { imageInfo } from "./image-info";

// A copy for publishing without hidden details like camera, time and place; the picture itself is untouched.
// A file that can't be read is returned as it is: uploads were already checked as pictures.

export function withoutMetadata(bytes: Uint8Array): Uint8Array {
  const type = sniffType(bytes);
  if (type === "image/png") return png(bytes) ?? bytes;
  if (type === "image/jpeg") return jpeg(bytes) ?? bytes;
  if (type === "image/webp") return webp(bytes) ?? bytes;
  return bytes;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const ascii = (b: Uint8Array, i: number, length: number) => String.fromCharCode(...b.subarray(i, i + length));

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// Text, time and EXIF chunks
const PNG_DROP = new Set(["tEXt", "iTXt", "zTXt", "eXIf", "tIME"]);

function png(b: Uint8Array): Uint8Array | null {
  const parts = [b.subarray(0, 8)];
  let at = 8;
  while (at + 12 <= b.length) {
    const type = ascii(b, at + 4, 4);
    const end = at + 12 + u32be(b, at);
    if (end > b.length) return null;
    if (!PNG_DROP.has(type)) parts.push(b.subarray(at, end));
    at = end;
    if (type === "IEND") return join(parts);
  }
  return null;
}

// EXIF and XMP (APP1), Photoshop details (APP13) and comments go; color profiles (APP2) and Adobe color (APP14) stay
const JPEG_DROP = new Set([0xe1, 0xed, 0xfe]);

function jpeg(b: Uint8Array): Uint8Array | null {
  const orientation = imageInfo(b)?.orientation ?? null;
  // Only the turn is kept, so a phone photo isn't shown sideways; it goes after the JFIF header when there is one
  let turn = orientation && orientation !== 1 ? orientationSegment(orientation) : null;
  const parts = [b.subarray(0, 2)];
  let at = 2;
  while (at + 4 <= b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1];
    if (turn && marker !== 0xe0) {
      parts.push(turn);
      turn = null;
    }
    // Start of the image data, or its end: everything after is the picture
    if (marker === 0xda || marker === 0xd9) {
      parts.push(b.subarray(at));
      return join(parts);
    }
    const end = at + 2 + u16be(b, at + 2);
    if (end > b.length) return null;
    if (!JPEG_DROP.has(marker)) parts.push(b.subarray(at, end));
    at = end;
  }
  return null;
}

function orientationSegment(orientation: number): Uint8Array {
  // "Exif", a big-endian TIFF header, one entry (0x0112, short) and no next directory
  const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0];
  return new Uint8Array([0xff, 0xe1, 0, payload.length + 2, ...payload]);
}

function webp(b: Uint8Array): Uint8Array | null {
  if (b.length < 12) return null;
  const parts: Uint8Array[] = [];
  let at = 12;
  while (at + 8 <= b.length) {
    const type = ascii(b, at, 4);
    const size = u32le(b, at + 4);
    const end = at + 8 + size + (size % 2);
    if (at + 8 + size > b.length) return null;
    const chunk = b.slice(at, Math.min(end, b.length));
    // Flags say which extra chunks follow: clear EXIF (0x08) and XMP (0x04)
    if (type === "VP8X" && chunk.length > 8) chunk[8] &= ~0x0c;
    if (type !== "EXIF" && type !== "XMP ") parts.push(chunk);
    at = end;
  }
  const body = join(parts);
  const header = new Uint8Array(12);
  header.set(b.subarray(0, 12));
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return join([header, body]);
}
