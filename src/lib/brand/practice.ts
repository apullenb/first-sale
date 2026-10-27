import { IMAGE_SPECS, sizeFor } from "./sizes";
import type { AssetKind, PaletteColor } from "./types";

// Practice mode has no image service. Instead of a picture, a plain text wordmark that says what it is.

export const PRACTICE_LABEL = "Practice preview, not made by Muse";

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function practiceSize(kind: AssetKind): { width: number; height: number } {
  const [w, h] = sizeFor(kind).split("x").map(Number);
  return w >= h ? { width: 1024, height: Math.round((1024 * h) / w) } : { width: Math.round((1024 * w) / h), height: 1024 };
}

export interface PracticeInput {
  kind: AssetKind;
  name: string;
  palette: PaletteColor[];
  serif: boolean;
}

export function practiceSvg({ kind, name, palette, serif }: PracticeInput): { svg: string; width: number; height: number } {
  const { width, height } = practiceSize(kind);
  const dark = palette[0]?.hex ?? "#1c2321";
  const light = palette.at(-1)?.hex ?? "#e4e2dc";
  const font = serif ? "Georgia, 'Times New Roman', serif" : "'Helvetica Neue', Arial, sans-serif";
  const initial = escape(Array.from(name.trim())[0]?.toUpperCase() ?? "?");
  const label = escape(PRACTICE_LABEL.toUpperCase());
  const length = Math.max(4, Array.from(name).length);
  const text = (x: number, y: number, maxWidth: number, maxSize: number, color: string) => {
    const size = Math.round(Math.min(maxSize, maxWidth / (length * 0.6)));
    return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="700" fill="${color}" text-anchor="middle" dominant-baseline="middle">${escape(name)}</text>`;
  };
  const mark = (cx: number, cy: number, r: number, color: string) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/><text x="${cx}" y="${cy}" font-family="${font}" font-size="${Math.round(r * 1.1)}" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initial}</text>`;

  let body: string;
  switch (kind) {
    case "logo":
      body = mark(width * 0.2, height * 0.45, height * 0.16, light === dark ? dark : light) + text(width * 0.6, height * 0.45, width * 0.55, height * 0.16, dark);
      break;
    case "solid":
      body = mark(width * 0.2, height * 0.45, height * 0.16, dark) + text(width * 0.6, height * 0.45, width * 0.55, height * 0.16, dark);
      break;
    case "stacked":
      body = mark(width / 2, height * 0.35, height * 0.16, light === dark ? dark : light) + text(width / 2, height * 0.66, width * 0.8, height * 0.1, dark);
      break;
    case "profile":
      body = mark(width / 2, height * 0.47, height * 0.3, dark);
      break;
    default: {
      const shapes = [0.1, 0.35, 0.65, 0.9]
        .map((x, index) => `<circle cx="${width * x}" cy="${height * (index % 2 ? 0.25 : 0.75)}" r="${height * 0.22}" fill="${index % 2 ? dark : light}" opacity="0.18"/>`)
        .join("");
      const words = kind === "youtube_banner" || kind === "link_preview" ? text(width / 2, height * 0.47, width * 0.5, height * 0.12, dark) : "";
      body = `<rect width="${width}" height="${height}" fill="${light}" opacity="0.25"/>${shapes}${words}`;
    }
  }

  // Pictures get cropped to other shapes, so their label sits in the middle band every crop keeps
  const pill = Math.max(26, height * 0.06);
  const top = kind in IMAGE_SPECS ? height * 0.64 : height - Math.max(36, height * 0.09);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#ffffff"/>${body}<rect x="${width / 2 - width * 0.34}" y="${top}" width="${width * 0.68}" height="${pill}" rx="${pill / 2}" fill="#fdf1d6"/><text x="${width / 2}" y="${top + pill / 2}" font-family="'Helvetica Neue', Arial, sans-serif" font-size="${Math.round(Math.max(13, height * 0.028))}" font-weight="700" fill="#7a4b00" text-anchor="middle" dominant-baseline="central">${label}</text></svg>`;
  return { svg, width, height };
}

export function isSerif(typography: string): boolean {
  return /\bserif\b/i.test(typography) && !/sans/i.test(typography);
}
