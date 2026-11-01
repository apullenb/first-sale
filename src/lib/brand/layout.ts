import { type Box, type Pixels, plainBackground, seeThrough } from "./pixels";

// Logo versions built from the logo's own pixels: the symbol and the lettering are found and moved, never redrawn.
// Plain functions on RGBA pixels, so they're tested without a browser or a model.

type Rgb = [number, number, number];

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Shape extends Rect {
  id: number;
  area: number;
  // Too small to matter: file noise, dropped from every version
  speck: boolean;
}

export interface Analysis {
  image: Pixels;
  // Null when the logo is already see-through
  background: Rgb | null;
  // Shape id per pixel, -1 for background
  labels: Int32Array;
  // Background-like pixels enclosed by a shape, such as a badge's pale fill: the shape's id, else -1
  holes: Int32Array;
  shapes: Shape[];
}

export interface Split {
  // "parts": symbol and lettering apart; "badge": one shape holds the name and the symbol; "none": no confident split
  kind: "parts" | "badge" | "none";
  // 0 to 1; below CONFIDENT the versions go to the image model
  confidence: number;
  // Plain words, kept on the file's record
  reason: string;
  symbol: number[];
  lettering: number[];
  // Each line of lettering, top to bottom
  lines: Rect[];
  arrangement: "side" | "stacked" | null;
}

export const CONFIDENT = 0.7;

// Distance from the background at which a pixel is part of a shape; alpha for a see-through logo
const INK = 40;
const INK_ALPHA = 96;
// Shapes smaller than this share of the picture are noise
const SPECK = 0.00001;
// Soft edge kept around each shape
const GROW = 2;
// More pieces than this is a texture or a photo, not a logo to take apart
const MAX_SHAPES = 800;

const width = (r: Rect) => r.x1 - r.x0 + 1;
const height = (r: Rect) => r.y1 - r.y0 + 1;
const area = (r: Rect) => width(r) * height(r);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

function rectOf(shapes: readonly Rect[]): Rect {
  return shapes.reduce((r, s) => ({ x0: Math.min(r.x0, s.x0), y0: Math.min(r.y0, s.y0), x1: Math.max(r.x1, s.x1), y1: Math.max(r.y1, s.y1) }), {
    x0: Infinity,
    y0: Infinity,
    x1: -Infinity,
    y1: -Infinity,
  });
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1;
  return w > 0 && h > 0 ? w * h : 0;
}

const distance = (data: Uint8ClampedArray, index: number, color: Rgb) =>
  Math.max(Math.abs(data[index] - color[0]), Math.abs(data[index + 1] - color[1]), Math.abs(data[index + 2] - color[2]));

// How much ink a pixel has: distance from the background, or its alpha when see-through
function inkAt(image: Pixels, background: Rgb | null, pixel: number): number {
  return background ? distance(image.data, pixel * 4, background) : image.data[pixel * 4 + 3];
}

// Shapes (8-connected) of everything that isn't background; null when the background isn't one plain color
export function analyze(image: Pixels): Analysis | null {
  const background = seeThrough(image) ? null : plainBackground(image);
  if (!background && !seeThrough(image)) return null;
  const { width: w, height: h } = image;
  const n = w * h;
  const ink = new Uint8Array(n);
  for (let p = 0; p < n; p++) ink[p] = inkAt(image, background, p) > (background ? INK : INK_ALPHA) ? 1 : 0;
  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  const shapes: Shape[] = [];
  const minArea = Math.max(4, n * SPECK);
  for (let start = 0; start < n; start++) {
    if (!ink[start] || labels[start] >= 0) continue;
    const id = shapes.length;
    const shape: Shape = { id, x0: w, y0: h, x1: -1, y1: -1, area: 0, speck: false };
    let top = 0;
    stack[top++] = start;
    labels[start] = id;
    while (top) {
      const p = stack[--top];
      const x = p % w;
      const y = (p - x) / w;
      shape.area++;
      if (x < shape.x0) shape.x0 = x;
      if (x > shape.x1) shape.x1 = x;
      if (y < shape.y0) shape.y0 = y;
      if (y > shape.y1) shape.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (ink[q] && labels[q] < 0) {
            labels[q] = id;
            stack[top++] = q;
          }
        }
      }
    }
    shape.speck = shape.area < minArea;
    shapes.push(shape);
  }
  return { image, background, labels, holes: enclosed(labels, w, h, stack), shapes };
}

