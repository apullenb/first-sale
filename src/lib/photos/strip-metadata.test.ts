import { describe, expect, it } from "vitest";
import { imageInfo } from "./image-info";
import { withoutMetadata } from "./strip-metadata";
import { jpegHeader, pngBytes, webpHeader } from "./test-images";

const has = (bytes: Uint8Array, text: string) => Buffer.from(bytes).includes(Buffer.from(text, "binary"));

describe("withoutMetadata", () => {
  it("drops a PNG's text and EXIF chunks and keeps the picture", () => {
    const png = pngBytes(40, 20);
    const text = Buffer.from("GPS 30.2672 -97.7431", "binary");
    const chunk = new Uint8Array([0, 0, 0, text.length, ...Buffer.from("tEXt"), ...text, 0, 0, 0, 0]);
    const iend = png.length - 12;
    const tagged = new Uint8Array([...png.subarray(0, iend), ...chunk, ...png.subarray(iend)]);
    const clean = withoutMetadata(tagged);
    expect(has(tagged, "GPS")).toBe(true);
    expect(has(clean, "GPS")).toBe(false);
    expect(clean).toEqual(png);
  });

  it("drops a JPEG's EXIF but keeps its turn, so it isn't shown sideways", () => {
    const header = jpegHeader(300, 200, 6);
    const gps = [0xff, 0xe1, 0, 12, ...Buffer.from("Exif\0\0GPS1", "binary")];
    const scan = [0xff, 0xda, 0, 4, 1, 2, 0xab, 0xcd, 0xff, 0xd9];
    const tagged = new Uint8Array([...header.subarray(0, 2), ...gps, ...header.subarray(2, header.length - 2), ...scan]);
    const clean = withoutMetadata(tagged);
    expect(has(clean, "GPS")).toBe(false);
    expect(imageInfo(clean)).toMatchObject({ width: 300, height: 200, orientation: 6 });
    expect(Buffer.from(clean).subarray(-10)).toEqual(Buffer.from(scan));
  });

  it("drops a WebP's EXIF chunk, clears its flag and fixes the file size", () => {
    // RIFF header and a 10-byte VP8X chunk saying an EXIF chunk follows
    const base = webpHeader("VP8X", 64, 32).slice(0, 30);
    base[16] = 10;
    base[20] = 0x08;
    const exif = new Uint8Array([...Buffer.from("EXIF"), 4, 0, 0, 0, ...Buffer.from("GPS!")]);
    const tagged = new Uint8Array([...base, ...exif]);
    new DataView(tagged.buffer).setUint32(4, tagged.length - 8, true);
    const clean = withoutMetadata(tagged);
    expect(has(clean, "GPS")).toBe(false);
    expect(clean[20] & 0x08).toBe(0);
    expect(new DataView(clean.buffer).getUint32(4, true)).toBe(clean.length - 8);
    expect(imageInfo(clean)).toMatchObject({ width: 64, height: 32 });
  });

  it("returns other files unchanged", () => {
    const text = new TextEncoder().encode("hello");
    expect(withoutMetadata(text)).toBe(text);
  });
});
