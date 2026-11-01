import type { BrandBrief, ImageMedium } from "./types";
import type { Vibe } from "./vibes";

// Whether brand images are styled photos or illustrations, decided in code: photos unless the owner asked for drawings.
// The owner's Photo / Illustration switch, once used, overrides the rule.

export type ImageStyle = {
  medium: ImageMedium;
  // "owner": their switch decided; "rules": the brand answers did
  by: "owner" | "rules";
  light: string;
  // Playful or bright brands: photos that are punchy, saturated and fun
  lively: boolean;
  mood: string;
};

export type StyleAnswers = Pick<BrandBrief, "vibes" | "leanings" | "story" | "logoLikes">;

const DRAWN_VIBES: readonly Vibe[] = ["hand-drawn", "whimsical"];
// The owner's own words asking for drawings
const DRAWN_WORDS = /\b(cartoon\w*|illustrat\w*|doodle\w*|comics?|hand[- ]drawn|drawings?|sketch\w*|mascot\w*)\b/i;
const LIVELY_VIBES: readonly Vibe[] = [
  "playful",
  "quirky",
  "bold",
  "cheerful",
  "bright and colorful",
  "neon vibes",
  "groovy ’70s",
  "retro ’80s",
  "’90s throwback",
  "retro ’50s diner",
  "sporty",
  "tropical",
];
const MOODY_VIBES: readonly Vibe[] = ["dark and moody", "edgy", "grunge"];
const BRIGHT_VIBES: readonly Vibe[] = ["cheerful", "bright and colorful", "coastal", "beach shack", "tropical", "sporty", "soft pastels"];

// The rule alone, before the owner's switch
export function ruleMedium(brief: StyleAnswers): ImageMedium {
  const asked = DRAWN_WORDS.test(`${brief.story} ${brief.logoLikes}`);
  return asked || brief.vibes.some((vibe) => DRAWN_VIBES.includes(vibe)) ? "illustration" : "photo";
}

export function imageStyle(brief: StyleAnswers, chosen: ImageMedium | null = null): ImageStyle {
  const moody = brief.vibes.some((vibe) => MOODY_VIBES.includes(vibe));
  const lively = !moody && (brief.vibes.some((vibe) => LIVELY_VIBES.includes(vibe)) || brief.leanings.tone === "playful" || brief.leanings.energy === "loud");
  const bright = brief.vibes.some((vibe) => BRIGHT_VIBES.includes(vibe));
  const light = moody
    ? "low, directional light with deep shadows"
    : lively
      ? "bright, punchy daylight with crisp shadows"
      : bright
        ? "bright, clean daylight"
        : "warm, soft natural light";
  return { medium: chosen ?? ruleMedium(brief), by: chosen ? "owner" : "rules", light, lively, mood: brief.vibes.join(", ") };
}
