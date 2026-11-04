import { type Box, IMAGE_SPECS } from "./sizes";
import type { BrandImageKind } from "./types";

// Crop math for brand images, in plain code: the safe area the model was asked to fill maps onto the final file's safe area.

export interface Size {
  width: number;
  height: number;
}

// Pixels in the returned picture; may reach past its edges, which are then filled by mirroring
export interface Crop {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FramePlan {
  crop: Crop;
  // Pixels added past each edge of the returned picture
  pad: { left: number; top: number; right: number; bottom: number };
  // Where the returned picture's safe area ends up in the final file, in fractions
  safeLands: Box;
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

// The model drew the safe area at the same fractions of its own picture; the crop keeps all of it, centered where the final one is
export function planFrame(source: Size, target: Size, safe: Box): FramePlan {
  const ratio = target.width / target.height;
  const sx = safe.x * source.width;
  const sy = safe.y * source.height;
  const sw = safe.w * source.width;
  const sh = safe.h * source.height;
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  const safeCx = safe.x + safe.w / 2;
  const safeCy = safe.y + safe.h / 2;

  // Largest crop of the final shape inside the picture, grown only if the safe area wouldn't fit
  let width = Math.min(source.width, source.height * ratio);
  width = Math.max(width, sw, sh * ratio);
  const height = width / ratio;
  // Inside the picture where it fits; mirrored edges fill the rest when it can't
  const left = width <= source.width ? clamp(cx - safeCx * width, 0, source.width - width) : cx - safeCx * width;
  const top = height <= source.height ? clamp(cy - safeCy * height, 0, source.height - height) : cy - safeCy * height;
  // The whole safe area stays in
  const l = Math.round(clamp(left, sx + sw - width, sx));
  const t = Math.round(clamp(top, sy + sh - height, sy));
  const crop = { left: l, top: t, width: Math.round(width), height: Math.round(height) };
  const pad = {
    left: Math.max(0, -crop.left),
    top: Math.max(0, -crop.top),
    right: Math.max(0, crop.left + crop.width - source.width),
    bottom: Math.max(0, crop.top + crop.height - source.height),
  };
  return { crop, pad, safeLands: { x: (sx - crop.left) / crop.width, y: (sy - crop.top) / crop.height, w: sw / crop.width, h: sh / crop.height } };
}

export function framePlanFor(kind: BrandImageKind, source: Size): FramePlan {
  const spec = IMAGE_SPECS[kind];
  return planFrame(source, spec.final, spec.safe);
}

const inside = (inner: Box, outer: Box, slack: number) =>
  inner.x >= outer.x - slack && inner.y >= outer.y - slack && inner.x + inner.w <= outer.x + outer.w + slack && inner.y + inner.h <= outer.y + outer.h + slack;

// Run on every finished file: exact size, and the drawn safe area kept whole inside the picture
export function checkFrame(kind: BrandImageKind, made: Size, plan: FramePlan): string[] {
  const { final } = IMAGE_SPECS[kind];
  const problems: string[] = [];
  if (made.width !== final.width || made.height !== final.height) problems.push(`The file is ${made.width} × ${made.height}, not ${final.width} × ${final.height}.`);
  if (!inside(plan.safeLands, { x: 0, y: 0, w: 1, h: 1 }, 0.002)) problems.push("Part of the safe area was cropped off.");
  return problems;
}

// Where code puts a logo on a brand image: inside the safe area, at its top-left for the website header, centered otherwise
export function logoBoxFor(kind: BrandImageKind, logo: Size): Box {
  const { safe, final } = IMAGE_SPECS[kind];
  const share = kind === "website_hero" ? 0.4 : 0.8;
  // In final-picture fractions, keeping the logo's own shape
  const maxW = safe.w * share;
  const maxH = safe.h * share;
  const logoRatio = logo.width / logo.height / (final.width / final.height);
  const w = Math.min(maxW, maxH * logoRatio);
  const h = w / logoRatio;
  if (kind === "website_hero") return { x: safe.x, y: safe.y, w, h };
  return { x: safe.x + (safe.w - w) / 2, y: safe.y + (safe.h - h) / 2, w, h };
}
