import { IMAGE_KINDS } from "@/lib/brand/types";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { createMockImageProvider } from "@/lib/ai/providers/mock-image";
import { imageStyle } from "@/lib/brand/image-style";
import { brandBriefSchema } from "@/lib/brand/types";
import { imageInfo } from "@/lib/photos/image-info";
import { liveRefusal, parseArgs } from "./args";
import { Budget } from "./budget";
import { assetCheckSummary, indexMarkdown, promptSummary, reviewSummary, runScenario, totalsOf, trackImages } from "./image-quality";
import { IMAGE_SCENARIOS } from "./image-scenarios";
import { pricesFor } from "./pricing";
import { Recorder } from "./recorder";

const MUSE = pricesFor("muse-spark-1.3");
const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "image-quality-"));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup(budget: Budget | null) {
  const recorder = new Recorder(MUSE, budget);
  recorder.beginRun();
  const model = recorder.wrapModel(createMockProvider());
  const image = recorder.wrapImage(createMockImageProvider());
  return { recorder, ctx: { model, image, prices: MUSE, budget, now: new Date("2026-10-31T12:00:00Z"), dir: tempDir() } };
}

describe("image-quality flags", () => {
  it("parses --image-quality and --scenarios, and keeps the mock free", () => {
    const options = parseArgs(["--image-quality", "--scenarios", "taco-truck"]);
    expect(options).toMatchObject({ imageQuality: true, scenarios: ["taco-truck"], provider: "mock" });
    expect(liveRefusal(options, MUSE)).toBeNull();
  });

  it("refuses a live picture run without --budget, or without a checked image price", () => {
    expect(liveRefusal(parseArgs(["--image-quality", "--live", "--yes"]), MUSE)).toMatch(/--budget/);
    expect(liveRefusal(parseArgs(["--image-quality", "--live", "--yes", "--budget", "3"]), MUSE)).toBeNull();
    expect(liveRefusal(parseArgs(["--image-quality", "--live", "--yes", "--budget", "3"]), { ...MUSE, imagePerPicture: null })).toMatch(/--image-quality is refused/);
  });

  it("rejects flags that don't apply", () => {
    expect(() => parseArgs(["--scenarios", "taco-truck"])).toThrow(/only works with --image-quality/);
    expect(() => parseArgs(["--image-quality", "--tasks", "intake"])).toThrow(/don't apply/);
  });
});

describe("image scenarios", () => {
  it("has the four businesses, each a valid brief, with both kinds of brand image", () => {
    expect(IMAGE_SCENARIOS.map((each) => each.id)).toEqual(["dog-grooming", "soy-candles", "taco-truck", "western-boutique"]);
    expect(IMAGE_SCENARIOS.map((each) => imageStyle({ ...each.brief, story: "" }).medium)).toEqual(["photo", "photo", "photo", "photo"]);
    for (const scenario of IMAGE_SCENARIOS) {
      expect(brandBriefSchema.safeParse({ ...scenario.brief, story: "", storyByOwner: false, storyApproved: false }).success).toBe(true);
      expect(scenario.logoChange.length).toBeGreaterThan(3);
      expect(scenario.photo.prompt.length).toBeGreaterThan(20);
    }
  });
});

describe("image-quality run (practice mode)", () => {
  it("makes and saves every kind of picture, with what made it and the app's check", async () => {
    const { recorder, ctx } = setup(null);
    const result = await runScenario(ctx, IMAGE_SCENARIOS[1]);
    recorder.close();

    expect(result.notes).toEqual([]);
    expect(result.story).toMatch(/practice sample/);
    expect(result.taglines.length).toBeGreaterThan(0);
    const steps = result.pictures.map((picture) => picture.step);
    expect(steps).toEqual([
      ...result.concepts.map((_, index) => `01-logo-idea-${index + 1}`),
      "02-version-stacked",
      "02-version-profile",
      "02-version-solid",
      "03-logo-edit",
      ...IMAGE_KINDS.map((kind) => `04-image-${kind}`),
      "05-image-edit-website_hero",
      "06-photo-original",
      "07-photo-edit",
    ]);
    for (const picture of result.pictures) {
      expect(picture.status).toBe("made");
      expect(existsSync(path.join(ctx.dir, picture.file!))).toBe(true);
      expect(existsSync(path.join(ctx.dir, "images", "soy-candles", `${picture.step}.json`))).toBe(true);
      expect(picture.check).not.toBe("");
    }
    // Practice brand files are labeled placeholders; the photo edit is a real PNG
    expect(readFileSync(path.join(ctx.dir, result.pictures[0].file!), "utf8")).toMatch(/Practice preview/i);
    expect(imageInfo(readFileSync(path.join(ctx.dir, result.pictures.at(-1)!.file!)))?.type).toBe("image/png");
    expect(result.pictures.find((picture) => picture.step === "07-photo-edit")?.prompt).toMatch(/product photo/);
    // Practice logos are placeholders, not PNGs to take apart, so versions are recorded as the model's, with why
    for (const kind of ["stacked", "profile", "solid"]) expect(result.pictures.find((picture) => picture.step === `02-version-${kind}`)?.built).toBe("model");

    const totals = totalsOf([result], recorder.current().calls, 1000);
    expect(totals).toMatchObject({ pictures: result.pictures.length, made: result.pictures.length, failed: 0, skipped: 0 });
    // The test photo is drawn in code in practice mode, so it isn't an image call
    expect(totals.imageCalls).toBe(result.pictures.length - 1);
    const index = indexMarkdown(
      {
        startedAt: "s",
        finishedAt: "f",
        provider: { name: "Mock", model: "mock", simulated: true },
        imageModel: { name: "Practice preview", model: "practice-preview", simulated: true },
        prices: MUSE,
        budget: null,
      },
      [result],
      totals,
    );
    expect(index).toMatch(/Practice mode/);
    for (const picture of result.pictures) expect(index).toContain(picture.file!);
  });

  it("stops starting new calls once the budget is reached", async () => {
    const budget = new Budget(0.1);
    const { recorder, ctx } = setup(budget);
    const result = await runScenario(ctx, IMAGE_SCENARIOS[0]);
    recorder.close();

    expect(budget.stopped).toBe(true);
    expect(budget.spent).toBeLessThanOrEqual(0.1);
    expect(result.pictures.some((picture) => picture.status === "made")).toBe(true);
    expect(result.pictures.filter((picture) => picture.status === "skipped").length).toBeGreaterThan(0);
    expect(result.notes.join(" ")).toMatch(/budget reached/i);
  });
});

describe("image-quality helpers", () => {
  it("times each image call by its prompt", async () => {
    const tracked = trackImages(createMockImageProvider());
    await tracked.image.generate!({ prompt: "a", size: "10x10" });
    expect(tracked.take("a")).toMatchObject({ ok: true, error: null });
    expect(tracked.take("a")).toBeNull();
  });

  it("summarizes the app's checks in plain words", () => {
    const check = {
      checkedAt: "x",
      method: "ai" as const,
      lettering: { status: "misspelled" as const, read: ["TWO PINS"], problems: ["“Pines” is spelled “Pins”."], note: null },
      drift: [{ kind: "color" as const, detail: "Green turned blue" }],
    };
    expect(assetCheckSummary(check)).toBe("Lettering: misspelled (read “TWO PINS”). “Pines” is spelled “Pins”. Differs from logo: color: Green turned blue");
    const built = { checkedAt: "x", method: "code" as const, lettering: null, drift: [], layout: { built: "code" as const, note: "Built in code: the symbol alone.", confidence: 1 } };
    expect(assetCheckSummary(built)).toBe("Built in code, nothing redrawn: Built in code: the symbol alone.");
    const drawn = { ...check, drift: [], layout: { built: "model" as const, note: "Drawn by the image model: no lettering found.", confidence: 0 } };
    expect(assetCheckSummary(drawn)).toMatch(/^Drawn by the image model: no lettering found\. Lettering: misspelled/);
    expect(reviewSummary({ checkedAt: "x", method: "failed", flags: [] })).toMatch(/failed/);
    expect(promptSummary("a  b\n c", 280)).toBe("a b c");
    expect(promptSummary("x".repeat(400), 10)).toHaveLength(10);
  });
});
