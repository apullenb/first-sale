import { crc32, deflateSync } from "node:zlib";
import type { ImageModel } from "../image-types";

// Practice mode: no image service. Hands back the first image unchanged, so nothing invented is ever shown as an edit.
export function createMockImageProvider(): ImageModel {
  return {
    name: "Practice preview",
    model: "practice-preview",
    simulated: true,
    async edit(request) {
      const first = request.images[0];
      if (!first) throw new Error("An image edit needs at least one image");
      return { data: first.data.slice(), format: null };
    },
    // A blank image in the requested shape: a placeholder, never a picture
    async generate(request) {
      const [width, height] = placeholderSize(request.size);
      return { data: blankPng(width, height), format: "png" };
    },
  };
}

function placeholderSize(size: string | undefined): [number, number] {
  const match = /^(\d+)x(\d+)$/.exec(size ?? "");
  const [w, h] = match ? [Number(match[1]), Number(match[2])] : [1, 1];
  if (!w || !h) return [1024, 1024];
  return w >= h ? [1024, Math.max(1, Math.round((1024 * h) / w))] : [Math.max(1, Math.round((1024 * w) / h)), 1024];
}

// Flat light gray PNG
function blankPng(width: number, height: number): Uint8Array {
  const row = Buffer.alloc(1 + width * 3, 0xec);
  row[0] = 0;
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
