// Pixel rules for kit files, run in the browser on canvas data. Plain functions, so they're tested without a browser.

export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Rgb = [number, number, number];

// How far a pixel may be from the background and still count as background
const BACKGROUND_TOLERANCE = 24;
// Share of the border that must be the background for it to count as plain
const PLAIN_SHARE = 0.9;
// Below this share of visible pixels there's no logo left to keep
const MIN_CONTENT = 0.002;

const distance = (data: Uint8ClampedArray, index: number, color: Rgb) =>
  Math.max(Math.abs(data[index] - color[0]), Math.abs(data[index + 1] - color[1]), Math.abs(data[index + 2] - color[2]));

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

// The color nearly all the border shares; null when the border isn't one plain color
export function plainBackground(image: Pixels): Rgb | null {
  const { data, width, height } = image;
  if (!width || !height) return null;
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);
  const color: Rgb = [0, 1, 2].map((channel) => median(border.map((pixel) => data[pixel * 4 + channel]))) as Rgb;
  const matching = border.filter((pixel) => data[pixel * 4 + 3] > 0 && distance(data, pixel * 4, color) <= BACKGROUND_TOLERANCE).length;
  return matching / border.length >= PLAIN_SHARE ? color : null;
}

// An uploaded logo that's already see-through: nearly all its border is transparent
export function seeThrough(image: Pixels): boolean {
  const { data, width, height } = image;
  if (!width || !height) return false;
  let clear = 0;
  let total = 0;
  const count = (pixel: number) => {
    total++;
    if (data[pixel * 4 + 3] < 16) clear++;
  };
  for (let x = 0; x < width; x++) {
    count(x);
    count((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    count(y * width);
    count(y * width + width - 1);
  }
  return clear / total >= PLAIN_SHARE;
}

function visibleShare(image: Pixels): number {
  let visible = 0;
  for (let index = 3; index < image.data.length; index += 4) if (image.data[index] >= 16) visible++;
  return visible / Math.max(1, image.width * image.height);
}

// Up to `max` main colors in a logo, most used first, for the owner to confirm. Leaves out the plain background,
// near-white, and colors used too little to matter, such as soft edges.
export function logoColors(image: Pixels, max = 3): string[] {
  const { data, width, height } = image;
  const background = seeThrough(image) ? null : plainBackground(image);
  const step = Math.max(1, Math.floor((width * height) / 250_000));
  const buckets = new Map<number, { count: number; sum: Rgb }>();
  let counted = 0;
  for (let pixel = 0; pixel < width * height; pixel += step) {
    const index = pixel * 4;
    if (data[index + 3] < 200) continue;
    if (background && distance(data, index, background) <= BACKGROUND_TOLERANCE) continue;
    if (data[index] > 240 && data[index + 1] > 240 && data[index + 2] > 240) continue;
    counted++;
    const key = ((data[index] >> 4) << 8) | ((data[index + 1] >> 4) << 4) | (data[index + 2] >> 4);
    const bucket = buckets.get(key) ?? { count: 0, sum: [0, 0, 0] };
    bucket.count++;
    bucket.sum = [bucket.sum[0] + data[index], bucket.sum[1] + data[index + 1], bucket.sum[2] + data[index + 2]];
    buckets.set(key, bucket);
  }
  const picked: Rgb[] = [];
  for (const bucket of [...buckets.values()].sort((a, b) => b.count - a.count)) {
    if (picked.length >= max || bucket.count / Math.max(1, counted) < 0.02) break;
    const color = bucket.sum.map((value) => Math.round(value / bucket.count)) as Rgb;
    if (picked.some((other) => Math.max(...other.map((value, channel) => Math.abs(value - color[channel]))) < 48)) continue;
    picked.push(color);
  }
  return picked.map((color) => `#${color.map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase());
}

// Grows a mask by one pixel in every direction
function dilate(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) continue;
      for (let dy = -1; dy <= 1 && !out[y * width + x]; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx]) {
            out[y * width + x] = 1;
            break;
          }
        }
      }
    }
  }
  return out;
}

// How much of `solid` a pixel is, mixed with the background, and how far it is from that mix
function mix(pixel: Rgb, solid: Rgb, background: Rgb): { alpha: number; miss: number } {
  const span = solid.map((value, channel) => value - background[channel]);
  const length = span.reduce((sum, value) => sum + value * value, 0);
  if (!length) return { alpha: 0, miss: Infinity };
  const alpha = Math.min(1, Math.max(0, span.reduce((sum, value, channel) => sum + value * (pixel[channel] - background[channel]), 0) / length));
  const miss = Math.max(...pixel.map((value, channel) => Math.abs(value - (background[channel] + alpha * span[channel]))));
  return { alpha, miss };
}

// Plain color-to-alpha, for thin strokes with no solid color nearby
function unmixFromBackground(pixel: Rgb, background: Rgb): { alpha: number; color: Rgb } {
  let alpha = 0;
  for (let channel = 0; channel < 3; channel++) {
    const value = pixel[channel];
    const base = background[channel];
    alpha = Math.max(alpha, value < base ? (base - value) / base : value > base ? (value - base) / (255 - base) : 0);
  }
  alpha = Math.min(1, alpha);
  if (alpha <= 0) return { alpha: 0, color: pixel };
  return { alpha, color: pixel.map((value, channel) => Math.round(background[channel] + (value - background[channel]) / alpha)) as Rgb };
}

// Background pixels become see-through. Soft edges next to them are un-mixed using the logo's own color nearby,
// so the logo stays smooth and solid on any color. White inside the logo becomes see-through too.
// Null when the background isn't one plain color, or nothing would be left.
export function knockOut(image: Pixels): Pixels | null {
  if (seeThrough(image)) return visibleShare(image) < MIN_CONTENT ? null : { data: new Uint8ClampedArray(image.data), width: image.width, height: image.height };
  const background = plainBackground(image);
  if (!background) return null;
  const { width, height } = image;
  const source = image.data;
  const data = new Uint8ClampedArray(source);
  const isBackground = new Uint8Array(width * height);
  for (let pixel = 0; pixel < width * height; pixel++) {
    if (distance(source, pixel * 4, background) <= BACKGROUND_TOLERANCE) isBackground[pixel] = 1;
  }
  // Anti-aliasing is usually one or two pixels wide
  const nearEdge = dilate(dilate(isBackground, width, height), width, height);
  const rgbAt = (pixel: number): Rgb => [source[pixel * 4], source[pixel * 4 + 1], source[pixel * 4 + 2]];

  let visible = 0;
  for (let pixel = 0; pixel < width * height; pixel++) {
    const index = pixel * 4;
    if (isBackground[pixel]) {
      data[index + 3] = 0;
      continue;
    }
    if (nearEdge[pixel]) {
      const here = rgbAt(pixel);
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      // The solid color nearby that this pixel is best explained as a blend of
      let best: { alpha: number; miss: number; color: Rgb } | null = null;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbor = ny * width + nx;
          if (nearEdge[neighbor]) continue;
          const solid = rgbAt(neighbor);
          const fit = mix(here, solid, background);
          if (!best || fit.miss < best.miss) best = { ...fit, color: solid };
        }
      }
      const { alpha, color } = best && best.miss <= BACKGROUND_TOLERANCE ? best : unmixFromBackground(here, background);
      if (alpha <= 0) {
        data[index + 3] = 0;
        continue;
      }
      data.set(color, index);
      data[index + 3] = Math.round(source[index + 3] * alpha);
    }
    if (data[index + 3] > 0) visible++;
  }
  if (visible / (width * height) < MIN_CONTENT) return null;
  return { data, width, height };
}

const rgbOfHex = (hex: string): Rgb => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

// Makes everything inside a box see-through, with a pixel to spare for soft edges
export function clearBox(image: Pixels, box: Box): Pixels {
  const data = new Uint8ClampedArray(image.data);
  const left = Math.max(0, Math.floor(box.x) - 1);
  const top = Math.max(0, Math.floor(box.y) - 1);
  const right = Math.min(image.width, Math.ceil(box.x + box.width) + 1);
  const bottom = Math.min(image.height, Math.ceil(box.y + box.height) + 1);
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) data[(y * image.width + x) * 4 + 3] = 0;
  }
  return { data, width: image.width, height: image.height };
}

// Every visible pixel in one color, keeping its transparency
export function recolor(image: Pixels, hex: string): Pixels {
  const [r, g, b] = rgbOfHex(hex);
  const data = new Uint8ClampedArray(image.data);
  for (let index = 0; index < data.length; index += 4) {
    if (!data[index + 3]) continue;
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
  }
  return { data, width: image.width, height: image.height };
}

// The smallest box around everything visible; null when nothing is
export function contentBox(image: Pixels, minAlpha = 16): Box | null {
  const { data, width, height } = image;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < minAlpha) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

// Where the artwork goes: scaled to fit inside the target with `margin` (a share of the target's sides) all round.
// With no target, the canvas is the artwork plus the margin.
export function placement(content: Box, target: { width: number; height: number } | null, margin: number): { width: number; height: number; draw: Box } {
  if (!target) {
    const pad = Math.round(Math.max(content.width, content.height) * margin);
    return { width: content.width + pad * 2, height: content.height + pad * 2, draw: { x: pad, y: pad, width: content.width, height: content.height } };
  }
  const roomWidth = target.width * (1 - margin * 2);
  const roomHeight = target.height * (1 - margin * 2);
  const scale = Math.min(roomWidth / content.width, roomHeight / content.height);
  const width = content.width * scale;
  const height = content.height * scale;
  return { ...target, draw: { x: (target.width - width) / 2, y: (target.height - height) / 2, width, height } };
}

// Distance from the background at which a pixel counts as fully part of the logo, and below which it's file noise
const FULL_INK = 48;
const NOISE = 8;

// The whole logo in one color on its own plain background, edges kept soft: each pixel keeps how far it was
// from the background, as a blend toward the one color. Null when the background isn't one plain color.
export function oneColor(image: Pixels, hex: string): Pixels | null {
  const background = plainBackground(image);
  if (!background) return null;
  const ink = rgbOfHex(hex);
  const data = new Uint8ClampedArray(image.data.length);
  for (let index = 0; index < data.length; index += 4) {
    const alpha = image.data[index + 3] / 255;
    const amount = Math.min(1, Math.max(0, distance(image.data, index, background) - NOISE) / (FULL_INK - NOISE)) * alpha;
    for (let channel = 0; channel < 3; channel++) data[index + channel] = Math.round(background[channel] + (ink[channel] - background[channel]) * amount);
    data[index + 3] = 255;
  }
  return { data, width: image.width, height: image.height };
}

function ring(image: Pixels, depth: number): number[] {
  const { width, height } = image;
  const pixels: number[] = [];
  for (let x = depth; x < width - depth; x++) pixels.push(depth * width + x, (height - 1 - depth) * width + x);
  for (let y = depth + 1; y < height - 1 - depth; y++) pixels.push(y * width + depth, y * width + width - 1 - depth);
  return pixels;
}

// A ring's color when nearly all of it is that one color
function ringColor(image: Pixels, depth: number): Rgb | null {
  const pixels = ring(image, depth);
  const color: Rgb = [0, 1, 2].map((channel) => median(pixels.map((pixel) => image.data[pixel * 4 + channel]))) as Rgb;
  const matching = pixels.filter((pixel) => distance(image.data, pixel * 4, color) <= BACKGROUND_TOLERANCE).length;
  return matching / pixels.length >= 0.95 ? color : null;
}

// A plain frame or box drawn around the edge, such as a thin gray square, painted over with the background inside it.
// Untouched when there's no frame: the outer rings must be plain and a different color from the plain rings inside.
export function clearFrame(image: Pixels, maxShare = 0.08): Pixels {
  const maxDepth = Math.floor(Math.min(image.width, image.height) * maxShare);
  const colors: Rgb[] = [];
  for (let depth = 0; depth < maxDepth; depth++) {
    const color = ringColor(image, depth);
    if (!color) break;
    colors.push(color);
  }
  const inner = colors.at(-1);
  if (!inner || colors.length < 2) return image;
  const differs = (color: Rgb) => Math.max(...color.map((value, channel) => Math.abs(value - inner[channel]))) > BACKGROUND_TOLERANCE;
  let frame = 0;
  while (frame < colors.length && !colors.slice(frame).every((color) => !differs(color))) frame++;
  if (!frame || frame === colors.length) return image;
  const data = new Uint8ClampedArray(image.data);
  for (let depth = 0; depth < frame; depth++) {
    for (const pixel of ring(image, depth)) data.set([...inner, 255], pixel * 4);
  }
  return { data, width: image.width, height: image.height };
}
