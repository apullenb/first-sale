import { darkestFirst } from "./colors";
import { IMAGE_SPECS, sizeFor } from "./sizes";
import type { AssetKind, ConceptKind, ImageMedium, PaletteColor } from "./types";

// Practice mode has no image service. Instead of a picture, a plain labeled placeholder that still shows
// the idea's kind, colors, lettering feel and tagline, so one-click changes visibly work.

export const PRACTICE_LABEL = "Practice preview, not made by Muse";
// On a practice brand image, the style a real one would have
export const MEDIUM_WORDS: Record<ImageMedium, string> = { photo: "Photo style", illustration: "Illustration style" };
export const PRACTICE_LABEL_COLORS = { pill: "#fdf1d6", text: "#7a4b00" } as const;

// Where the label sits; kit files take it out and stamp their own at a size that reads
export function practiceLabelBox(kind: AssetKind, width: number, height: number): { x: number; y: number; width: number; height: number } {
  // Pictures get cropped to other shapes, so their label sits in the middle band every crop keeps
  const top = kind in IMAGE_SPECS ? height * 0.64 : height - Math.max(36, height * 0.09);
  return { x: width / 2 - width * 0.34, y: top, width: width * 0.68, height: Math.max(26, height * 0.06) };
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function practiceSize(kind: AssetKind): { width: number; height: number } {
  const [w, h] = sizeFor(kind).split("x").map(Number);
  return w >= h ? { width: 1024, height: Math.round((1024 * h) / w) } : { width: Math.round((1024 * w) / h), height: 1024 };
}

export interface PracticeInput {
  kind: AssetKind;
  conceptKind: ConceptKind;
  name: string;
  tagline: string;
  palette: PaletteColor[];
  typography: string;
  // Brand images: the style a real one would have
  medium?: ImageMedium;
}

// A system font close to the lettering direction
export function practiceFont(typography: string): string {
  if (/slab|typewriter|mono/i.test(typography)) return "'Rockwell', 'Courier New', serif";
  if (/script|brush|hand|cursive/i.test(typography)) return "'Brush Script MT', 'Segoe Script', cursive";
  if (/round/i.test(typography)) return "'Arial Rounded MT Bold', 'Nunito', 'Helvetica Neue', sans-serif";
  if (/\bserif\b/i.test(typography) && !/sans/i.test(typography)) return "Georgia, 'Times New Roman', serif";
  return "'Helvetica Neue', Arial, sans-serif";
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 3)
    .map((word) => Array.from(word)[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function practiceSvg({ kind, conceptKind, name, tagline, palette, typography, medium }: PracticeInput): { svg: string; width: number; height: number } {
  const { width, height } = practiceSize(kind);
  const ordered = darkestFirst(palette);
  const dark = ordered[0]?.hex ?? "#1c2321";
  const accent = ordered[1]?.hex ?? dark;
  const font = practiceFont(typography);
  const words = (value: string, x: number, y: number, maxWidth: number, maxSize: number, color: string, weight = 700) => {
    const size = Math.round(Math.min(maxSize, maxWidth / (Math.max(4, Array.from(value).length) * 0.6)));
    return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="middle" dominant-baseline="middle">${escape(value)}</text>`;
  };
  const nameText = (x: number, y: number, maxWidth: number, maxSize: number, color: string) => words(name, x, y, maxWidth, maxSize, color);
  const taglineText = (x: number, y: number, maxWidth: number, color: string) => (tagline.trim() ? words(tagline.trim(), x, y, maxWidth, height * 0.06, color, 400) : "");
  // The mark: initials for a monogram, one letter otherwise
  const letters = escape(conceptKind === "monogram" ? initials(name) : (Array.from(name.trim())[0]?.toUpperCase() ?? "?"));
  const mark = (cx: number, cy: number, r: number, color: string) => {
    const shape =
      conceptKind === "abstract"
        ? `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.35}" fill="${color}" transform="rotate(45 ${cx} ${cy})"/>`
        : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
    return `${shape}<text x="${cx}" y="${cy}" font-family="${font}" font-size="${Math.round(r * (letters.length > 1 ? 0.7 : 1.1))}" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${letters}</text>`;
  };
  const wordmark = conceptKind === "wordmark";
  const badge = conceptKind === "emblem";
  const hasTagline = Boolean(tagline.trim());

  let body: string;
  switch (kind) {
    case "logo":
    case "solid": {
      const ink = kind === "solid" ? dark : accent;
      if (wordmark || badge) {
        const frame = badge ? `<rect x="${width * 0.12}" y="${height * 0.14}" width="${width * 0.76}" height="${height * 0.62}" rx="${height * 0.08}" fill="none" stroke="${ink}" stroke-width="${height * 0.025}"/>` : "";
        const underline = wordmark ? `<rect x="${width * 0.3}" y="${height * (hasTagline ? 0.5 : 0.56)}" width="${width * 0.4}" height="${height * 0.018}" rx="${height * 0.009}" fill="${ink}"/>` : "";
        body = frame + nameText(width / 2, height * (hasTagline ? 0.38 : 0.44), width * 0.66, height * 0.2, dark) + underline + taglineText(width / 2, height * 0.62, width * 0.6, dark);
      } else {
        body = mark(width * 0.2, height * 0.45, height * 0.16, ink) + nameText(width * 0.6, height * (hasTagline ? 0.4 : 0.45), width * 0.55, height * 0.16, dark) + taglineText(width * 0.6, height * 0.56, width * 0.5, dark);
      }
      break;
    }
    case "stacked":
      body = mark(width / 2, height * 0.32, height * 0.15, accent) + nameText(width / 2, height * 0.6, width * 0.8, height * 0.1, dark) + taglineText(width / 2, height * 0.7, width * 0.7, dark);
      break;
    case "profile":
      body = mark(width / 2, height * 0.47, height * 0.3, dark);
      break;
    default: {
      const shapes = [0.1, 0.35, 0.65, 0.9]
        .map((x, index) => `<circle cx="${width * x}" cy="${height * (index % 2 ? 0.25 : 0.75)}" r="${height * 0.22}" fill="${index % 2 ? dark : accent}" opacity="0.18"/>`)
        .join("");
      // Where each slot's prompt puts the logo
      const centered =
        kind === "website_hero"
          ? nameText(width * 0.18, height * 0.14, width * 0.28, height * 0.07, dark)
          : kind === "facebook_cover"
            ? nameText(width * 0.7, height * 0.5, width * 0.4, height * 0.1, dark)
            : nameText(width / 2, height * 0.47, width * 0.5, height * 0.12, dark);
      body = `<rect width="${width}" height="${height}" fill="${accent}" opacity="0.12"/>${shapes}${centered}`;
    }
  }

  const label = escape((medium ? `${PRACTICE_LABEL} · ${MEDIUM_WORDS[medium]}` : PRACTICE_LABEL).toUpperCase());
  const box = practiceLabelBox(kind, width, height);
  const pill = box.height;
  const top = box.y;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ffffff"/>${body}<rect x="${box.x}" y="${top}" width="${box.width}" height="${pill}" rx="${pill / 2}" fill="${PRACTICE_LABEL_COLORS.pill}"/><text x="${width / 2}" y="${top + pill / 2}" font-family="'Helvetica Neue', Arial, sans-serif" font-size="${Math.round(Math.max(13, height * 0.028))}" font-weight="700" fill="${PRACTICE_LABEL_COLORS.text}" text-anchor="middle" dominant-baseline="central">${label}</text></svg>`;
  return { svg, width, height };
}