// Each pocket of non-ink pixels that doesn't reach the edge belongs to the shape around it
function enclosed(labels: Int32Array, w: number, h: number, stack: Int32Array): Int32Array {
  const holes = new Int32Array(w * h).fill(-1);
  const seen = new Uint8Array(w * h);
  const pocket: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (labels[start] >= 0 || seen[start]) continue;
    let top = 0;
    let open = false;
    let owner = -1;
    pocket.length = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const p = stack[--top];
      pocket.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) open = true;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q < 0) continue;
        if (labels[q] >= 0) {
          if (owner < 0) owner = labels[q];
        } else if (!seen[q]) {
          seen[q] = 1;
          stack[top++] = q;
        }
      }
    }
    if (!open && owner >= 0) for (const p of pocket) holes[p] = owner;
  }
  return holes;
}

// Letters and digits the logo should show, for comparing with the shapes found
export const letterCount = (text: string) => Array.from(text.normalize("NFC")).filter((char) => /[\p{L}\p{N}]/u.test(char)).length;

class Groups {
  private parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) i = this.parent[i] = this.parent[this.parent[i]];
    return i;
  }
  join(a: number, b: number) {
    this.parent[this.find(a)] = this.find(b);
  }
  sets(): number[][] {
    const out = new Map<number, number[]>();
    this.parent.forEach((_, i) => out.set(this.find(i), [...(out.get(this.find(i)) ?? []), i]));
    return [...out.values()];
  }
}

// Share of shapes whose tops, or bottoms, line up: letters share a baseline or an x-height, scattered shapes don't
function aligned(members: readonly Shape[]): number {
  const m = median(members.map(height));
  const share = (edge: (s: Shape) => number) => {
    const mid = median(members.map(edge));
    return members.filter((s) => Math.abs(edge(s) - mid) <= 0.12 * m).length / members.length;
  };
  return Math.max(
    share((s) => s.y0),
    share((s) => s.y1),
  );
}

// Two shapes look like neighboring letters on one line
function sameLine(a: Shape, b: Shape): boolean {
  const ha = height(a);
  const hb = height(b);
  const vertical = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1;
  if (vertical < 0.5 * Math.min(ha, hb) || Math.max(ha, hb) / Math.min(ha, hb) > 2) return false;
  const gap = Math.max(a.x0 - b.x1, b.x0 - a.x1) - 1;
  const across = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;
  return gap <= 0.9 * Math.max(ha, hb) && across <= 0.5 * Math.min(width(a), width(b));
}

interface Line extends Rect {
  glyphs: Shape[];
  marks: Shape[];
  size: number;
  alignment: number;
}

const none = (reason: string, confidence = 0): Split => ({ kind: "none", confidence, reason, symbol: [], lettering: [], lines: [], arrangement: null });

