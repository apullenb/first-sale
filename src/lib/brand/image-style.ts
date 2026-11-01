import type { BrandBrief } from "./types";
import type { Vibe } from "./vibes";

// Whether brand images are styled photos or illustrations, decided in code from the owner's brand answers.
// Illustration only when the answers say playful, drawn or cartoony; every other brand gets photography.

export type ImageStyle = { medium: "photo" | "illustration"; light: string; mood: string };

const ILLUSTRATED_VIBES: readonly Vibe[] = [
  "playful",
  "whimsical",
  "quirky",
  "hand-drawn",
  "bright and colorful",
  "neon vibes",
  "groovy ’70s",
  "retro ’80s",
  "’90s throwback",
  "retro ’50s diner",
];
// The owner's own words asking for drawings
const DRAWN_WORDS = /\b(cartoon\w*|illustrat\w*|doodle\w*|comic\w*|animated|hand[- ]drawn|drawn|sketch\w*|mascot)\b/i;
const MOODY_VIBES: readonly Vibe[] = ["dark and moody", "edgy", "grunge"];
const BRIGHT_VIBES: readonly Vibe[] = ["cheerful", "bright and colorful", "coastal", "beach shack", "tropical", "sporty", "soft pastels"];

export function imageStyle(brief: Pick<BrandBrief, "vibes" | "leanings" | "story" | "logoLikes">): ImageStyle {
  const drawnVibes = brief.vibes.filter((vibe) => ILLUSTRATED_VIBES.includes(vibe)).length;
  const asked = DRAWN_WORDS.test(`${brief.story} ${brief.logoLikes}`);
  const playful = brief.leanings.tone === "playful";
  const illustrated = asked || drawnVibes >= 2 || (playful && drawnVibes >= 1);
  const moody = brief.vibes.some((vibe) => MOODY_VIBES.includes(vibe));
  const bright = brief.vibes.some((vibe) => BRIGHT_VIBES.includes(vibe));
  const light = moody ? "low, directional light with deep shadows" : bright ? "bright, clean daylight" : "warm, soft natural light";
  return { medium: illustrated ? "illustration" : "photo", light, mood: brief.vibes.join(", ") };
}
