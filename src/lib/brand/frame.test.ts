import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { pngBytes } from "@/lib/photos/test-images";
import { checkFrame, coversVisible, extended, framePlanFor, logoBoxFor, planFrame } from "./frame";
import { fitBrandImage } from "./fit";
import { practiceLabelBox, practiceSize } from "./practice";
import { IMAGE_SPECS, requestSize } from "./sizes";
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

describe("visible area", () => {
  it("asks for the visible band's shape where it differs a lot from the file's", () => {
    expect(IMAGE_SPECS.youtube_banner.size).toBe("2560x423");
    expect(IMAGE_SPECS.facebook_cover.size).toBe("1920x711");
    expect(IMAGE_SPECS.flyer.size).toBe("2550x1650");
    expect(IMAGE_SPECS.instagram_story.size).toBe("1080x1382");
    for (const kind of ["website_hero", "link_preview", "instagram_post", "ad_square", "product_scene"] as const) {
      expect(IMAGE_SPECS[kind].size).toBe(`${IMAGE_SPECS[kind].final.width}x${IMAGE_SPECS[kind].final.height}`);
    }
    for (const kind of IMAGE_KINDS) {
      const { width, height } = requestSize(IMAGE_SPECS[kind]);
      expect(Math.max(width / height, height / width)).toBeLessThanOrEqual(16);
      const { safe, visible } = IMAGE_SPECS[kind];
      expect(safe.x >= visible.x - 1e-9 && safe.y >= visible.y - 1e-9 && safe.x + safe.w <= visible.x + visible.w + 1e-9 && safe.y + safe.h <= visible.y + visible.h + 1e-9).toBe(true);
    }
  });

  it("fills the whole visible area with the drawn picture for YouTube and Facebook, and extends the rest", () => {
    for (const kind of ["youtube_banner", "facebook_cover"] as const) {
      const asked = requestSize(IMAGE_SPECS[kind]);
      for (const scale of [1, 0.4]) {
        const plan = framePlanFor(kind, { width: Math.round(asked.width * scale), height: Math.round(asked.height * scale) });
        expect(coversVisible(plan)).toBe(true);
        expect(extended(plan, IMAGE_SPECS[kind].final)).toBe(true);
        expect(checkFrame(kind, IMAGE_SPECS[kind].final, plan)).toEqual([]);
      }
    }
  });

  it("places a band-shaped picture exactly on the visible area", () => {
    const visible = { x: 0, y: 0.25, w: 1, h: 0.5 };
    const plan = planFrame({ width: 1000, height: 250 }, { width: 2000, height: 1000 }, { x: 0.1, y: 0.3, w: 0.8, h: 0.4 }, visible);
    expect(plan.crop).toEqual({ left: 0, top: 0, width: 1000, height: 250 });
    expect(plan.visible).toEqual({ left: 0, top: 250, width: 2000, height: 500 });
    expect(plan.picture).toEqual(plan.visible);
    expect(plan.safeLands.x).toBeCloseTo(0.1);
    expect(plan.safeLands.y).toBeCloseTo(0.3);
    expect(plan.safeLands.h).toBeCloseTo(0.4);
  });

  it("crops a too-wide picture to the band around the safe area", () => {
    const plan = framePlanFor("youtube_banner", { width: 4000, height: 423 });
    expect(plan.crop.width / plan.crop.height).toBeCloseTo(2560 / 423, 1);
    expect(coversVisible(plan)).toBe(true);
    expect(checkFrame("youtube_banner", { width: 2560, height: 1440 }, plan)).toEqual([]);
  });

  it("leaves the edges to the soft extension when the safe area can't fit the returned shape", () => {
    const plan = planFrame({ width: 500, height: 1000 }, { width: 2000, height: 1000 }, { x: 0, y: 0.25, w: 1, h: 0.5 }, { x: 0, y: 0.25, w: 1, h: 0.5 });
    expect(plan.pad.left + plan.pad.right).toBeGreaterThan(0);
    expect(coversVisible(plan)).toBe(false);
    expect(plan.picture.left).toBeGreaterThan(0);
    expect(plan.picture.left + plan.picture.width).toBeLessThanOrEqual(2000);
  });

  it("keeps the practice label inside the visible area", () => {
    for (const kind of IMAGE_KINDS) {
      const { width, height } = practiceSize(kind);
      const { visible, final } = IMAGE_SPECS[kind];
      expect(width / height).toBeCloseTo(final.width / final.height, 1);
      const box = practiceLabelBox(kind, width, height);
      expect(box.y).toBeGreaterThanOrEqual(visible.y * height - 1e-6);
      expect(box.y + box.height).toBeLessThanOrEqual((visible.y + visible.h) * height + 1e-6);
    }
  });
});

describe("fitting a brand image", () => {
  it("fills the band with the picture and the rest with a soft copy, never white or mirrored", async () => {
    const fitted = await fitBrandImage("youtube_banner", pngBytes(2560, 423, 120));
    const { data, info } = await sharp(fitted.data).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3));
    expect([info.width, info.height]).toEqual([2560, 1440]);
    // Above the band: a darker copy of the picture, not a blank fill
    const above = at(1280, 100);
    const inside = at(1280, 720);
    expect(above.some((value) => value < 250)).toBe(true);
    expect(above.reduce((a, b) => a + b)).toBeLessThan(inside.reduce((a, b) => a + b));
    expect(fitted.note).toMatch(/extended softly/);
  });

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
