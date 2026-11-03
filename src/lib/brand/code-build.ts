import { analyze, composeIcon, composeStacked, CONFIDENT, recolorShapes, resizeSymbol, splitLogo, thickenLettering } from "./layout";
import { clearFrame, oneColor, type Pixels } from "./pixels";
import { decodePng } from "./png";
import { CODE_MODEL, type VersionKind } from "./types";

// Logo versions and edits that code can make exactly from the logo's pixels, so the lettering can't change.
// When it can't be done with confidence, the caller falls back to the image model and keeps the reason.

export { CODE_MODEL };

export type Built = { ok: true; image: Pixels; note: string; confidence: number } | { ok: false; note: string; confidence: number };

const UNREADABLE = "The logo file isn’t a PNG SnapStart can take apart.";
const percent = (confidence: number) => `${Math.round(confidence * 100)}% sure`;

function prepare(bytes: Uint8Array, letters: number | null) {
  const image = decodePng(bytes);
  if (!image) return { ok: false as const, note: UNREADABLE, confidence: 0 };
  const analysis = analyze(clearFrame(image));
  if (!analysis) return { ok: false as const, note: "The logo’s background isn’t one plain color, so its parts can’t be found.", confidence: 0 };
  return { ok: true as const, image, analysis, split: splitLogo(analysis, letters) };
}

// letters: how many letters the logo's words have, when known; ink: the one color for the one-color version
export function buildVersion(bytes: Uint8Array, kind: VersionKind, options: { letters: number | null; ink: string }): Built {
  if (kind === "solid") {
    const image = decodePng(bytes);
    const analysis = image ? analyze(clearFrame(image)) : null;
    if (analysis && !analysis.shapes.some((shape) => !shape.speck)) return { ok: false, note: "Nothing was found in the logo to work with.", confidence: 0 };
    const solid = image ? oneColor(clearFrame(image), options.ink) : null;
    if (!solid) return { ok: false, note: image ? "The logo’s background isn’t one plain color." : UNREADABLE, confidence: 0 };
    return { ok: true, image: solid, note: `Built in code: your logo’s own pixels in one color (${options.ink}). Nothing was redrawn.`, confidence: 1 };
  }
  const ready = prepare(bytes, options.letters);
  if (!ready.ok) return ready;
  const { analysis, split } = ready;
  if (split.kind === "none" || split.confidence < CONFIDENT) return { ok: false, note: `${split.reason} (${percent(split.confidence)})`, confidence: split.confidence };
  if (kind === "profile") {
    const what = split.kind === "badge" ? "the whole badge" : "the symbol alone";
    return { ok: true, image: composeIcon(analysis, split), note: `Built in code: ${what}, cut from your logo’s pixels and centered. ${split.reason} (${percent(split.confidence)})`, confidence: split.confidence };
  }
  const what = split.kind === "badge" ? "the badge kept whole, on a square" : "the symbol centered above the lettering, both cut from your logo’s pixels";
  return { ok: true, image: composeStacked(analysis, split), note: `Built in code: ${what}. ${split.reason} (${percent(split.confidence)})`, confidence: split.confidence };
}

// --- Edits code can make exactly

export type CodeEdit = { kind: "bolder"; amount: number } | { kind: "symbol"; scale: number } | { kind: "recolor"; target: "lettering" | "all"; hex: string; name: string };

const FILLER = new Set(["please", "make", "the", "a", "an", "bit", "little", "slightly", "it", "its", "just", "so", "more", "much", "lot", "way", "all", "of", "my", "logo", "s", "and", "to", "in", "be", "can", "you", "could", "would", "is", "color", "colour"]);
const LETTERING = new Set(["lettering", "letters", "letter", "text", "font", "name", "words", "type", "typeface", "wording"]);
const BOLDER = new Set(["bolder", "thicker", "heavier", "bold", "chunkier", "fatter"]);
const SYMBOL = new Set(["symbol", "icon", "picture", "drawing", "mark", "emblem", "illustration", "graphic"]);
const BIGGER = new Set(["bigger", "larger"]);
const SMALLER = new Set(["smaller"]);
// Plain color words code can use exactly; anything else goes to the image model
const COLOR_WORDS: Record<string, string> = {
  black: "#111111",
  navy: "#1B2A4A",
  "dark blue": "#1E3A6E",
  blue: "#1F5FBF",
  "dark green": "#1F4D2E",
  green: "#2E7D32",
  brown: "#5C3A21",
  "dark brown": "#3E2716",
  red: "#B71C1C",
  "dark red": "#7F1D1D",
  maroon: "#6B1E2A",
  burgundy: "#6D1A36",
  gray: "#555555",
  grey: "#555555",
  charcoal: "#333333",
  purple: "#5B2A86",
  teal: "#00695C",
  orange: "#D9611E",
  gold: "#B8860B",
};

