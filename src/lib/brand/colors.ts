import type { PaletteColor } from "./types";

// Color math for the kit, the guide and color changes: WCAG contrast, plain names, and which color does what

export const HEX = /^#[0-9a-fA-F]{6}$/;
const FALLBACK_DARK = "#111111";

export function rgbOf(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// WCAG 2 relative luminance
export function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// WCAG AA: 4.5 for everyday text, 3 for large text and shapes
export function textUse(ratio: number): "text" | "large" | "decoration" {
  if (ratio >= 4.5) return "text";
  if (ratio >= 3) return "large";
  return "decoration";
}

export const TEXT_USE_LABELS = {
  text: "Easy to read on white, even as small text.",
  large: "Readable on white for big words and shapes, not small text.",
  decoration: "Too light to read on white: use it for shapes and backgrounds, not words.",
} as const;

export interface ColorRow {
  name: string;
  hex: string;
  rgb: string;
  ratio: number;
  use: string;
}

// Codes and readability on white, for the kit and the guide
export function colorRows(colors: PaletteColor[]): ColorRow[] {
  return colors.map((color) => {
    const ratio = contrast(color.hex, "#ffffff");
    const [r, g, b] = rgbOf(color.hex);
    return { name: color.name, hex: color.hex.toUpperCase(), rgb: `RGB ${r}, ${g}, ${b}`, ratio: Math.round(ratio * 10) / 10, use: TEXT_USE_LABELS[textUse(ratio)] };
  });
}

export function darkestFirst(palette: PaletteColor[]): PaletteColor[] {
  return [...palette].sort((a, b) => luminance(a.hex) - luminance(b.hex));
}

// The one-color logo and the dark background behind a white logo: the logo's darkest color,
// or near-black when every color is too light to read, which the page says (darkName null)
export function kitColors(palette: PaletteColor[]): { ink: string; dark: string; darkName: string | null } {
  const darkest = darkestFirst(palette)[0];
  const ratio = darkest ? contrast(darkest.hex, "#ffffff") : 0;
  return {
    ink: darkest && ratio >= 3 ? darkest.hex : FALLBACK_DARK,
    dark: darkest && ratio >= 4.5 ? darkest.hex : FALLBACK_DARK,
    darkName: darkest && ratio >= 4.5 ? darkest.name : null,
  };
}

// A plain name for a color the owner picked themselves, such as "Dark green"
export function colorName(hex: string): string {
  const [r, g, b] = rgbOf(hex).map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
  if (saturation < 0.12 || max - min < 0.06) {
    if (lightness < 0.12) return "Black";
    if (lightness > 0.93) return "White";
    return lightness < 0.4 ? "Dark gray" : lightness > 0.7 ? "Light gray" : "Gray";
  }
  let hue = 0;
  if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue = (hue * 60 + 360) % 360;
  const names: [number, string][] = [
    [15, "Red"],
    [40, "Orange"],
    [65, "Yellow"],
    [165, "Green"],
    [195, "Teal"],
    [255, "Blue"],
    [290, "Purple"],
    [335, "Pink"],
    [360, "Red"],
  ];
  let base = names.find(([limit]) => hue < limit)![1];
  if (base === "Orange" && lightness < 0.35) base = "Brown";
  const shade = lightness < 0.3 ? "Dark " : lightness > 0.75 ? "Light " : "";
  return `${shade}${shade ? base.toLowerCase() : base}`;
}
