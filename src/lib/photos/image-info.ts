import { sniffType } from "@/lib/documents/upload";

// Pixel size and orientation read from the file's header, without decoding the image

export type PhotoType = "image/png" | "image/jpeg" | "image/webp";

export interface ImageInfo {
  type: PhotoType;
  width: number;
  height: number;
  // EXIF orientation of a JPEG; 1 means upright, null when there's none
  orientation: number | null;
}

export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  const type = sniffType(bytes);
  if (type === "image/png") return png(bytes);
  if (type === "image/jpeg") return jpeg(bytes);
  if (type === "image/webp") return webp(bytes);
  return null;
}

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, length: number) => String.fromCharCode(...b.subarray(i, i + length));

function sized(type: PhotoType, width: number, height: number, orientation: number | null = null): ImageInfo | null {
  return width > 0 && height > 0 ? { type, width, height, orientation } : null;
}

function png(b: Uint8Array): ImageInfo | null {
  if (b.length < 24 || ascii(b, 12, 4) !== "IHDR") return null;
  return sized("image/png", u32be(b, 16), u32be(b, 20));
}

// Start-of-frame markers carry the size; C4, C8 and CC are other tables
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpeg(b: Uint8Array): ImageInfo | null {
  let orientation: number | null = null;
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    if (marker === 0xe1 && orientation === null) orientation = exifOrientation(b.subarray(i + 4, i + 2 + length));
    if (SOF.has(marker)) {
      if (i + 9 > b.length) return null;
      return sized("image/jpeg", u16be(b, i + 7), u16be(b, i + 5), orientation);
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    i += 2 + length;
  }
  return null;
}

function exifOrientation(segment: Uint8Array): number | null {
  if (segment.length < 14 || ascii(segment, 0, 6) !== "Exif\0\0") return null;
  const tiff = segment.subarray(6);
  const little = ascii(tiff, 0, 2) === "II";
  if (!little && ascii(tiff, 0, 2) !== "MM") return null;
  const read16 = (at: number) => (little ? u16le(tiff, at) : u16be(tiff, at));
  const read32 = (at: number) => (little ? (u16le(tiff, at) | (u16le(tiff, at + 2) << 16)) >>> 0 : u32be(tiff, at));
  const ifd = read32(4);
  if (ifd + 2 > tiff.length) return null;
  const count = read16(ifd);
  for (let entry = 0; entry < count; entry++) {
    const at = ifd + 2 + entry * 12;
    if (at + 12 > tiff.length) return null;
    if (read16(at) === 0x0112) return read16(at + 8);
  }
  return null;
}

function webp(b: Uint8Array): ImageInfo | null {
  if (b.length < 30) return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") {
    // Lossy: a key frame's start code, then 14-bit width and height
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return sized("image/webp", u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    return sized("image/webp", (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8X") return sized("image/webp", u24le(b, 24) + 1, u24le(b, 27) + 1);
  return null;
}

// Animated PNG (an acTL chunk before the image data) or animated WebP (the VP8X animation flag)
export function isAnimated(bytes: Uint8Array): boolean {
  const type = sniffType(bytes);
  if (type === "image/png") {
    let at = 8;
    while (at + 8 <= bytes.length) {
      const chunk = ascii(bytes, at + 4, 4);
      if (chunk === "acTL") return true;
      if (chunk === "IDAT" || chunk === "IEND") return false;
      at += 12 + u32be(bytes, at);
    }
    return false;
  }
  if (type === "image/webp") return bytes.length > 20 && ascii(bytes, 12, 4) === "VP8X" && (bytes[20] & 0x02) !== 0;
  return false;
}