// Finds the symbol and the lettering. letters: how many letters the logo's words have, when known.
export function splitLogo(analysis: Analysis, letters: number | null): Split {
  const live = analysis.shapes.filter((shape) => !shape.speck);
  if (!live.length) return none("Nothing was found in the logo to work with.");
  if (live.length > MAX_SHAPES) return none("The logo has too many small pieces to take apart safely.");
  const inkOf = (shapes: readonly Shape[]) => shapes.reduce((sum, s) => sum + s.area, 0);
  const total = inkOf(live);
  const content = rectOf(live);

  // A badge: one outer shape holds everything else
  const outer = live.reduce((best, s) => (area(s) > area(best) ? s : best));
  const inside = live.filter((s) => s !== outer && overlapArea(s, outer) >= 0.9 * area(s));
  const others = total - outer.area;
  if (others > 0 && area(outer) >= 0.7 * area(content) && inkOf(inside) >= 0.97 * others) {
    return { kind: "badge", confidence: 0.9, reason: "The logo is a badge: the name and symbol are one design, so it’s kept whole.", symbol: live.map((s) => s.id), lettering: [], lines: [], arrangement: null };
  }

  // Lines of letter-sized shapes
  const candidates = live.filter((s) => height(s) <= 0.6 * height(content) && width(s) <= 0.45 * width(content));
  const groups = new Groups(candidates.length);
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) if (sameLine(candidates[i], candidates[j])) groups.join(i, j);
  }
  const lines: Line[] = groups
    .sets()
    .map((set) => set.map((i) => candidates[i]))
    .filter((glyphs) => glyphs.length >= 3)
    .map((glyphs) => ({ ...rectOf(glyphs), glyphs, marks: [], size: median(glyphs.map(height)), alignment: aligned(glyphs) }))
    // Short lines must line up closely: three or four scattered shapes, such as sun rays, can look like a word
    .filter((line) => line.alignment >= (line.glyphs.length < 5 ? 0.9 : 0.75));
  if (!lines.length) return none("No line of lettering was found apart from the symbol.");

  // Dots, periods and accents sit on a line without being letter-sized
  const inLine = new Set(lines.flatMap((line) => line.glyphs.map((s) => s.id)));
  for (const shape of live) {
    if (inLine.has(shape.id)) continue;
    const cx = (shape.x0 + shape.x1) / 2;
    const cy = (shape.y0 + shape.y1) / 2;
    const line = lines.find(
      (l) =>
        height(shape) <= 0.6 * l.size &&
        width(shape) <= 1.2 * l.size &&
        cx >= l.x0 - 0.3 * l.size &&
        cx <= l.x1 + 0.3 * l.size &&
        cy >= l.y0 - 0.5 * l.size &&
        cy <= l.y1 + 0.3 * l.size,
    );
    if (line) {
      line.marks.push(shape);
      inLine.add(shape.id);
    }
  }

  // Lines stacked under one another, or side by side, form the lettering
  const blocks = new Groups(lines.length);
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const [a, b] = [lines[i], lines[j]];
      const size = Math.max(a.size, b.size);
      const gapY = Math.max(a.y0 - b.y1, b.y0 - a.y1) - 1;
      const acrossX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;
      const acrossY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1;
      const gapX = Math.max(a.x0 - b.x1, b.x0 - a.x1) - 1;
      const stacked = gapY <= 1.2 * size && acrossX >= 0.3 * Math.min(width(a), width(b));
      const beside = acrossY >= 0.5 * Math.min(height(a), height(b)) && gapX <= 2 * size;
      const similar = Math.max(a.size, b.size) / Math.min(a.size, b.size) <= 4;
      if (similar && (stacked || beside)) blocks.join(i, j);
    }
  }
  const block = blocks
    .sets()
    .map((set) => set.map((i) => lines[i]))
    .reduce((best, set) => (set.reduce((n, l) => n + l.glyphs.length, 0) > best.reduce((n, l) => n + l.glyphs.length, 0) ? set : best));
  block.sort((a, b) => a.y0 - b.y0);
  const lettering = block.flatMap((line) => [...line.glyphs, ...line.marks]);
  const letteringIds = new Set(lettering.map((s) => s.id));
  const symbol = live.filter((s) => !letteringIds.has(s.id));
  const glyphs = block.reduce((n, l) => n + l.glyphs.length, 0);

  if (inkOf(symbol) < 0.03 * total) return none("The logo is lettering only, with no separate symbol.");
  const symbolRect = rectOf(symbol);
  const letteringRect = rectOf(lettering);
  // Symbol ink inside the lettering's lines, such as a banner behind the name; boxes alone overlap whenever a corner reaches past
  const symbolIds = new Set(symbol.map((s) => s.id));
  const inkIn = (rect: Rect, ids: Set<number>) => {
    let count = 0;
    for (let y = rect.y0; y <= rect.y1; y++) {
      for (let x = rect.x0; x <= rect.x1; x++) if (ids.has(analysis.labels[y * analysis.image.width + x])) count++;
    }
    return count;
  };
  const overlap = block.reduce((n, line) => n + inkIn(line, symbolIds), 0) / inkOf(symbol);

  let confidence = 1;
  const notes: string[] = [];
  if (letters) {
    const ratio = glyphs / letters;
    if (ratio < 0.6 || ratio > 1.6) {
      confidence *= 0.4;
      notes.push(`found ${glyphs} letter shapes where the name has ${letters} letters`);
    } else if (ratio < 0.8 || ratio > 1.25) {
      confidence *= 0.75;
      notes.push(`found ${glyphs} letter shapes where the name has ${letters} letters`);
    }
  } else confidence *= 0.9;
  if (overlap > 0.005) {
    confidence *= Math.max(0, 1 - overlap * 8);
    notes.push("the lettering and the symbol overlap");
  }
  if (lines.length > block.length) {
    confidence *= 0.6;
    notes.push("there are words apart from the name");
  }
  if (Math.min(...block.map((l) => l.alignment)) < 0.8) confidence *= 0.85;
  if (inkOf(symbol) < 0.08 * total) {
    confidence *= 0.6;
    notes.push("the symbol is very small");
  }
  confidence = Math.round(confidence * 100) / 100;
  const across = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0) + 1) / Math.min(a1 - a0 + 1, b1 - b0 + 1);
  const sideBySide = across(symbolRect.x0, symbolRect.x1, letteringRect.x0, letteringRect.x1) <= 0.1;
  const onTop = across(symbolRect.y0, symbolRect.y1, letteringRect.y0, letteringRect.y1) <= 0.1;
  const reason = notes.length
    ? `The symbol and lettering couldn’t be separated with confidence: ${notes.join("; ")}.`
    : `Symbol and lettering separated (${block.length} line${block.length === 1 ? "" : "s"}, ${glyphs} letter shapes).`;
  return {
    kind: "parts",
    confidence,
    reason,
    symbol: symbol.map((s) => s.id),
    lettering: lettering.map((s) => s.id),
    lines: block.map(({ x0, y0, x1, y1 }) => ({ x0, y0, x1, y1 })),
    arrangement: sideBySide ? "side" : onTop ? "stacked" : null,
  };
}

