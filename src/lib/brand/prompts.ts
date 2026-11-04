import { ownerText } from "@/lib/photos/instructions";
import { type ImageStyle, imageStyle } from "./image-style";
import { IMAGE_SPECS, LOGO_SPECS } from "./sizes";
import { MAX_LOGO_WORDS } from "./library";
import { type AssetCheck, BRIEF_LIMITS, type BrandBrief, type BrandImageKind, type ConceptKind, type ConceptReply, type ImageMedium, type PaletteColor, type VersionKind } from "./types";
import { LEANINGS, type LeaningKey } from "./vibes";

// Muse Image instructions, built by code from the brief and a concept. The owner never writes one.

export const MAX_CHANGE = 300;

// label and plain are owner-facing; describe goes to Muse Image
export const CONCEPT_KINDS_TEXT: Record<ConceptKind, { label: string; plain: string; describe: string }> = {
  wordmark: { label: "Wordmark", plain: "Just your name, in special lettering", describe: "A wordmark: the business name itself in distinctive custom lettering, with no separate symbol" },
  monogram: { label: "Monogram", plain: "Your initials made into a mark", describe: "A monogram: the business’s initials formed into one distinctive mark, with the full name beside or below it" },
  emblem: { label: "Badge", plain: "Your name inside a badge or stamp", describe: "An emblem: the name and a simple symbol together inside a badge, seal or stamp shape" },
  illustrative: { label: "Drawn symbol", plain: "A small drawing beside your name", describe: "A simple drawn symbol next to the business name" },
  abstract: { label: "Abstract symbol", plain: "A simple shape beside your name", describe: "A simple abstract shape that suggests the idea, next to the business name" },
  lettermark_symbol: { label: "Letter and symbol", plain: "One letter combined with a little picture", describe: "One letter of the name combined with a simple symbol, next to the full name" },
};

