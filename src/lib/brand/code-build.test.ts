import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pngBytes } from "@/lib/photos/test-images";
import { applyEdit, buildVersion, codeEdit } from "./code-build";
import { letterCount } from "./layout";
import { decodePng } from "./png";

const logo = (name: string) => new Uint8Array(readFileSync(path.join(__dirname, "test-logos", `${name}.png`)));
const dog = { bytes: logo("dog-grooming"), letters: letterCount("Wagging Wheels Grooming") };
const badge = { bytes: logo("western-boutique"), letters: letterCount("Prairie Rose Boutique") };

describe("which edits code makes", () => {
  it("takes short, exact requests", () => {
    expect(codeEdit("Make the lettering bolder")).toEqual({ kind: "bolder", amount: 0.18 });
    expect(codeEdit("make the letters a lot thicker!")).toEqual({ kind: "bolder", amount: 0.3 });
    expect(codeEdit("Bolder text")).toMatchObject({ kind: "bolder" });
    expect(codeEdit("Make the symbol bigger")).toEqual({ kind: "symbol", scale: 1.2 });
    expect(codeEdit("make the icon a little smaller")).toEqual({ kind: "symbol", scale: 0.83 });
    expect(codeEdit("Make the lettering navy")).toMatchObject({ kind: "recolor", target: "lettering", hex: "#1B2A4A" });
    expect(codeEdit("Make the text dark green")).toMatchObject({ kind: "recolor", target: "lettering" });
    expect(codeEdit("Make it all black")).toMatchObject({ kind: "recolor", target: "all", hex: "#111111" });
  });

  it("leaves anything else to the image model", () => {
    for (const change of ["Make the lettering bolder and red", "Add a tagline", "Make it pop", "Make the lettering sparkly", "Make the dog bigger", "Make the lettering white"]) {
      expect(codeEdit(change)).toBeNull();
    }
  });
});

describe("versions built from the logo", () => {
  it("builds the stacked version and the icon of a logo that splits", () => {
    for (const kind of ["stacked", "profile"] as const) {
      const built = buildVersion(dog.bytes, kind, { letters: dog.letters, ink: "#162F4D" });
      expect(built.ok).toBe(true);
      if (built.ok) {
        expect(built.image.width).toBe(built.image.height);
        expect(built.note).toMatch(/^Built in code/);
      }
    }
  });

  it("makes a badge's one-color version with its pale fill as paper, not a tint", () => {
    const built = buildVersion(badge.bytes, "solid", { letters: badge.letters, ink: "#72442C" });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const original = decodePng(badge.bytes)!;
    // Inside the badge, between the ring and the flower: cream in the logo, page white here
    const at = (Math.round(original.height * 0.5) * original.width + Math.round(original.width * 0.2)) * 4;
    expect(Array.from(original.data.slice(at, at + 3))).not.toEqual([255, 255, 255]);
    expect(Array.from(built.image.data.slice(at, at + 3))).toEqual(Array.from(built.image.data.slice(0, 3)));
  });

  it("says why when it can't, so the image model draws it", () => {
    const blank = buildVersion(pngBytes(300, 200, 255), "stacked", { letters: 5, ink: "#111111" });
    expect(blank).toMatchObject({ ok: false, confidence: 0 });
    const svg = buildVersion(new TextEncoder().encode("<svg/>"), "profile", { letters: 5, ink: "#111111" });
    expect(svg).toMatchObject({ ok: false, note: "The logo file isn’t a PNG SnapStart can take apart." });
    const wrongName = buildVersion(dog.bytes, "stacked", { letters: 60, ink: "#111111" });
    expect(wrongName.ok).toBe(false);
    expect(wrongName.note).toContain("letter shapes where the name has 60 letters");
  });
});

describe("edits made in code", () => {
  it("thickens the lettering of a logo that splits", () => {
    const built = applyEdit(dog.bytes, codeEdit("Make the lettering bolder")!, dog.letters);
    expect(built.ok).toBe(true);
    expect(built.note).toMatch(/^Done in code: each letter’s strokes made \d+ pixels thicker/);
  });

  it("recolors only the lettering", () => {
    const built = applyEdit(dog.bytes, codeEdit("Make the lettering red")!, dog.letters);
    expect(built.ok).toBe(true);
  });

  it("leaves a badge's lettering to the image model", () => {
    const built = applyEdit(badge.bytes, codeEdit("Make the lettering bolder")!, badge.letters);
    expect(built).toMatchObject({ ok: false });
    expect(built.note).toContain("badge");
  });
});