// --- Putting pieces together

function blankOf(analysis: Analysis): [number, number, number, number] {
  return analysis.background ? [...analysis.background, 255] : [0, 0, 0, 0];
}

function canvas(analysis: Analysis, w: number, h: number): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  const blank = blankOf(analysis);
  for (let i = 0; i < data.length; i += 4) data.set(blank, i);
  return { data, width: w, height: h };
}

function rectOfIds(analysis: Analysis, ids: readonly number[]): Rect {
  return rectOf(ids.map((id) => analysis.shapes[id]));
}

// 1 where a pixel belongs to these shapes or their soft edge, inside `rect`; never another shape's own pixels
function keepMask(analysis: Analysis, ids: readonly number[], rect: Rect, grow = GROW): Uint8Array {
  const { labels, image, shapes } = analysis;
  const w = width(rect);
  const h = height(rect);
  const wanted = new Set(ids);
  const mask = new Uint8Array(w * h);
  const blocked = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const at = (rect.y0 + y) * image.width + rect.x0 + x;
      const label = labels[at];
      if (label < 0) {
        if (wanted.has(analysis.holes[at])) mask[y * w + x] = 1;
        continue;
      }
      if (wanted.has(label)) mask[y * w + x] = 1;
      else if (!shapes[label].speck) blocked[y * w + x] = 1;
    }
  }
  for (let step = 0; step < grow; step++) {
    const next = new Uint8Array(mask);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (mask[p] || blocked[p]) continue;
        if ((x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) || (y > 0 && mask[p - w]) || (y < h - 1 && mask[p + w])) next[p] = 1;
      }
    }
    mask.set(next);
  }
  return mask;
}

function expand(rect: Rect, by: number, image: Pixels): Rect {
  return { x0: Math.max(0, rect.x0 - by), y0: Math.max(0, rect.y0 - by), x1: Math.min(image.width - 1, rect.x1 + by), y1: Math.min(image.height - 1, rect.y1 + by) };
}