export const QUALITY_RULES = [
  "Simple and distinctive, built on one clear idea. It must still be recognizable as a tiny 32-pixel browser icon.",
  "Any symbol is big and bold, about as tall as the lettering, and reads at a glance as exactly what’s described: never a tiny accent or a vague shape.",
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

// Versions and edits keep image 1's letter case; models drift to Title Case unless told
export const KEEP_LETTERING =
  "Keep the lettering exactly as drawn in image 1: the same capital and lowercase letters, letter shapes, typeface, weight and spacing. Don’t switch it to Title Case, all capitals or all lowercase.";

// caseFrom "image": the case is already set by the logo in image 1
function lettering(brief: BrandBrief, caseFrom: "style" | "image" = "style"): string[] {
  const name = clean(brief.name, BRIEF_LIMITS.name);
  const tagline = clean(brief.tagline, BRIEF_LIMITS.tagline);
  return [
    caseFrom === "style"
      ? `Business name, spelled exactly: “${name}” (letter by letter: ${spellOut(name)}). Letter case may follow the lettering style, but every letter must be there, in this order.`
      : `Business name, spelled exactly: “${name}” (letter by letter: ${spellOut(name)}), in the same capitals and lowercase as image 1.`,
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

// A photo leaves out the line-drawing leaning, which would pull it toward an illustration
export function feel(brief: BrandBrief, photo = false): string[] {
  const leanings = leaningWords(photo ? { ...brief, leanings: { ...brief.leanings, finish: null } } : brief);
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
    concept.symbol
      ? `Symbol: ${clean(concept.symbol, 240)}. Someone seeing it for the first time should be able to say what it is.`
      : "No separate symbol: the lettering is the logo. Design the lettering itself with the distinctive feature the concept describes, so it’s clearly a custom wordmark, not a plain typeface.",
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

// Edits came back too subtle, or changed things no one asked for
export const EDIT_RULES = [
  "Make the requested change clearly visible at a glance: someone comparing the two side by side should see it right away. Don’t make a subtle or token change. For example, “bolder lettering” means clearly heavier, thicker strokes.",
  "Change only what was asked. Everything else stays identical to image 1: the same layout, shapes, colors, spelling and background.",
] as const;

// Image 1 is the draft being changed: in the owner's words, or a one-click change written by code (refine.ts)
export function refinePrompt(brief: BrandBrief, concept: ConceptReply, change: string | string[]): string {
  // A one-click lettering change redraws the lettering on purpose
  const restyles = Array.isArray(change) && change.some((line) => /^Redraw only the lettering/.test(line));
  return [
    "Image 1 is a logo draft. Change it as described below, and keep everything else about the design the same.",
    ...(typeof change === "string" ? [`The owner’s change: “${clean(change, MAX_CHANGE)}”`] : change),
    ...EDIT_RULES,
    restyles ? null : `${KEEP_LETTERING} The only exception is a change to the lettering that is asked for above.`,
    "",
    ...lettering(brief, restyles ? "style" : "image"),
    "",
    ...design(concept),
    ...colors(brief, concept),
    "",
    ...rules(QUALITY_RULES),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

// An uploaded logo wasn't drawn from an idea, so whether it has a symbol isn't known
const VERSION_LAYOUT: Record<VersionKind, (concept: ConceptReply | null) => string[]> = {
  stacked: (concept) => [
    "Make the stacked version of this logo for square spaces.",
    !concept
      ? "If the logo has a symbol, put that same symbol centered on top, with the lettering centered underneath it. If it is lettering only, put its first letter, drawn in the logo’s own lettering style, centered on top, with the full lettering underneath."
      : concept.symbol
        ? "Put the same symbol centered on top, with the business name centered underneath it."
        : "Put the logo’s first letter, drawn in the logo’s own lettering style, centered on top as a symbol, with the full business name centered underneath it.",
    "Square layout, centered on plain white, with generous margins.",
  ],
  profile: (concept) => [
    "Make the profile-picture version of this logo, for social media, where it gets cropped to a circle.",
    !concept
      ? "Show only the logo’s symbol, without any words. If the logo is lettering only, show just its first letter, drawn in the logo’s own lettering style."
      : concept.symbol
        ? "Show only the symbol, without the business name or tagline."
        : "Show only the logo’s first letter, drawn in the logo’s own lettering style, with no other words.",
    "Center it in a square on plain white, and keep all of it inside the middle 70% of the width and height, so nothing is lost when it’s cropped to a circle.",
    "No border, frame, box, outline, tile or circle behind or around it: just the symbol on plain white, with white all the way to the edges.",
  ],
  solid: () => [
    "Make the one-color version of this logo, for stamps, stickers and embroidery.",
    "Draw the whole logo, symbol and name, in one single solid color: the darkest color in the logo. Plain white background.",
    "Keep every shape, including the small details and the gaps between shapes: where two colors meet in image 1, leave a thin white gap so the shapes stay separate. Don’t merge shapes into a blob or leave any out.",
    "No second color, no tints, no outlines in another color, no shading.",
  ],
};

// A second try of a version: what the app's check found wrong with the first, to fix this time
export function retryLines(check: AssetCheck): string[] {
  const found = [...check.drift.map((flag) => clean(flag.detail, 300)), ...(check.lettering?.problems ?? []).map((problem) => clean(problem, 300))];
  return ["", "A first try had these problems. Fix them this time, and match image 1 exactly:", ...found.map((line) => `- ${line}`)];
}

// An uploaded logo's words, as the owner typed them, or none stated
function uploadedLettering(words: string): string[] {
  const text = clean(words, MAX_LOGO_WORDS);
  return text
    ? [`The words in the logo, spelled exactly: “${text}” (letter by letter: ${spellOut(text)}). Keep them exactly as they are in image 1, with the same capitals and lowercase.`, "No other letters, numbers or words."]
    : ["Keep every word and letter exactly as it is in image 1. Add no other words."];
}

// Image 1 is the chosen logo; only the arrangement or color changes. words: set for an uploaded logo.
export function versionPrompt(brief: BrandBrief, concept: ConceptReply | null, kind: VersionKind, words?: string): string {
  return [
    "Image 1 is a business’s approved logo. Make a version of exactly this logo.",
    ...VERSION_LAYOUT[kind](concept),
    "Keep the design identical: the same symbol, the same letter shapes and lettering style, the same proportions and the same colors (unless asked for one color). Don’t redraw or reinterpret it.",
    ...(kind === "profile" ? [] : [KEEP_LETTERING]),
    "",
    ...(kind === "profile" ? [] : concept ? lettering(brief, "image") : uploadedLettering(words ?? "")),
    "",
    ...rules([QUALITY_RULES[1], QUALITY_RULES[4], "No border, frame or box around the logo."]),
  ].join("\n");
}

// Image 1 is the owner's own logo, uploaded or an edit of one; the new file changes only what they asked
export function ownLogoEditPrompt(words: string, change: string): string {
  return [
    "Image 1 is a small business’s own logo. Make a new copy of it with the change described below.",
    `The owner’s change: “${clean(change, MAX_CHANGE)}”`,
    EDIT_RULES[0],
    "Keep everything else exactly as it is in image 1: the same symbol, letter shapes, letter case, layout, colors and background.",
    "",
    ...uploadedLettering(words),
    "",
    "Don’t add mockups, 3D, shadows, textures or effects that aren’t in image 1.",
  ].join("\n");
}

// What a picture edit needs to know about the logo it was made from
export interface EditBase {
  brief: BrandBrief;
  concept: ConceptReply | null;
  words?: string;
}

// Image 1 is a version or brand image made earlier; image 2 is the chosen logo it must still match
export function pictureEditPrompt(kind: VersionKind | BrandImageKind, change: string, base: EditBase): string {
  const image = kind in IMAGE_SPECS ? IMAGE_SPECS[kind as BrandImageKind] : null;
  const what = image ? `their ${image.title.toLowerCase()}` : `the ${LOGO_SPECS[kind as VersionKind].title.toLowerCase()} version of their logo`;
  const words = kind === "profile" ? [] : base.concept ? lettering(base.brief, "image") : uploadedLettering(base.words ?? "");
  return [
    `Image 1 is ${what}, made for a small business. Image 2 is the business’s approved logo.`,
    "Make a new copy of image 1 with the change described below.",
    `The owner’s change: “${clean(change, MAX_CHANGE)}”`,
    ...EDIT_RULES,
    image ? "Keep the same kind of picture as image 1 (a photo stays a photo, an illustration stays an illustration), the same scene, framing and safe areas, unless the change asks otherwise." : null,
    ...(image ? compositionLines(kind as BrandImageKind) : []),
    "",
    "Wherever the logo, its symbol or its lettering appears, keep it exactly as in image 2: the same shapes, lettering, letter case, spelling and colors. Don’t redraw it.",
    ...words,
    image ? "No words other than the ones in the logo." : null,
    image ? null : "No mockups, 3D, gradients or drop shadows.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

// Where the logo goes inside the safe area
const LOGO_IN_SAFE: Record<BrandImageKind, string> = {
  facebook_cover: "Put the logo in the middle of the safe area, large enough to read on a phone: about a quarter of the picture’s width.",
  youtube_banner: "Put the logo in the middle of the safe area and make it big there, filling most of its height, so it reads on a phone. Keep the scene a little calmer right behind it.",
  website_hero:
    "Put the logo small but clear at the top left of the safe area, about a sixth of the picture’s width, and leave a calm, uncluttered part of the safe area, softly out of focus or plain, where the owner’s headline will go.",
  link_preview: "Put the logo in the middle of the safe area, about half the picture’s width, on a calm part of the scene with space around it.",
  instagram_post: "Put the logo in the safe area, about a third of the picture’s width, on a calm part of the scene, so it reads on a phone.",
  instagram_story: "Put the logo in the middle of the safe area, about half the picture’s width, so it reads on a phone.",
  ad_square: "Put the logo in the safe area, about a third of the picture’s width, on a calm part of the scene. Leave the scene uncluttered so it reads at a glance in a feed.",
  flyer: "Put the logo in the middle of the safe area, about a third of the picture’s width.",
  product_scene:
    "Make the things they sell the hero: a styled scene of them on a shelf, table or in use, unbranded apart from the logo. Put the logo small on one product’s label, tag or the shelf, inside the safe area.",
};

const percent = (value: number) => `${Math.round(value * 100)}%`;
const round = (value: number) => value.toFixed(2).replace(/\.?0+$/, "");

function side(start: number, size: number, axis: "left" | "top"): string {
  const end = 1 - start - size;
  if (Math.abs(start - end) < 0.02) return axis === "left" ? "centered left to right" : "centered top to bottom";
  return axis === "left" ? `starting ${percent(start)} from the left edge and ending ${percent(end)} from the right edge` : `starting ${percent(start)} from the top and ending ${percent(end)} from the bottom`;
}

// The final shape and safe area in plain composition terms, from sizes.ts
export function compositionLines(kind: BrandImageKind): string[] {
  const { final, safe } = IMAGE_SPECS[kind];
  const ratio = final.width / final.height;
  const shape = ratio > 1.05 ? "a wide" : ratio < 0.95 ? "a tall" : "a square";
  return [
    `Shape: ${shape} picture, ${final.width} × ${final.height} pixels (about ${ratio >= 1 ? `${round(ratio)} to 1` : `1 to ${round(1 / ratio)}`}). Compose for exactly this shape.`,
    `Safe area: keep the logo and everything important (people, products, faces) inside a box about ${percent(safe.w)} of the width and ${percent(safe.h)} of the height, ${side(safe.x, safe.w, "left")} and ${side(safe.y, safe.h, "top")}. Outside it gets cropped on some screens.`,
    kind === "facebook_cover" ? "The Page’s profile picture covers the lower-left corner, so leave that part plain." : null,
    kind === "instagram_story" ? `Apps cover the top ${percent(safe.y)} and bottom ${percent(1 - safe.y - safe.h)} with buttons, so keep those parts plain background.` : null,
    kind === "flyer"
      ? `Leave the top ${percent(safe.y)} and bottom ${percent(1 - safe.y - safe.h)} calm and plain, a soft background with no objects or words, so the owner can add their own text there.`
      : null,
    "The rest is background that carries the scene all the way to every edge: no borders, and nothing essential near the edges.",
    LOGO_IN_SAFE[kind],
  ].filter((line): line is string => line !== null);
}

// Photo or illustration, from the owner's switch or brand answers (image-style.ts)
function styleLines(style: ImageStyle, palette: string): string[] {
  if (style.medium === "illustration") {
    return [
      `Style: a polished, flat illustrated scene in the logo’s colors${palette} and drawing style, with simple shapes and motifs.`,
      "No 3D, gradients or drop shadows, and no photos.",
    ];
  }
  return [
    `Style: a photorealistic, professionally styled lifestyle and product photograph, as if from the brand’s own photo shoot: ${style.light}, shallow depth of field, real textures and materials, with props and a setting that fit the business.`,
    style.lively
      ? "Make it bright, punchy and colorful: saturated colors, high energy and fun, playful props, like a bold lifestyle campaign. Still a real photograph."
      : null,
    "Real-looking people only where they suit the business, such as hands holding what they sell or someone using the service: natural and tasteful, never the main focus.",
    `Carry the brand’s colors${palette} through the props, fabrics, surfaces and background.`,
    "Not an illustration, cartoon, flat vector art or 3D render. No collage, frames or borders.",
  ].filter((line): line is string => line !== null);
}

// Pasted-on logos looked fake in photos: there the logo is a real object in the scene; an illustration may overlay it
export function logoPlacement(medium: "photo" | "illustration"): string[] {
  const exact = "Keep the logo exactly as in image 1: the same shapes, lettering, letter case, spelling and colors. Don’t redraw it.";
  return medium === "photo"
    ? [
        "Show the logo from image 1 as a real object in the scene, printed, painted or stitched on something that belongs there: a shop sign, a hang tag, a product label, an apron, a box, a window decal or fabric.",
        "It takes on that surface’s perspective, curve, lighting, shadows and texture, like everything else in the photo. Never a floating sticker or badge laid over the photo, and never on a plain white card or rectangle.",
        "Where the placement below says where the logo goes, put the object that carries it in that part of the picture.",
        exact,
      ]
    : ["Place the logo from image 1 as a clean, flat overlay in the position described below, with no box or card behind it.", exact];
}

// Image 1 is the chosen logo; image 2, when given, the approved example the others match. An uploaded logo may have no colors listed.
// chosen: the owner's Photo / Illustration switch; null leaves it to the rule
export function brandImagePrompt(brief: BrandBrief, colors: PaletteColor[], kind: BrandImageKind, change: string | null, example?: BrandImageKind, chosen: ImageMedium | null = null): string {
  const spec = IMAGE_SPECS[kind];
  const style = imageStyle(brief, chosen);
  const name = clean(brief.name, BRIEF_LIMITS.name);
  const sells = clean(brief.sells, BRIEF_LIMITS.sells);
  const palette = colors.length ? ` (${colors.map((color) => color.hex).join(", ")})` : "";
  return [
    `Image 1 is the approved logo of “${name}”, a small business. Make their ${spec.title.toLowerCase()}: ${spec.purpose}`,
    example
      ? `Image 2 is the business’s approved ${IMAGE_SPECS[example].title.toLowerCase()}. Match its look exactly, as if from the same shoot: the same kind of picture, light, colors, setting, props and mood. Make a new composition for this shape; don’t copy or crop image 2.`
      : null,
    "",
    `The picture must make it obvious at a glance what “${name}” sells (${sells}) and feel unmistakably like this brand. Show only the kinds of things they actually sell, plain and unbranded apart from the logo; never invent other products, prices or offers.`,
    ...logoPlacement(style.medium),
    ...compositionLines(kind),
    ...styleLines(style, palette),
    ...feel(brief, style.medium === "photo"),
    "The only words anywhere are the ones in the logo. No other text, and no other signs or labels with words, numbers or slogans.",
    change ? `The owner’s change: “${clean(change, MAX_CHANGE)}”` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
