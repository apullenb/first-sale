import { z } from "zod";
import { ownerText } from "@/lib/photos/instructions";
import { colorName, contrast, darkestFirst, HEX } from "./colors";
import { BRIEF_LIMITS, type BrandBrief, type BrandDesign, type ConceptReply, type PaletteColor } from "./types";
import { COLOR_FAMILIES, COLOR_FAMILY_NAMES, type ColorFamily } from "./vibes";

// One-click changes to a drawn logo. Code writes the instruction and records what changed,
// so versions, spelling checks, the kit and the guide follow the logo rather than the original idea.

export const LETTERING_STYLES = {
  modern_sans: { label: "Clean and modern", typography: "clean, modern sans-serif lettering with even strokes" },
  classic_serif: { label: "Classic serif", typography: "classic serif lettering with traditional proportions" },
  rounded: { label: "Soft and rounded", typography: "friendly rounded sans-serif lettering with soft corners" },
  hand: { label: "Hand-lettered", typography: "hand-lettered brush lettering that is still easy to read" },
  bold: { label: "Bold and chunky", typography: "bold, chunky display lettering with heavy strokes" },
  script: { label: "Flowing script", typography: "flowing, connected script lettering that is still easy to read" },
  retro: { label: "Retro sign", typography: "retro display lettering with a vintage sign-painter feel" },
  slab: { label: "Sturdy slab serif", typography: "sturdy slab-serif lettering with blocky serifs" },
} as const;
export type LetteringStyle = keyof typeof LETTERING_STYLES;
export const LETTERING_STYLE_KEYS = Object.keys(LETTERING_STYLES) as [LetteringStyle, ...LetteringStyle[]];

export const refinementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("simpler") }),
  z.object({
    kind: z.literal("colors"),
    // A color family from the brief's list, or exact colors the owner picked
    colors: z.union([z.object({ family: z.enum(COLOR_FAMILY_NAMES) }), z.object({ hexes: z.array(z.string().regex(HEX)).min(1).max(3) })]),
  }),
  z.object({ kind: z.literal("lettering"), style: z.enum(LETTERING_STYLE_KEYS) }),
  // The tagline to show, typed or kept by the owner; empty removes it
  z.object({ kind: z.literal("tagline"), text: z.string().max(BRIEF_LIMITS.tagline * 2) }),
]);
export type Refinement = z.infer<typeof refinementSchema>;

// What a file made from a logo carries over: its changes, but not which one-click change made it
export function inherited(design: BrandDesign | null): BrandDesign | null {
  if (!design) return null;
  const rest = { ...design };
  delete rest.preset;
  return Object.keys(rest).length ? rest : null;
}

// The logo as drawn: the idea and brief it came from, with any one-click changes applied
export function applyDesign(concept: ConceptReply, brief: BrandBrief, design: BrandDesign | null): { concept: ConceptReply; brief: BrandBrief } {
  if (!design) return { concept, brief };
  return {
    concept: { ...concept, palette: design.palette ?? concept.palette, typography: design.typography ?? concept.typography },
    brief: { ...brief, tagline: design.tagline ?? brief.tagline },
  };
}

// Near-white swatches can't be seen on a white logo background, so they're left out
export function familyPalette(family: ColorFamily, count: number): PaletteColor[] {
  const visible = COLOR_FAMILIES[family].filter((hex) => contrast(hex, "#ffffff") >= 1.25);
  const swatches = visible.length ? visible : [COLOR_FAMILIES[family][0]];
  const palette = darkestFirst(swatches.map((hex) => ({ hex: hex.toUpperCase(), name: colorName(hex) })));
  return palette.slice(0, Math.max(1, Math.min(count, palette.length)));
}

export type RefinePlan = { ok: true; label: string; lines: string[]; design: BrandDesign } | { ok: false; message: string };

const sameColors = (a: PaletteColor[], b: PaletteColor[]) => a.length === b.length && a.every((color, index) => color.hex.toUpperCase() === b[index].hex.toUpperCase());

// `current` is the logo as drawn
export function planRefinement(refinement: Refinement, current: { concept: ConceptReply; brief: BrandBrief; design: BrandDesign | null }): RefinePlan {
  const base = current.design ?? {};
  switch (refinement.kind) {
    case "simpler":
      return {
        ok: true,
        label: "Simpler",
        lines: [
          "Make this logo simpler: fewer shapes and less detail, thicker lines and more empty space, so it still reads as a tiny icon.",
          "Keep the same idea, the same lettering style, the same colors and the same layout.",
        ],
        design: { ...base, preset: "simpler" },
      };
    case "colors": {
      const palette =
        "family" in refinement.colors
          ? familyPalette(refinement.colors.family, current.concept.palette.length)
          : [...new Set(refinement.colors.hexes.map((hex) => hex.toUpperCase()))].map((hex) => ({ hex, name: colorName(hex) }));
      if (sameColors(darkestFirst(palette), darkestFirst(current.concept.palette))) return { ok: false, message: "Your logo already uses these colors." };
      const list = palette.map((color) => `${color.hex} (${color.name})`).join(", ");
      return {
        ok: true,
        label: "family" in refinement.colors ? `Colors: ${refinement.colors.family}` : `Colors: ${palette.map((color) => color.hex).join(", ")}`,
        lines: [
          `Change only the colors, to exactly these: ${list}.`,
          "Where the logo uses its darkest color now, use the darkest new color, and so on from dark to light.",
          "Keep every shape, every letter and the layout exactly the same.",
        ],
        design: { ...base, palette, preset: "colors" },
      };
    }
    case "lettering": {
      const style = LETTERING_STYLES[refinement.style];
      if (current.concept.typography === style.typography) return { ok: false, message: "Your logo already has this lettering." };
      return {
        ok: true,
        label: `Lettering: ${style.label.toLowerCase()}`,
        lines: [`Redraw only the lettering, in this style: ${style.typography}.`, "Keep the symbol, the colors, the layout and the spelling exactly the same."],
        design: { ...base, typography: style.typography, preset: "lettering" },
      };
    }
    case "tagline": {
      const has = current.brief.tagline.trim();
      const tagline = ownerText(refinement.text, BRIEF_LIMITS.tagline);
      if (!tagline) {
        if (!has) return { ok: false, message: "This logo has no tagline." };
        return {
          ok: true,
          label: "Tagline removed",
          lines: ["Remove the tagline, so the business name is the only lettering.", "Keep everything else exactly the same, and close up the space the tagline used."],
          design: { ...base, tagline: "", preset: "tagline" },
        };
      }
      if (has === tagline) return { ok: false, message: "This logo already has your tagline." };
      return {
        ok: true,
        label: has ? `Tagline changed to “${tagline}”` : `Tagline added: “${tagline}”`,
        lines: [
          has
            ? `Replace the tagline with “${tagline}”, in the same place and style.`
            : `Add the tagline “${tagline}” under the name, smaller than the name, in lettering that matches the logo but is quieter.`,
          "Keep the name, the symbol and the colors exactly the same.",
        ],
        design: { ...base, tagline, preset: "tagline" },
      };
    }
  }
}
