import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyze, type Analysis, composeIcon, composeStacked, CONFIDENT, letterCount, resizeSymbol, splitLogo, thickenLettering } from "./layout";
import { contentBox, type Pixels } from "./pixels";
import { decodePng } from "./png";

type Rgb = [number, number, number];

// Logos the image model drew in a live run, downscaled
const real = (name: string): Pixels => decodePng(new Uint8Array(readFileSync(path.join(__dirname, "test-logos", `${name}.png`))))!;

// A white canvas with filled rectangles
function canvas(width: number, height: number, boxes: { x: number; y: number; w: number; h: number; color: Rgb }[]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const box = boxes.findLast((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
      data.set([...(box?.color ?? [255, 255, 255]), 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

const NAVY: Rgb = [20, 40, 90];
const GOLD: Rgb = [240, 180, 30];

// A square symbol on the left, then two lines of "letters": thin bars with letter-like gaps
function symbolAndName(): Pixels {
  const boxes = [
    { x: 20, y: 30, w: 80, h: 80, color: GOLD },
    { x: 40, y: 50, w: 40, h: 40, color: NAVY },
  ];
  for (let i = 0; i < 6; i++) boxes.push({ x: 130 + i * 22, y: 40, w: 14, h: 26, color: NAVY });
  for (let i = 0; i < 5; i++) boxes.push({ x: 130 + i * 22, y: 76, w: 14, h: 26, color: NAVY });
  return canvas(300, 140, boxes);
}

const colorsIn = (image: Pixels) => {
  const found = new Set<string>();
  for (let i = 0; i < image.data.length; i += 4) found.add(Array.from(image.data.slice(i, i + 3)).join(","));
  return found;
};

describe("finding the symbol and the lettering", () => {
  it("splits a drawn symbol from two lines of lettering", () => {
    const analysis = analyze(symbolAndName())!;
    const split = splitLogo(analysis, 11);
    expect(split).toMatchObject({ kind: "parts", confidence: 1, arrangement: "side" });
    expect(split.lines).toHaveLength(2);
    expect(split.lettering).toHaveLength(11);
    expect(split.symbol).toHaveLength(1);
  });

  it("is less sure when the letters found don't match the name, and unsure when text sits on the symbol", () => {
    const analysis = analyze(symbolAndName())!;
    expect(splitLogo(analysis, 30).confidence).toBeLessThan(CONFIDENT);
    expect(splitLogo(analysis, null).confidence).toBeGreaterThanOrEqual(CONFIDENT);
    // A banner behind the name
    const banner = canvas(300, 140, [
      { x: 20, y: 30, w: 80, h: 80, color: GOLD },
      { x: 120, y: 34, w: 150, h: 36, color: GOLD },
      ...Array.from({ length: 6 }, (_, i) => ({ x: 130 + i * 22, y: 40, w: 14, h: 26, color: NAVY })),
    ]);
    const split = splitLogo(analyze(banner)!, 6);
    expect(split.kind === "none" || split.confidence < CONFIDENT).toBe(true);
  });

  it("finds no symbol in lettering alone, and keeps a badge whole", () => {
    const words = canvas(200, 60, Array.from({ length: 7 }, (_, i) => ({ x: 20 + i * 22, y: 15, w: 14, h: 26, color: NAVY })));
    expect(splitLogo(analyze(words)!, 7).kind).toBe("none");
    const badge = canvas(200, 200, [
      { x: 20, y: 20, w: 160, h: 160, color: NAVY },
      { x: 26, y: 26, w: 148, h: 148, color: [255, 255, 255] },
      { x: 80, y: 50, w: 40, h: 40, color: GOLD },
      ...Array.from({ length: 5 }, (_, i) => ({ x: 50 + i * 22, y: 120, w: 14, h: 26, color: NAVY })),
    ]);
    expect(splitLogo(analyze(badge)!, 5).kind).toBe("badge");
  });

  it("refuses a busy background", () => {
    const stripes = canvas(100, 100, Array.from({ length: 10 }, (_, i) => ({ x: 0, y: i * 10, w: 100, h: 5, color: NAVY })));
    expect(analyze(stripes)).toBeNull();
  });

  it("counts the letters a name has, without spaces or punctuation", () => {
    expect(letterCount("Two Pines Candle Co.")).toBe(16);
    expect(letterCount("Sol y Salsa Tacos")).toBe(14);
  });
});

describe("real logos the image model drew", () => {
  const cases: { name: string; letters: number; kind: "parts" | "badge"; lines?: number }[] = [
    { name: "dog-grooming", letters: letterCount("Wagging Wheels Grooming"), kind: "parts", lines: 3 },
    { name: "soy-candles", letters: letterCount("Two Pines Candle Co."), kind: "parts", lines: 2 },
    { name: "taco-truck", letters: letterCount("Sol y Salsa Tacos"), kind: "parts", lines: 2 },
    { name: "western-boutique", letters: letterCount("Prairie Rose Boutique"), kind: "badge" },
  ];
  const splits = new Map<string, { analysis: Analysis; split: ReturnType<typeof splitLogo> }>();
  const get = (name: string, letters: number) => {
    if (!splits.has(name)) {
      const analysis = analyze(real(name))!;
      splits.set(name, { analysis, split: splitLogo(analysis, letters) });
    }
    return splits.get(name)!;
  };

  for (const { name, letters, kind, lines } of cases) {
    it(`splits ${name} confidently`, () => {
      const { split } = get(name, letters);
      expect(split.kind).toBe(kind);
      expect(split.confidence).toBeGreaterThanOrEqual(CONFIDENT);
      if (lines) expect(split.lines).toHaveLength(lines);
    });
  }

  it("puts the symbol alone on a square for the icon, with room for a circle crop", () => {
    const { analysis, split } = get("dog-grooming", 21);
    const icon = composeIcon(analysis, split);
    expect(icon.width).toBe(icon.height);
    const box = contentBox({ ...icon, data: inkAsAlpha(icon) })!;
    // The symbol is narrower than the logo's lettering, and centered
    expect(Math.abs(box.x + box.width / 2 - icon.width / 2)).toBeLessThan(3);
    expect(box.width / icon.width).toBeLessThanOrEqual(0.73);
  });

  it("stacks the symbol above the lettering, copying the logo's own pixels", () => {
    const { analysis, split } = get("soy-candles", 16);
    const stacked = composeStacked(analysis, split);
    expect(stacked.width).toBe(stacked.height);
    // No color appears that the logo doesn't have
    const original = colorsIn(real("soy-candles"));
    for (const color of colorsIn(stacked)) expect(original.has(color)).toBe(true);
  });

  it("keeps a badge whole, inside fill included", () => {
    const { analysis, split } = get("western-boutique", 19);
    const icon = composeIcon(analysis, split);
    const center = ((icon.height >> 1) * icon.width + (icon.width >> 1) - Math.round(icon.width * 0.2)) * 4;
    // The badge's cream fill, not the page's white
    expect(Array.from(icon.data.slice(center, center + 3))).not.toEqual([255, 255, 255]);
  });

  it("thickens the lettering visibly and leaves the symbol alone", () => {
    const { analysis, split } = get("dog-grooming", 21);
    const thick = thickenLettering(analysis, split, 0.18)!;
    expect(thick.radius).toBeGreaterThanOrEqual(1);
    const symbolIds = new Set(split.symbol);
    let changedSymbol = 0;
    let added = 0;
    for (let p = 0; p < analysis.labels.length; p++) {
      const same = [0, 1, 2, 3].every((c) => thick.image.data[p * 4 + c] === analysis.image.data[p * 4 + c]);
      if (!same && symbolIds.has(analysis.labels[p])) changedSymbol++;
      if (!same && analysis.labels[p] < 0) added++;
    }
    expect(changedSymbol).toBe(0);
    const letteringInk = split.lettering.reduce((n, id) => n + analysis.shapes[id].area, 0);
    expect(added / letteringInk).toBeGreaterThan(0.1);
  });

  it("makes the symbol bigger and keeps the lettering where it was drawn", () => {
    const { analysis, split } = get("soy-candles", 16);
    const bigger = resizeSymbol(analysis, split, 1.2)!;
    expect(bigger.width).toBeGreaterThanOrEqual(analysis.image.width);
    expect(resizeSymbol(analysis, get("western-boutique", 19).split, 1.2)).toBeNull();
  });
});

// Alpha from distance to white, so contentBox finds the artwork on an opaque picture
function inkAsAlpha(image: Pixels): Uint8ClampedArray {
  const data = new Uint8ClampedArray(image.data);
  for (let i = 0; i < data.length; i += 4) data[i + 3] = Math.max(255 - data[i], 255 - data[i + 1], 255 - data[i + 2]) > 40 ? 255 : 0;
  return data;
}