// Just these shapes, with their soft edges, on the logo's own background
export function cutOut(analysis: Analysis, ids: readonly number[]): Pixels {
  const rect = expand(rectOfIds(analysis, ids), GROW, analysis.image);
  const mask = keepMask(analysis, ids, rect);
  const out = canvas(analysis, width(rect), height(rect));
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      if (!mask[y * out.width + x]) continue;
      const from = ((rect.y0 + y) * analysis.image.width + rect.x0 + x) * 4;
      out.data.set(analysis.image.data.subarray(from, from + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

// Resized by area averaging (smaller) or bilinear sampling (larger), on premultiplied alpha
export function resize(image: Pixels, scale: number): Pixels {
  if (scale === 1) return image;
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  const src = image.data;
  const sx = image.width / w;
  const sy = image.height / h;
  const acc = [0, 0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      acc.fill(0);
      let weight = 0;
      if (scale < 1) {
        const left = x * sx;
        const right = left + sx;
        const top = y * sy;
        const bottom = top + sy;
        for (let yy = Math.floor(top); yy < Math.min(image.height, Math.ceil(bottom)); yy++) {
          const wy = Math.min(bottom, yy + 1) - Math.max(top, yy);
          for (let xx = Math.floor(left); xx < Math.min(image.width, Math.ceil(right)); xx++) {
            const wgt = wy * (Math.min(right, xx + 1) - Math.max(left, xx));
            const i = (yy * image.width + xx) * 4;
            const a = src[i + 3] / 255;
            acc[0] += src[i] * a * wgt;
            acc[1] += src[i + 1] * a * wgt;
            acc[2] += src[i + 2] * a * wgt;
            acc[3] += a * wgt;
            weight += wgt;
          }
        }
      } else {
        const fx = Math.min(image.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
        const fy = Math.min(image.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = Math.min(image.width - 1, x0 + 1);
        const y1 = Math.min(image.height - 1, y0 + 1);
        for (const [xx, yy, wgt] of [
          [x0, y0, (1 - (fx - x0)) * (1 - (fy - y0))],
          [x1, y0, (fx - x0) * (1 - (fy - y0))],
          [x0, y1, (1 - (fx - x0)) * (fy - y0)],
          [x1, y1, (fx - x0) * (fy - y0)],
        ]) {
          const i = (yy * image.width + xx) * 4;
          const a = src[i + 3] / 255;
          acc[0] += src[i] * a * wgt;
          acc[1] += src[i + 1] * a * wgt;
          acc[2] += src[i + 2] * a * wgt;
          acc[3] += a * wgt;
          weight += wgt;
        }
      }
      const o = (y * w + x) * 4;
      const alpha = acc[3] / weight;
      if (alpha > 0) {
        out[o] = acc[0] / weight / alpha;
        out[o + 1] = acc[1] / weight / alpha;
        out[o + 2] = acc[2] / weight / alpha;
      }
      out[o + 3] = Math.round(alpha * 255);
    }
  }
  return { data: out, width: w, height: h };
}

// Blank pixels of the piece are skipped, so pieces can sit close without covering each other
function paste(target: Pixels, piece: Pixels, left: number, top: number, blank?: readonly number[]) {
  for (let y = 0; y < piece.height; y++) {
    const ty = top + y;
    if (ty < 0 || ty >= target.height) continue;
    for (let x = 0; x < piece.width; x++) {
      const tx = left + x;
      if (tx < 0 || tx >= target.width) continue;
      const from = (y * piece.width + x) * 4;
      if (blank && blank.every((value, c) => piece.data[from + c] === value)) continue;
      target.data.set(piece.data.subarray(from, from + 4), (ty * target.width + tx) * 4);
    }
  }
}

// The pieces on a square, centered, with `margin` (a share of the side) all round
function onSquare(analysis: Analysis, piece: Pixels, margin: number, circle = false): Pixels {
  const fit = Math.max(piece.width, piece.height) / (1 - margin * 2);
  // A profile picture gets cropped to a circle, so the corners must fit inside it too
  const side = Math.ceil(circle ? Math.max(fit, Math.hypot(piece.width, piece.height) / 0.94) : fit);
  const out = canvas(analysis, side, side);
  paste(out, piece, Math.round((side - piece.width) / 2), Math.round((side - piece.height) / 2));
  return out;
}

// The profile picture: the symbol alone, or a badge whole
export function composeIcon(analysis: Analysis, split: Split): Pixels {
  return onSquare(analysis, cutOut(analysis, split.symbol), 0.14, true);
}

// The symbol centered above the lettering, lines kept as drawn; a badge stays whole
export function composeStacked(analysis: Analysis, split: Split, symbolScale = 1): Pixels {
  if (split.kind === "badge") return onSquare(analysis, cutOut(analysis, split.symbol), 0.08);
  const symbol = resize(cutOut(analysis, split.symbol), symbolScale);
  const lettering = cutOut(analysis, split.lettering);
  const gap = Math.round(0.45 * median(split.lines.map(height)));
  const w = Math.max(symbol.width, lettering.width);
  const piece = canvas(analysis, w, symbol.height + gap + lettering.height);
  paste(piece, symbol, Math.round((w - symbol.width) / 2), 0);
  paste(piece, lettering, Math.round((w - lettering.width) / 2), symbol.height + gap);
  return onSquare(analysis, piece, 0.1);
}

// The main logo again, its symbol scaled and everything else where it was: same order, gap and margins
export function resizeSymbol(analysis: Analysis, split: Split, symbolScale: number): Pixels | null {
  if (split.kind !== "parts" || !split.arrangement) return null;
  const { image } = analysis;
  const symbolRect = expand(rectOfIds(analysis, split.symbol), GROW, image);
  const letteringRect = expand(rectOfIds(analysis, split.lettering), GROW, image);
  const symbol = resize(cutOut(analysis, split.symbol), symbolScale);
  const lettering = cutOut(analysis, split.lettering);
  const content = rectOf([symbolRect, letteringRect]);
  // Positions relative to the lettering, keeping the gap and how the centers line up
  let sx: number;
  let sy: number;
  if (split.arrangement === "side") {
    const left = symbolRect.x0 + symbolRect.x1 < letteringRect.x0 + letteringRect.x1;
    const gap = left ? letteringRect.x0 - symbolRect.x1 : symbolRect.x0 - letteringRect.x1;
    sx = left ? -gap - symbol.width : lettering.width + gap;
    const offset = (symbolRect.y0 + symbolRect.y1) / 2 - (letteringRect.y0 + letteringRect.y1) / 2;
    sy = Math.round(lettering.height / 2 + offset - symbol.height / 2);
  } else {
    const above = symbolRect.y0 + symbolRect.y1 < letteringRect.y0 + letteringRect.y1;
    const gap = above ? letteringRect.y0 - symbolRect.y1 : symbolRect.y0 - letteringRect.y1;
    sy = above ? -gap - symbol.height : lettering.height + gap;
    const offset = (symbolRect.x0 + symbolRect.x1) / 2 - (letteringRect.x0 + letteringRect.x1) / 2;
    sx = Math.round(lettering.width / 2 + offset - symbol.width / 2);
  }
  const minX = Math.min(0, sx);
  const minY = Math.min(0, sy);
  const w = Math.max(lettering.width, sx + symbol.width) - minX;
  const h = Math.max(lettering.height, sy + symbol.height) - minY;
  const marginX = Math.min(content.x0, image.width - 1 - content.x1);
  const marginY = Math.min(content.y0, image.height - 1 - content.y1);
  const out = canvas(analysis, Math.max(image.width, w + marginX * 2), Math.max(image.height, h + marginY * 2));
  const left = Math.round((out.width - w) / 2) - minX;
  const top = Math.round((out.height - h) / 2) - minY;
  paste(out, lettering, left, top);
  paste(out, symbol, left + sx, top + sy, blankOf(analysis));
  return out;
}

// Typical stroke width of the lettering: the shorter of the median horizontal and vertical runs of ink
function strokeWidth(analysis: Analysis, ids: readonly number[]): number {
  const { labels, image } = analysis;
  const wanted = new Set(ids);
  const rect = rectOfIds(analysis, ids);
  const runs = (outer: number, inner: number, at: (o: number, i: number) => number) => {
    const found: number[] = [];
    for (let o = 0; o < outer; o++) {
      let run = 0;
      for (let i = 0; i <= inner; i++) {
        if (i < inner && wanted.has(labels[at(o, i)])) run++;
        else if (run) {
          found.push(run);
          run = 0;
        }
      }
    }
    return median(found);
  };
  const across = runs(height(rect), width(rect), (o, i) => (rect.y0 + o) * image.width + rect.x0 + i);
  const down = runs(width(rect), height(rect), (o, i) => (rect.y0 + i) * image.width + rect.x0 + o);
  return Math.max(1, Math.min(across, down));
}

// Typical space between neighboring letters on a line
function letterGap(analysis: Analysis, split: Split): number {
  const gaps: number[] = [];
  for (const line of split.lines) {
    const glyphs = split.lettering
      .map((id) => analysis.shapes[id])
      .filter((s) => (s.y0 + s.y1) / 2 >= line.y0 && (s.y0 + s.y1) / 2 <= line.y1)
      .sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < glyphs.length; i++) {
      const gap = glyphs[i].x0 - Math.max(...glyphs.slice(0, i).map((s) => s.x1)) - 1;
      if (gap > 0) gaps.push(gap);
    }
  }
  return gaps.length ? median(gaps) : 0;
}

// Heavier lettering by grayscale dilation: each edge moves out by a share of the stroke width, soft edges and colors kept.
// Never paints over the symbol.
export function thickenLettering(analysis: Analysis, split: Split, amount: number): { image: Pixels; radius: number } | null {
  if (split.kind !== "parts" || !split.lettering.length) return null;
  const { image, background } = analysis;
  // Neighbors must never run together; when that leaves too little to see, it's left to the image model
  const wanted = Math.max(1, Math.round(strokeWidth(analysis, split.lettering) * amount));
  const radius = Math.min(wanted, Math.floor(letterGap(analysis, split) * 0.4));
  if (radius < Math.max(1, wanted * 0.5)) return null;
  const rect = expand(rectOfIds(analysis, split.lettering), radius + GROW + 1, image);
  const w = width(rect);
  const h = height(rect);
  const source = keepMask(analysis, split.lettering, rect);
  const symbolIds = analysis.shapes.filter((s) => !s.speck && !split.lettering.includes(s.id)).map((s) => s.id);
  const protect = symbolIds.length ? keepMask(analysis, symbolIds, rect) : new Uint8Array(w * h);
  const global = (p: number) => (rect.y0 + Math.floor(p / w)) * image.width + rect.x0 + (p % w);
  let level = new Float32Array(w * h);
  let from = new Int32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    from[p] = global(p);
    level[p] = source[p] ? inkAt(image, background, from[p]) : 0;
  }
  for (let step = 0; step < radius; step++) {
    // Square and cross steps in turn grow a rounded, nearly circular edge
    const square = step % 2 === 0;
    const nextLevel = new Float32Array(level);
    const nextFrom = new Int32Array(from);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((!dx && !dy) || (!square && dx && dy)) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const q = ny * w + nx;
            if (level[q] > nextLevel[p]) {
              nextLevel[p] = level[q];
              nextFrom[p] = from[q];
            }
          }
        }
      }
    }
    level = nextLevel;
    from = nextFrom;
  }
  const data = new Uint8ClampedArray(image.data);
  for (let p = 0; p < w * h; p++) {
    if (protect[p] && !source[p]) continue;
    const at = global(p);
    if (level[p] <= inkAt(image, background, at) || from[p] === at) continue;
    data.set(image.data.subarray(from[p] * 4, from[p] * 4 + 4), at * 4);
  }
  return { image: { data, width: image.width, height: image.height }, radius };
}

