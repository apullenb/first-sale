import { describe, expect, it } from "vitest";
import { applyDesign, familyPalette, LETTERING_STYLES, planRefinement, refinementSchema } from "./refine";
import { testBrief, testConcept } from "./test-fixtures";

const current = (design: Parameters<typeof applyDesign>[2] = null) => ({ ...applyDesign(testConcept(), testBrief(), design), design });

describe("one-click changes", () => {
  it("make it simpler, keeping everything else", () => {
    const plan = planRefinement({ kind: "simpler" }, current());
    expect(plan).toMatchObject({ ok: true, label: "Simpler", design: { preset: "simpler" } });
    if (plan.ok) expect(plan.lines.join(" ")).toContain("Keep the same idea");
  });

  it("recolor from a color family, darkest first, as many colors as the logo has", () => {
    const plan = planRefinement({ kind: "colors", colors: { family: "cool blues" } }, current());
    expect(plan).toMatchObject({ ok: true, label: "Colors: cool blues", design: { preset: "colors" } });
    if (!plan.ok) return;
    expect(plan.design.palette!.map((color) => color.hex)).toEqual(["#1D3557", "#457B9D"]);
    expect(plan.lines[0]).toContain("#1D3557 (Dark blue)");
  });

  it("recolor with the owner's exact colors, named in plain words", () => {
    const plan = planRefinement({ kind: "colors", colors: { hexes: ["#5b2a86", "#5B2A86", "#f3a65a"] } }, current());
    expect(plan.ok && plan.design.palette).toEqual([
      { hex: "#5B2A86", name: "Purple" },
      { hex: "#F3A65A", name: "Orange" },
    ]);
  });

  it("refuse colors the logo already has", () => {
    const hexes = testConcept().palette.map((color) => color.hex.toLowerCase());
    expect(planRefinement({ kind: "colors", colors: { hexes } }, current())).toEqual({ ok: false, message: "Your logo already uses these colors." });
  });

  it("change the lettering style, and refuse the one it has", () => {
    const plan = planRefinement({ kind: "lettering", style: "slab" }, current());
    expect(plan).toMatchObject({ ok: true, label: "Lettering: sturdy slab serif", design: { typography: LETTERING_STYLES.slab.typography } });
    const again = planRefinement({ kind: "lettering", style: "slab" }, current({ typography: LETTERING_STYLES.slab.typography }));
    expect(again).toEqual({ ok: false, message: "Your logo already has this lettering." });
  });

  it("add, change and remove the tagline, in the owner's words", () => {
    expect(planRefinement({ kind: "tagline", text: "  Sourdough\nand pastries " }, current())).toMatchObject({
      ok: true,
      label: "Tagline added: “Sourdough and pastries”",
      design: { tagline: "Sourdough and pastries" },
    });
    expect(planRefinement({ kind: "tagline", text: "Bread" }, current({ tagline: "Old words" }))).toMatchObject({ ok: true, label: "Tagline changed to “Bread”" });
    expect(planRefinement({ kind: "tagline", text: "" }, current({ tagline: "Old words" }))).toMatchObject({ ok: true, label: "Tagline removed", design: { tagline: "" } });
    expect(planRefinement({ kind: "tagline", text: "" }, current())).toEqual({ ok: false, message: "This logo has no tagline." });
    expect(planRefinement({ kind: "tagline", text: "Old words" }, current({ tagline: "Old words" }))).toEqual({ ok: false, message: "This logo already has your tagline." });
  });

  it("keep earlier changes when another is made", () => {
    const plan = planRefinement({ kind: "simpler" }, current({ tagline: "", palette: [{ hex: "#111111", name: "Black" }], preset: "colors" }));
    expect(plan.ok && plan.design).toEqual({ tagline: "", palette: [{ hex: "#111111", name: "Black" }], preset: "simpler" });
  });

  it("accept only known families, styles and real hex colors", () => {
    expect(refinementSchema.safeParse({ kind: "colors", colors: { family: "rainbow" } }).success).toBe(false);
    expect(refinementSchema.safeParse({ kind: "colors", colors: { hexes: ["red"] } }).success).toBe(false);
    expect(refinementSchema.safeParse({ kind: "colors", colors: { hexes: ["#000000", "#111111", "#222222", "#333333"] } }).success).toBe(false);
    expect(refinementSchema.safeParse({ kind: "lettering", style: "comic" }).success).toBe(false);
  });
});

describe("the logo as drawn", () => {
  it("is the idea with any one-click changes on top", () => {
    const drawn = applyDesign(testConcept(), testBrief({ tagline: "Baked at dawn" }), { palette: [{ hex: "#111111", name: "Black" }], tagline: "" });
    expect(drawn.concept.palette).toEqual([{ hex: "#111111", name: "Black" }]);
    expect(drawn.concept.typography).toBe(testConcept().typography);
    expect(drawn.brief.tagline).toBe("");
    expect(applyDesign(testConcept(), testBrief(), null).concept).toEqual(testConcept());
  });

  it("leaves out family colors too light to see on white", () => {
    expect(familyPalette("black and white", 3).map((color) => color.hex)).toEqual(["#111111", "#777777"]);
    expect(familyPalette("sunny yellows", 3).map((color) => color.hex)).toEqual(["#E9B824", "#F6D55C"]);
  });
});
