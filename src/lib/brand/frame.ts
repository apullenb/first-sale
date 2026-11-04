import { type Box, IMAGE_SPECS } from "./sizes";
import type { BrandImageKind } from "./types";

// Placement math for brand images, in plain code: the drawn picture fills the visible area, its safe area on the final one's.

export interface Size {
  width: number;
  height: number;
}

// A rectangle in pixels
export interface Crop {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FramePlan {
  // Pixels of the returned picture shown in the visible area; may reach past its edges, filled by the soft extension
  crop: Crop;
  // How far the crop reaches past each edge of the returned picture
  pad: { left: number; top: number; right: number; bottom: number };
  // In the final file, in pixels: the visible area, and where the returned picture's own pixels land
  visible: Crop;
  picture: Crop;
  // Where the returned picture's safe area ends up in the final file, in fractions
  safeLands: Box;
}

const FULL: Box = { x: 0, y: 0, w: 1, h: 1 };
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

// The model drew the safe area at the same fractions of its picture as it has in the visible area
export function planFrame(source: Size, target: Size, safe: Box, visible: Box = FULL): FramePlan {
  const area = {
    left: Math.round(visible.x * target.width),
    top: Math.round(visible.y * target.height),
    width: Math.round(visible.w * target.width),
    height: Math.round(visible.h * target.height),
  };
  const inner: Box = { x: (safe.x - visible.x) / visible.w, y: (safe.y - visible.y) / visible.h, w: safe.w / visible.w, h: safe.h / visible.h };
  const ratio = area.width / area.height;
  const sx = inner.x * source.width;
  const sy = inner.y * source.height;
  const sw = inner.w * source.width;
  const sh = inner.h * source.height;
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  const safeCx = inner.x + inner.w / 2;
  const safeCy = inner.y + inner.h / 2;

  // Largest crop of the visible area's shape inside the picture, grown only if the safe area wouldn't fit
  let width = Math.min(source.width, source.height * ratio);
  width = Math.max(width, sw, sh * ratio);
  const height = width / ratio;
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
  // Final pixels per returned pixel
  const kx = area.width / crop.width;
  const ky = area.height / crop.height;
  const pl = Math.round(area.left + pad.left * kx);
  const pt = Math.round(area.top + pad.top * ky);
  const picture = {
    left: pl,
    top: pt,
    width: Math.min(target.width - pl, Math.round(area.left + (crop.width - pad.right) * kx) - pl),
    height: Math.min(target.height - pt, Math.round(area.top + (crop.height - pad.bottom) * ky) - pt),
  };
  const safeLands = {
    x: (area.left + (sx - crop.left) * kx) / target.width,
    y: (area.top + (sy - crop.top) * ky) / target.height,
    w: (sw * kx) / target.width,
    h: (sh * ky) / target.height,
  };
  return { crop, pad, visible: area, picture, safeLands };
}

export function framePlanFor(kind: BrandImageKind, source: Size): FramePlan {
  const spec = IMAGE_SPECS[kind];
  return planFrame(source, spec.final, spec.safe, spec.visible);
}

// The returned picture's own pixels fill the whole visible area, with nothing extended inside it
export function coversVisible(plan: FramePlan): boolean {
  const { picture: p, visible: v } = plan;
  return p.left <= v.left && p.top <= v.top && p.left + p.width >= v.left + v.width && p.top + p.height >= v.top + v.height;
}

// Whether code adds a soft extension around the picture
export function extended(plan: FramePlan, final: Size): boolean {
  const { picture: p } = plan;
  return p.left > 0 || p.top > 0 || p.left + p.width < final.width || p.top + p.height < final.height;
}

const inside = (inner: Box, outer: Box, slack: number) =>
  inner.x >= outer.x - slack && inner.y >= outer.y - slack && inner.x + inner.w <= outer.x + outer.w + slack && inner.y + inner.h <= outer.y + outer.h + slack;

// Run on every finished file: exact size, and the drawn safe area kept whole inside the visible area
export function checkFrame(kind: BrandImageKind, made: Size, plan: FramePlan): string[] {
  const { final, visible } = IMAGE_SPECS[kind];
  const problems: string[] = [];
  if (made.width !== final.width || made.height !== final.height) problems.push(`The file is ${made.width} × ${made.height}, not ${final.width} × ${final.height}.`);
  if (!inside(plan.safeLands, visible, 0.002)) problems.push("Part of the safe area was cropped off.");
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
