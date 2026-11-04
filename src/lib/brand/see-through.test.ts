import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { seeThroughPng } from "./see-through";

async function logo(background: (x: number, y: number) => [number, number, number]) {
  const width = 200;
  const height = 100;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = x >= 80 && x < 120 && y >= 30 && y < 70;
      data.set(inside ? [200, 30, 30] : background(x, y), (y * width + x) * 3);
    }
  }
  return new Uint8Array(await sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer());
}

describe("seeThroughPng", () => {
  it("removes a plain background and trims to the artwork", async () => {
    const png = await seeThroughPng(await logo(() => [255, 255, 255]));
    const { data, info } = await sharp(png!).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    // 40 px square plus 6% margin each side
    expect(info.width).toBe(40 + 2 * 2);
    expect(data[3]).toBe(0);
    const middle = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4;
    expect([...data.subarray(middle, middle + 4)]).toEqual([200, 30, 30, 255]);
  });

  it("gives up on a busy background", async () => {
    expect(await seeThroughPng(await logo((x, y) => [(x * 37) % 256, (y * 91) % 256, (x * y) % 256]))).toBeNull();
  });
});
