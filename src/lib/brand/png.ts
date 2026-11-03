import { deflateSync, inflateSync } from "node:zlib";
import type { Pixels } from "./pixels";

// Just enough PNG to fix generated logo files on the server: 8-bit, not interlaced, read to RGBA and written back.

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function predict(filter: number, left: number, up: number, corner: number): number {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return (left + up) >> 1;
    case 4:
      return paeth(left, up, corner);
    default:
      return -1;
  }
}

// Null for anything else: other bit depths, interlacing or a broken file
export function decodePng(bytes: Uint8Array): Pixels | null {
  try {
    if (!SIGNATURE.every((value, index) => bytes[index] === value)) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let width = 0;
    let height = 0;
    let type = -1;
    let palette: Uint8Array | null = null;
    let transparency: Uint8Array | null = null;
    const idat: Uint8Array[] = [];
    for (let at = 8; at + 8 <= bytes.length; ) {
      const length = view.getUint32(at);
      const name = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
      const data = bytes.subarray(at + 8, at + 8 + length);
      if (name === "IHDR") {
        width = view.getUint32(at + 8);
        height = view.getUint32(at + 12);
        type = data[9];
        if (data[8] !== 8 || data[12] !== 0 || !(type in CHANNELS)) return null;
      } else if (name === "PLTE") palette = data;
      else if (name === "tRNS") transparency = data;
      else if (name === "IDAT") idat.push(data);
      else if (name === "IEND") break;
      at += 12 + length;
    }
    if (!width || !height || (type === 3 && !palette)) return null;
    const channels = CHANNELS[type];
    const stride = width * channels;
    const raw = inflateSync(Buffer.concat(idat));
    if (raw.length < (stride + 1) * height) return null;
    const rows = new Uint8Array(stride * height);
    for (let y = 0; y < height; y++) {
      const filter = raw[y * (stride + 1)];
      const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let x = 0; x < stride; x++) {
        const left = x >= channels ? rows[y * stride + x - channels] : 0;
        const up = y ? rows[(y - 1) * stride + x] : 0;
        const corner = y && x >= channels ? rows[(y - 1) * stride + x - channels] : 0;
        const guess = predict(filter, left, up, corner);
        if (guess < 0) return null;
        rows[y * stride + x] = (line[x] + guess) & 255;
      }
    }
    const data = new Uint8ClampedArray(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel++) {
      const source = rows.subarray(pixel * channels, pixel * channels + channels);
      const out = pixel * 4;
      if (type === 3) {
        const index = source[0];
        data.set(palette!.subarray(index * 3, index * 3 + 3), out);
        data[out + 3] = transparency && index < transparency.length ? transparency[index] : 255;
      } else if (type === 0 || type === 4) {
        data.fill(source[0], out, out + 3);
        data[out + 3] = type === 4 ? source[1] : 255;
      } else {
        data.set(source.subarray(0, 3), out);
        data[out + 3] = type === 6 ? source[3] : 255;
      }
    }
    return { data, width, height };
  } catch {
    return null;
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(name: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(Array.from(name, (char) => char.charCodeAt(0)), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

// RGB when every pixel is opaque, otherwise RGBA; each row gets the filter that packs it smallest
export function encodePng(image: Pixels): Uint8Array {
  const { data, width, height } = image;
  let opaque = true;
  for (let index = 3; index < data.length && opaque; index += 4) opaque = data[index] === 255;
  const channels = opaque ? 3 : 4;
  const stride = width * channels;
  const rows = new Uint8Array(stride * height);
  for (let pixel = 0; pixel < width * height; pixel++) {
    for (let channel = 0; channel < channels; channel++) rows[pixel * channels + channel] = data[pixel * 4 + channel];
  }
  const raw = new Uint8Array((stride + 1) * height);
  const candidate = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    let best = 0;
    let bestScore = Infinity;
    for (let filter = 0; filter < 5; filter++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const value = rows[y * stride + x];
        const left = x >= channels ? rows[y * stride + x - channels] : 0;
        const up = y ? rows[(y - 1) * stride + x] : 0;
        const corner = y && x >= channels ? rows[(y - 1) * stride + x - channels] : 0;
        const out = (value - predict(filter, left, up, corner)) & 255;
        score += out < 128 ? out : 256 - out;
      }
      if (score < bestScore) {
        bestScore = score;
        best = filter;
      }
    }
    raw[y * (stride + 1)] = best;
    for (let x = 0; x < stride; x++) {
      const value = rows[y * stride + x];
      const left = x >= channels ? rows[y * stride + x - channels] : 0;
      const up = y ? rows[(y - 1) * stride + x] : 0;
      const corner = y && x >= channels ? rows[(y - 1) * stride + x - channels] : 0;
      candidate[x] = (value - predict(best, left, up, corner)) & 255;
    }
    raw.set(candidate, y * (stride + 1) + 1);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, opaque ? 2 : 6, 0, 0, 0], 8);
  const parts = [Uint8Array.from(SIGNATURE), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
