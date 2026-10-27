import { ownerText } from "@/lib/photos/instructions";
import { IMAGE_SPECS } from "./sizes";
import { BRIEF_LIMITS, type BrandBrief, type BrandImageKind, type ConceptKind, type ConceptReply, type VersionKind } from "./types";
import { LEANINGS, type LeaningKey } from "./vibes";

// Muse Image instructions, built by code from the brief and a concept. The owner never writes one.

export const MAX_CHANGE = 300;

export const CONCEPT_KINDS_TEXT: Record<ConceptKind, { label: string; describe: string }> = {
  wordmark: { label: "Wordmark", describe: "A wordmark: the business name itself in distinctive custom lettering, with no separate symbol" },
  monogram: { label: "Monogram", describe: "A monogram: the business’s initials formed into one distinctive mark, with the full name beside or below it" },
  emblem: { label: "Badge", describe: "An emblem: the name and a simple symbol together inside a badge, seal or stamp shape" },
  illustrative: { label: "Drawn symbol", describe: "A simple drawn symbol next to the business name" },
  abstract: { label: "Abstract symbol", describe: "A simple abstract shape that suggests the idea, next to the business name" },
  lettermark_symbol: { label: "Letter and symbol", describe: "One letter of the name combined with a simple symbol, next to the full name" },
};

export const QUALITY_RULES = [
  "Simple and distinctive, built on one clear idea. It must still be recognizable as a tiny 32-pixel browser icon.",
  "Flat, vector-style artwork: solid shapes, a strong silhouette and balanced negative space.",
  "Use 1 to 3 of the listed colors, and make sure the design would also work in a single color.",
  "One logo, centered on a plain white background, with generous empty margins on every side.",
  "No mockups (no business cards, signs, paper, walls, packaging or products), no 3D, no photorealism, no gradients, no drop shadows, glows or textures, and no stock clip art.",
  "Original: don’t imitate any existing company’s logo or trademark.",
] as const;

const clean = ownerText;

// "Rise Bakery" → R-i-s-e B-a-k-e-r-y, so every letter is stated
export function spellOut(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => Array.from(word).join("-"))
    .join(" ");
}

function lettering(brief: BrandBrief): string[] {
  const name = clean(brief.name, BRIEF_LIMITS.name);
  const tagline = clean(brief.tagline, BRIEF_LIMITS.tagline);
  return [
    `Business name, spelled exactly: “${name}” (letter by letter: ${spellOut(name)}). Letter case may follow the lettering style, but every letter must be there, in this order.`,
    tagline ? `Tagline, smaller than the name and spelled exactly: “${tagline}” (${spellOut(tagline)}).` : "No tagline.",
    `The only words are the business name${tagline ? " and the tagline" : ""}. No other letters, numbers, dates, slogans or “est.” lines.`,
  ];
}

// The leanings the owner picked, in drawing terms
export function leaningWords(brief: BrandBrief): string[] {
  return (Object.keys(LEANINGS) as LeaningKey[]).flatMap((key) => {
    const value = brief.leanings[key];
    return value ? [(LEANINGS[key].guidance as Record<string, string>)[value]] : [];
  });
}

export function feel(brief: BrandBrief): string[] {
  const leanings = leaningWords(brief);
  const story = clean(brief.story, BRIEF_LIMITS.story);
  return [
    brief.vibes.length ? `Feel: ${brief.vibes.join(", ")}.` : null,
    leanings.length ? `Leaning: ${leanings.join(", ")}.` : null,
    story ? `The owner’s brand picture, for mood and style only: “${story}”` : null,
  ].filter((line): line is string => line !== null);
}

function business(brief: BrandBrief): string[] {
  return [
    `What they sell: ${clean(brief.sells, BRIEF_LIMITS.sells)}.`,
    brief.customers.trim() ? `Their customers: ${clean(brief.customers, BRIEF_LIMITS.customers)}.` : null,
    ...feel(brief),
  ].filter((line): line is string => line !== null);
}

function colors(brief: BrandBrief, concept: ConceptReply): string[] {
  return [
    `Colors, flat, only these: ${concept.palette.map((color) => `${color.hex} (${clean(color.name, 40)})`).join(", ")}.`,
    brief.avoidColors.trim() ? `Never use: ${clean(brief.avoidColors, BRIEF_LIMITS.colors)}.` : null,
  ].filter((line): line is string => line !== null);
}

function design(concept: ConceptReply): string[] {
  return [
    `Concept “${clean(concept.title, 60)}”: ${clean(concept.idea, 400)}`,
    concept.symbol ? `Symbol: ${clean(concept.symbol, 240)}` : "No separate symbol: the lettering is the logo.",
    `Lettering: ${clean(concept.typography, 240)}`,
  ];
}

const rules = (list: readonly string[]) => ["Quality rules:", ...list.map((rule) => `- ${rule}`)];