// These shapes in one new color; soft edges stay soft, everything else is untouched
export function recolorShapes(analysis: Analysis, ids: readonly number[], hex: string): Pixels {
  const { image, background } = analysis;
  const value = Number.parseInt(hex.slice(1), 16);
  const color: Rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const data = new Uint8ClampedArray(image.data);
  const rect = expand(rectOfIds(analysis, ids), GROW, image);
  const mask = keepMask(analysis, ids, rect);
  // How solid a shape's own ink is, so its edges keep their share of it
  const solid = new Map<number, number>();
  for (const id of ids) solid.set(id, 0);
  for (let p = 0; p < image.width * image.height; p++) {
    const label = analysis.labels[p];
    if (solid.has(label)) solid.set(label, Math.max(solid.get(label)!, inkAt(image, background, p)));
  }
  const full = Math.max(1, median([...solid.values()]));
  for (let y = 0; y < height(rect); y++) {
    for (let x = 0; x < width(rect); x++) {
      if (!mask[y * width(rect) + x]) continue;
      const p = (rect.y0 + y) * image.width + rect.x0 + x;
      if (background) {
        const share = Math.min(1, inkAt(image, background, p) / full);
        for (let c = 0; c < 3; c++) data[p * 4 + c] = Math.round(background[c] + (color[c] - background[c]) * share);
      } else data.set(color, p * 4);
    }
  }
  return { data, width: image.width, height: image.height };
}

export function toBox(rect: Rect): Box {
  return { x: rect.x0, y: rect.y0, width: width(rect), height: height(rect) };
}
