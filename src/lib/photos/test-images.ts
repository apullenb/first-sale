import { crc32, deflateSync } from "node:zlib";

// Small, real image files for tests

export function pngBytes(width: number, height: number, shade = 128): Uint8Array {
  const row = Buffer.alloc(1 + width * 3, shade);
  row[0] = 0;
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
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
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

// Just the markers a reader needs: start, an optional EXIF orientation, and the frame size
export function jpegHeader(width: number, height: number, orientation: number | null = null): Uint8Array {
  const parts: number[] = [0xff, 0xd8];
  if (orientation !== null) {
    const tiff = [0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, 0, 0, 0, 0];
    const segment = [...Buffer.from("Exif\0\0", "binary"), ...tiff];
    parts.push(0xff, 0xe1, (segment.length + 2) >> 8, (segment.length + 2) & 0xff, ...segment);
  }
  parts.push(0xff, 0xc0, 0, 17, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1);
  parts.push(0xff, 0xd9);
  return new Uint8Array(parts);
}

export function webpHeader(kind: "VP8 " | "VP8L" | "VP8X", width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40);
  bytes.set(Buffer.from("RIFF"), 0);
  bytes.set(Buffer.from("WEBP"), 8);
  bytes.set(Buffer.from(kind), 12);
  if (kind === "VP8 ") {
    bytes.set([0x9d, 0x01, 0x2a], 23);
    bytes.set([width & 0xff, width >> 8, height & 0xff, height >> 8], 26);
  } else if (kind === "VP8L") {
    const bits = ((width - 1) | ((height - 1) << 14)) >>> 0;
    bytes.set([0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff], 20);
  } else {
    const w = width - 1;
    const h = height - 1;
    bytes.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 24);
  }
  return bytes;
}