export function logoPrompt(brief: BrandBrief, concept: ConceptReply): string {
  const avoid = clean(brief.avoid, BRIEF_LIMITS.avoid);
  return [
    `Design one original logo for a small US business. ${CONCEPT_KINDS_TEXT[concept.kind].describe}.`,
    "",
    ...lettering(brief),
    "",
    ...business(brief),
    "",
    ...design(concept),
    ...colors(brief, concept),
    avoid ? `Avoid: ${avoid}.` : null,
    brief.story.trim() ? "Let the brand picture guide the style, but don’t draw its scene unless the concept says to: a logo stays one simple mark." : null,
    "",
    ...rules(QUALITY_RULES),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

// Image 1 is the draft being changed
export function refinePrompt(brief: BrandBrief, concept: ConceptReply, change: string): string {
  return [
    "Image 1 is a logo draft. Change it as the owner asks below, and keep everything else about the design the same.",
    `The owner’s change: “${clean(change, MAX_CHANGE)}”`,
    "",
    ...lettering(brief),
    "",
    ...design(concept),
    ...colors(brief, concept),
    "",
    ...rules(QUALITY_RULES),
  ].join("\n");
}

const VERSION_LAYOUT: Record<VersionKind, (concept: ConceptReply) => string[]> = {
  stacked: (concept) => [
    "Make the stacked version of this logo for square spaces.",
    concept.symbol
      ? "Put the same symbol centered on top, with the business name centered underneath it."
      : "Put the logo’s first letter, drawn in the logo’s own lettering style, centered on top as a symbol, with the full business name centered underneath it.",
    "Square layout, centered on plain white, with generous margins.",
  ],
  profile: (concept) => [
    "Make the profile-picture version of this logo, for social media, where it gets cropped to a circle.",
    concept.symbol
      ? "Show only the symbol, without the business name or tagline."
      : "Show only the logo’s first letter, drawn in the logo’s own lettering style, with no other words.",
    "Center it in a square on plain white, and keep all of it inside the middle 70% of the width and height, so nothing is lost when it’s cropped to a circle.",
  ],
  solid: () => [
    "Make the one-color version of this logo, for stamps, stickers and embroidery.",
    "Draw the whole logo, symbol and name, in one single solid color: the darkest color in the logo. Plain white background.",
    "No second color, no tints, no outlines in another color, no shading.",
  ],
};

// Image 1 is the chosen logo; only the arrangement or color changes
export function versionPrompt(brief: BrandBrief, concept: ConceptReply, kind: VersionKind): string {
  return [
    "Image 1 is a business’s approved logo. Make a version of exactly this logo.",
    ...VERSION_LAYOUT[kind](concept),
    "Keep the design identical: the same symbol, the same letter shapes and lettering style, the same proportions and the same colors (unless asked for one color). Don’t redraw or reinterpret it.",
    "",
    ...(kind === "profile" ? [] : lettering(brief)),
    "",
    ...rules([QUALITY_RULES[1], QUALITY_RULES[4]]),
  ].join("\n");
}

const IMAGE_PLACEMENT: Record<BrandImageKind, string> = {
  facebook_cover:
    "Keep the important parts in a band across the middle: Facebook cuts off the top and bottom on phones, and the Page’s profile picture covers part of the left side.",
  youtube_banner:
    "Keep the logo small: it must fit inside the middle 60% of the width and the middle 28% of the height, the only part every device shows. Fill the whole banner with the background artwork.",
  website_hero: "Keep the middle calm and simple, with most of the detail toward the edges, so a headline can sit on top of it.",
  link_preview: "Put the logo in the center, about half the width of the picture, with plenty of space around it.",
};

// Image 1 is the chosen logo: placed as is, or used only for colors and style
export function brandImagePrompt(brief: BrandBrief, concept: ConceptReply, kind: BrandImageKind, change: string | null): string {
  const spec = IMAGE_SPECS[kind];
  const name = clean(brief.name, BRIEF_LIMITS.name);
  const sells = clean(brief.sells, BRIEF_LIMITS.sells);
  const palette = concept.palette.map((color) => color.hex).join(", ");
  return [
    spec.withLogo
      ? `Image 1 is the approved logo of “${name}”, a small business. Make their ${spec.title.toLowerCase()}: ${spec.purpose}`
      : `Image 1 is the logo of “${name}”, a small business. Use it only for its colors and drawing style. Make their ${spec.title.toLowerCase()}: ${spec.purpose}`,
    "",
    spec.withLogo
      ? "Place the logo from image 1 exactly as it is: the same shapes, lettering, spelling and colors. Don’t redraw it."
      : "Don’t include the logo, its symbol, or any letters, words or numbers.",
    IMAGE_PLACEMENT[kind],
    `Background: simple flat artwork in the logo’s colors (${palette}) and drawing style: shapes, patterns, simple motifs or a simple illustrated scene that capture the brand and suggest what they sell (${sells}).`,
    ...feel(brief),
    "Not a photo, and no pictures of specific products, so nothing looks like something they don’t sell.",
    spec.withLogo ? "No words other than the ones in the logo." : null,
    "No mockups, 3D, gradients or drop shadows.",
    change ? `The owner’s change: “${clean(change, MAX_CHANGE)}”` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