// Only a short request that's exactly one of these, such as “Make the lettering bolder”; anything more goes to the model
export function codeEdit(change: string): CodeEdit | null {
  const words = change
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z#0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const strong = words.some((word) => ["much", "lot", "way"].includes(word));
  const all = words.includes("all") || words.includes("whole") || words.includes("everything");
  const left = words.filter((word) => !FILLER.has(word) && word !== "whole" && word !== "everything");
  if (left.length === 2) {
    const [a, b] = left;
    const pair = (set1: Set<string>, set2: Set<string>) => (set1.has(a) && set2.has(b)) || (set1.has(b) && set2.has(a));
    if (pair(LETTERING, BOLDER)) return { kind: "bolder", amount: strong ? 0.3 : 0.18 };
    if (pair(SYMBOL, BIGGER)) return { kind: "symbol", scale: strong ? 1.4 : 1.2 };
    if (pair(SYMBOL, SMALLER)) return { kind: "symbol", scale: strong ? 0.7 : 0.83 };
  }
  // “Make the lettering navy”, “Make it all black”
  const target = left.length && LETTERING.has(left[0]) ? "lettering" : all ? "all" : null;
  const colorWords = (target === "lettering" ? left.slice(1) : left).join(" ");
  if (target && colorWords) {
    const hex = /^#[0-9a-f]{6}$/.test(colorWords) ? colorWords.toUpperCase() : COLOR_WORDS[colorWords];
    if (hex) return { kind: "recolor", target, hex, name: colorWords };
  }
  return null;
}

export function applyEdit(bytes: Uint8Array, edit: CodeEdit, letters: number | null): Built {
  if (edit.kind === "recolor" && edit.target === "all") {
    const image = decodePng(bytes);
    const solid = image ? oneColor(clearFrame(image), edit.hex) : null;
    if (!solid) return { ok: false, note: image ? "The logo’s background isn’t one plain color." : UNREADABLE, confidence: 0 };
    return { ok: true, image: solid, note: `Done in code: every part of your logo in ${edit.hex}. Nothing was redrawn.`, confidence: 1 };
  }
  const ready = prepare(bytes, letters);
  if (!ready.ok) return ready;
  const { analysis, split } = ready;
  if (split.kind !== "parts" || split.confidence < CONFIDENT) {
    return { ok: false, note: `Not done in code: ${split.kind === "badge" ? "the logo is a badge, with the lettering part of one design" : split.reason} (${percent(split.confidence)}).`, confidence: split.confidence };
  }
  const sure = `${split.reason} (${percent(split.confidence)})`;
  if (edit.kind === "bolder") {
    const thick = thickenLettering(analysis, split, edit.amount);
    if (!thick) return { ok: false, note: "Not done in code: the letters sit too close together to thicken them clearly without touching.", confidence: split.confidence };
    return { ok: true, image: thick.image, note: `Done in code: each letter’s strokes made ${thick.radius * 2} pixels thicker. Letter shapes, spacing and the symbol are unchanged. ${sure}`, confidence: split.confidence };
  }
  if (edit.kind === "symbol") {
    const image = resizeSymbol(analysis, split, edit.scale);
    if (!image) return { ok: false, note: "Not done in code: the symbol and lettering aren’t side by side or stacked.", confidence: split.confidence };
    return { ok: true, image, note: `Done in code: the symbol at ${Math.round(edit.scale * 100)}% of its size, the lettering unchanged. ${sure}`, confidence: split.confidence };
  }
  return { ok: true, image: recolorShapes(analysis, split.lettering, edit.hex), note: `Done in code: the lettering in ${edit.hex}, everything else unchanged. ${sure}`, confidence: split.confidence };
}
