import { describe, expect, it } from "vitest";
import { clearBox, clearFrame, contentBox, knockOut, logoColors, type Pixels, oneColor, placement, plainBackground, recolor, seeThrough } from "./pixels";
import { decodePng, encodePng } from "./png";

type Rgb = [number, number, number];

// A white canvas with filled rectangles drawn on it
function canvas(width: number, height: number, background: Rgb = [255, 255, 255], shapes: { x: number; y: number; w: number; h: number; color: Rgb }[] = []): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const shape = shapes.findLast((each) => x >= each.x && x < each.x + each.w && y >= each.y && y < each.y + each.h);
      data.set([...(shape?.color ?? background), 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

const at = (image: Pixels, x: number, y: number) => Array.from(image.data.slice((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));

describe("see-through files", () => {
  // A dark ring: a counter of white inside, and a half-blended edge pixel next to the background
  const ring = canvas(40, 40, [255, 255, 255], [
    { x: 10, y: 10, w: 20, h: 20, color: [20, 40, 30] },
    { x: 16, y: 16, w: 8, h: 8, color: [255, 255, 255] },
    { x: 9, y: 20, w: 1, h: 1, color: [138, 148, 143] },
  ]);

  it("find a plain background, and refuse one that isn't", () => {
    expect(plainBackground(ring)).toEqual([255, 255, 255]);
    const busy = canvas(40, 40, [255, 255, 255], [{ x: 0, y: 0, w: 40, h: 8, color: [200, 30, 30] }]);
    expect(plainBackground(busy)).toBeNull();
    expect(knockOut(busy)).toBeNull();
  });

  it("clear the background and white inside the logo, and keep the logo's own colors solid", () => {
    const clear = knockOut(ring)!;
    expect(at(clear, 2, 2)[3]).toBe(0);
    expect(at(clear, 20, 20)[3]).toBe(0);
    expect(at(clear, 12, 12)).toEqual([20, 40, 30, 255]);
  });

  it("un-mix soft edges from the background, so they stay smooth on any color", () => {
    const edge = at(knockOut(ring)!, 9, 20);
    expect(edge[3]).toBeGreaterThan(110);
    expect(edge[3]).toBeLessThan(140);
    // About the logo's own color, not a gray halo
    expect(edge[0]).toBeLessThan(40);
  });

  it("keep light and mid-tone shapes solid right to their edges", () => {
    const orange = knockOut(canvas(30, 30, [255, 255, 255], [{ x: 8, y: 8, w: 14, h: 14, color: [243, 166, 90] }]))!;
    expect(at(orange, 8, 8)).toEqual([243, 166, 90, 255]);
    expect(at(orange, 9, 15)).toEqual([243, 166, 90, 255]);
  });

  it("work on an off-white background too", () => {
    const offWhite = canvas(30, 30, [248, 247, 244], [{ x: 10, y: 10, w: 10, h: 10, color: [200, 60, 40] }]);
    const clear = knockOut(offWhite)!;
    expect(at(clear, 1, 1)[3]).toBe(0);
    expect(at(clear, 15, 15)).toEqual([200, 60, 40, 255]);
  });

  it("refuse when nothing would be left", () => {
    expect(knockOut(canvas(30, 30))).toBeNull();
  });
});

describe("one-color files and placement", () => {
  it("recolor every visible pixel and keep transparency", () => {
    const white = recolor(knockOut(canvas(20, 20, [255, 255, 255], [{ x: 5, y: 5, w: 5, h: 5, color: [10, 10, 10] }]))!, "#ffffff");
    expect(at(white, 6, 6)).toEqual([255, 255, 255, 255]);
    expect(at(white, 1, 1)[3]).toBe(0);
  });

  it("clear a box, such as a practice preview's own label, with a pixel to spare", () => {
    const cleared = clearBox(canvas(20, 20, [0, 0, 0]), { x: 5, y: 5, width: 4, height: 4 });
    expect(at(cleared, 4, 4)[3]).toBe(0);
    expect(at(cleared, 9, 9)[3]).toBe(0);
    expect(at(cleared, 3, 3)[3]).toBe(255);
    expect(at(cleared, 10, 10)[3]).toBe(255);
  });

  it("find the artwork's box", () => {
    const clear = knockOut(canvas(50, 30, [255, 255, 255], [{ x: 10, y: 5, w: 20, h: 10, color: [0, 0, 0] }]))!;
    expect(contentBox(clear)).toEqual({ x: 10, y: 5, width: 20, height: 10 });
    expect(contentBox({ data: new Uint8ClampedArray(16), width: 2, height: 2 })).toBeNull();
  });

  it("fit the artwork inside a square with a margin, or pad it at its own size", () => {
    expect(placement({ x: 10, y: 5, width: 200, height: 100 }, { width: 100, height: 100 }, 0.1)).toEqual({ width: 100, height: 100, draw: { x: 10, y: 30, width: 80, height: 40 } });
    expect(placement({ x: 10, y: 5, width: 200, height: 100 }, null, 0.05)).toEqual({ width: 220, height: 120, draw: { x: 10, y: 10, width: 200, height: 100 } });
  });
});

describe("uploaded logos", () => {
  // Transparent all round, with a solid green square in the middle
  function transparent(): Pixels {
    const image = canvas(40, 40, [0, 0, 0], [{ x: 10, y: 10, w: 20, h: 20, color: [30, 100, 60] }]);
    for (let pixel = 0; pixel < 40 * 40; pixel++) {
      const x = pixel % 40;
      const y = Math.floor(pixel / 40);
      if (x < 10 || x >= 30 || y < 10 || y >= 30) image.data[pixel * 4 + 3] = 0;
    }
    return image;
  }

  it("keep a logo that's already see-through as it is", () => {
    const image = transparent();
    expect(seeThrough(image)).toBe(true);
    const clear = knockOut(image)!;
    expect(at(clear, 2, 2)[3]).toBe(0);
    expect(at(clear, 15, 15)).toEqual([30, 100, 60, 255]);
    expect(seeThrough(canvas(10, 10))).toBe(false);
  });

  it("suggest the main colors, most used first, without the background or near-white", () => {
    const logo = canvas(100, 100, [255, 255, 255], [
      { x: 0, y: 0, w: 100, h: 2, color: [255, 255, 255] },
      { x: 10, y: 10, w: 60, h: 60, color: [31, 58, 46] },
      { x: 70, y: 10, w: 20, h: 20, color: [200, 120, 40] },
      { x: 20, y: 80, w: 1, h: 1, color: [250, 0, 0] },
    ]);
    expect(logoColors(logo)).toEqual(["#1F3A2E", "#C87828"]);
    expect(logoColors(transparent())).toEqual(["#1E643C"]);
    expect(logoColors(canvas(20, 20))).toEqual([]);
  });
});

describe("one-color logos", () => {
  // Two blues, white details inside, and a soft edge pixel
  const logo = canvas(40, 40, [255, 255, 255], [
    { x: 8, y: 8, w: 12, h: 12, color: [40, 90, 200] },
    { x: 20, y: 8, w: 12, h: 12, color: [10, 30, 90] },
    { x: 12, y: 12, w: 3, h: 3, color: [255, 255, 255] },
    { x: 7, y: 10, w: 1, h: 1, color: [235, 240, 250] },
  ]);

  it("turn every color into the one color and keep white details and soft edges", () => {
    const solid = oneColor(logo, "#112233")!;
    expect(at(solid, 9, 9)).toEqual([17, 34, 51, 255]);
    expect(at(solid, 25, 9)).toEqual([17, 34, 51, 255]);
    expect(at(solid, 13, 13)).toEqual([255, 255, 255, 255]);
    expect(at(solid, 0, 0)).toEqual([255, 255, 255, 255]);
    const edge = at(solid, 7, 10);
    expect(edge[0]).toBeGreaterThan(17);
    expect(edge[0]).toBeLessThan(255);
    const colors = new Set<string>();
    for (let index = 0; index < solid.data.length; index += 4) {
      const [r, g, b] = solid.data.slice(index, index + 3);
      // Every pixel lies on the line from white to the one color
      const t = (255 - r) / (255 - 17);
      expect(Math.abs(255 - t * (255 - 34) - g)).toBeLessThanOrEqual(1);
      expect(Math.abs(255 - t * (255 - 51) - b)).toBeLessThanOrEqual(1);
      colors.add(`${r},${g},${b}`);
    }
    expect(colors.size).toBeGreaterThan(2);
  });

  it("treat a large pale fill, like a badge's cream inside, as paper", () => {
    const badge = canvas(40, 40, [255, 255, 255], [
      { x: 5, y: 5, w: 30, h: 30, color: [110, 70, 50] },
      { x: 7, y: 7, w: 26, h: 26, color: [249, 240, 225] },
      { x: 15, y: 15, w: 10, h: 10, color: [80, 160, 160] },
    ]);
    const solid = oneColor(badge, "#112233")!;
    expect(at(solid, 10, 10)).toEqual([255, 255, 255, 255]);
    expect(at(solid, 5, 5)).toEqual([17, 34, 51, 255]);
    expect(at(solid, 20, 20)).toEqual([17, 34, 51, 255]);
  });

  it("refuse a busy background", () => {
    expect(oneColor(canvas(20, 20, [255, 255, 255], [{ x: 0, y: 0, w: 20, h: 6, color: [200, 30, 30] }]), "#000000")).toBeNull();
  });
});

describe("frames around a logo", () => {
  it("paint over a thin gray square at the edge, and leave framed-less files alone", () => {
    const framed = canvas(50, 50, [255, 255, 255], [{ x: 20, y: 20, w: 10, h: 10, color: [30, 60, 40] }]);
    for (let i = 0; i < 50; i++) {
      for (const [x, y] of [[i, 0], [i, 49], [0, i], [49, i]]) framed.data.set([144, 144, 144, 255], (y * 50 + x) * 4);
    }
    const cleared = clearFrame(framed);
    expect(at(cleared, 0, 0)).toEqual([255, 255, 255, 255]);
    expect(at(cleared, 49, 25)).toEqual([255, 255, 255, 255]);
    expect(at(cleared, 25, 25)).toEqual([30, 60, 40, 255]);
    const plain = canvas(50, 50, [255, 255, 255], [{ x: 20, y: 20, w: 10, h: 10, color: [30, 60, 40] }]);
    expect(clearFrame(plain)).toBe(plain);
    const tinted = canvas(50, 50, [240, 220, 200], [{ x: 20, y: 20, w: 10, h: 10, color: [30, 60, 40] }]);
    expect(clearFrame(tinted)).toBe(tinted);
  });
});

describe("PNG files", () => {
  it("read back what was written, with and without transparency", () => {
    const image = canvas(17, 9, [250, 240, 230], [{ x: 3, y: 2, w: 5, h: 4, color: [10, 120, 200] }]);
    expect(decodePng(encodePng(image))).toEqual(image);
    image.data[3] = 0;
    expect(decodePng(encodePng(image))).toEqual(image);
    expect(decodePng(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
