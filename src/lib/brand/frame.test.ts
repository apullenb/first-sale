import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { pngBytes } from "@/lib/photos/test-images";
import { checkFrame, framePlanFor, logoBoxFor, planFrame } from "./frame";
import { fitBrandImage } from "./fit";
import { IMAGE_SPECS } from "./sizes";
import { IMAGE_KINDS } from "./types";

const centered = { x: 0.2, y: 0.35, w: 0.6, h: 0.3 };
const within = (inner: { x: number; y: number; w: number; h: number }) => inner.x >= -0.001 && inner.y >= -0.001 && inner.x + inner.w <= 1.001 && inner.y + inner.h <= 1.001;

describe("brand image crop", () => {
  it("keeps the whole picture when the shape already matches", () => {
    const plan = planFrame({ width: 1600, height: 900 }, { width: 2560, height: 1440 }, centered);
    expect(plan.crop).toEqual({ left: 0, top: 0, width: 1600, height: 900 });
    expect(plan.safeLands.x).toBeCloseTo(0.2);
    expect(plan.safeLands.w).toBeCloseTo(0.6);
  });

  it("crops a too-wide picture around the safe area's center", () => {
    const plan = planFrame({ width: 2000, height: 900 }, { width: 1600, height: 900 }, centered);
    expect(plan.crop).toEqual({ left: 200, top: 0, width: 1600, height: 900 });
    expect(plan.pad).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    expect(within(plan.safeLands)).toBe(true);
  });

  it("crops a square picture to a wide shape without cutting the safe area", () => {
    const plan = planFrame({ width: 1024, height: 1024 }, { width: 1920, height: 1080 }, IMAGE_SPECS.youtube_banner.safe);
    expect(plan.crop.width / plan.crop.height).toBeCloseTo(16 / 9, 2);
    expect(plan.crop.top).toBeGreaterThan(0);
    expect(within(plan.safeLands)).toBe(true);
  });

  it("follows an off-center safe area, like Facebook's, and never cuts it", () => {
    const safe = IMAGE_SPECS.facebook_cover.safe;
    const plan = planFrame({ width: 2400, height: 1080 }, { width: 1920, height: 1080 }, safe);
    expect(within(plan.safeLands)).toBe(true);
    expect(plan.crop.left).toBeGreaterThan(0);
  });

  it("extends the edges rather than cut a safe area wider than the final shape allows", () => {
    // A tall picture with a wide safe area: the crop reaches past the sides
    const plan = planFrame({ width: 600, height: 1000 }, { width: 1920, height: 1080 }, { x: 0.05, y: 0.45, w: 0.9, h: 0.1 });
    expect(plan.pad.left + plan.pad.right + plan.pad.top + plan.pad.bottom).toBe(0);
    const wide = planFrame({ width: 1000, height: 1000 }, { width: 4000, height: 1000 }, { x: 0, y: 0.1, w: 1, h: 0.8 });
    expect(wide.pad.left + wide.pad.right).toBeGreaterThan(0);
    expect(within(wide.safeLands)).toBe(true);
  });

  it("flags a file that isn't the exact final size", () => {
    const plan = framePlanFor("link_preview", { width: 1200, height: 630 });
    expect(checkFrame("link_preview", { width: 1200, height: 630 }, plan)).toEqual([]);
    expect(checkFrame("link_preview", { width: 1199, height: 630 }, plan)).toEqual(["The file is 1199 × 630, not 1200 × 630."]);
  });

  it("puts a code-placed logo inside the safe area", () => {
    for (const kind of IMAGE_KINDS) {
      const { safe } = IMAGE_SPECS[kind];
      for (const logo of [{ width: 1536, height: 1024 }, { width: 400, height: 1200 }, { width: 3000, height: 300 }]) {
        const box = logoBoxFor(kind, logo);
        expect(box.x).toBeGreaterThanOrEqual(safe.x - 1e-9);
        expect(box.y).toBeGreaterThanOrEqual(safe.y - 1e-9);
        expect(box.x + box.w).toBeLessThanOrEqual(safe.x + safe.w + 1e-9);
        expect(box.y + box.h).toBeLessThanOrEqual(safe.y + safe.h + 1e-9);
      }
    }
  });
});

describe("fitting a brand image", () => {
  it("makes every kind at exactly its final size, whatever shape came back", async () => {
    for (const kind of IMAGE_KINDS) {
      for (const [w, h] of [[1024, 1024], [1536, 864], [1800, 600]]) {
        const fitted = await fitBrandImage(kind, pngBytes(w, h, 120));
        const meta = await sharp(fitted.data).metadata();
        expect([meta.width, meta.height, meta.format]).toEqual([IMAGE_SPECS[kind].final.width, IMAGE_SPECS[kind].final.height, "jpeg"]);
        expect(fitted.mimeType).toBe("image/jpeg");
      }
    }
  });
});
