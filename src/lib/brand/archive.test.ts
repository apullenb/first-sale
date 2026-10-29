import { describe, expect, it } from "vitest";
import { pngBytes } from "@/lib/photos/test-images";
import { crc32, icoFromPngs, zipFiles } from "./archive";

describe("favicon.ico", () => {
  it("holds each PNG with its size, and 256 written as 0", () => {
    const small = pngBytes(16, 16);
    const big = pngBytes(256, 256);
    const ico = icoFromPngs([
      { size: 16, png: small },
      { size: 256, png: big },
    ]);
    const view = new DataView(ico.buffer);
    expect([view.getUint16(0, true), view.getUint16(2, true), view.getUint16(4, true)]).toEqual([0, 1, 2]);
    expect([ico[6], ico[7], ico[22], ico[23]]).toEqual([16, 16, 0, 0]);
    const offset = view.getUint32(6 + 12, true);
    expect(view.getUint32(6 + 8, true)).toBe(small.byteLength);
    expect(ico.slice(offset, offset + small.byteLength)).toEqual(small);
    expect(ico.byteLength).toBe(6 + 32 + small.byteLength + big.byteLength);
  });
});

describe("the kit zip", () => {
  it("uses the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("stores each file where its central directory entry says, with UTF-8 names", () => {
    const files = [
      { name: "Mia’s Café - logo.png", data: pngBytes(4, 4) },
      { name: "Which file to use.txt", data: new TextEncoder().encode("hello") },
    ];
    const zip = zipFiles(files, new Date(2026, 9, 28, 12, 30, 10));
    const view = new DataView(zip.buffer);
    const end = zip.byteLength - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    let central = view.getUint32(end + 16, true);
    for (const file of files) {
      expect(view.getUint32(central, true)).toBe(0x02014b50);
      const nameLength = view.getUint16(central + 28, true);
      expect(new TextDecoder().decode(zip.slice(central + 46, central + 46 + nameLength))).toBe(file.name);
      expect(view.getUint32(central + 16, true)).toBe(crc32(file.data));
      const local = view.getUint32(central + 42, true);
      expect(view.getUint32(local, true)).toBe(0x04034b50);
      const start = local + 30 + view.getUint16(local + 26, true);
      expect(zip.slice(start, start + file.data.byteLength)).toEqual(file.data);
      central += 46 + nameLength;
    }
  });
});
