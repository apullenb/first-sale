import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import { toWinAnsi, wrap } from "@/lib/documents/pdf-writer";
import { colorRows, rgbOf } from "./colors";
import { PRACTICE_LABEL } from "./practice";
import { USPTO } from "./sizes";
import type { PaletteColor } from "./types";

// A logo usage guide, written by rules from the approved logo: colors, lettering, space, do's and don'ts.
// One page for usual answers; long names and descriptions flow onto a second.

export const GOOGLE_FONTS = "https://fonts.google.com";

// Free Google Fonts for everyday text that sit well with the logo's lettering. The logo itself is artwork, not a font.
const FONT_PAIRS: { match: RegExp; headings: string; body: string }[] = [
  { match: /slab|typewriter|mono/i, headings: "Roboto Slab", body: "Roboto" },
  { match: /script|brush|hand|cursive|calligraph/i, headings: "Poppins", body: "Lato" },
  { match: /round/i, headings: "Nunito", body: "Nunito" },
  { match: /condensed|chunky|heavy|bold|retro|display|block/i, headings: "Oswald", body: "Open Sans" },
  { match: /(^|[^-])\bserif\b/i, headings: "Lora", body: "Source Sans 3" },
];
const DEFAULT_PAIR = { headings: "Inter", body: "Inter" };

export function fontPair(lettering: string): { headings: string; body: string } {
  const pair = FONT_PAIRS.find((each) => each.match.test(lettering));
  return pair ? { headings: pair.headings, body: pair.body } : DEFAULT_PAIR;
}

export const CLEAR_SPACE = "Leave empty space around the logo at least a quarter of its height on every side. Keep other words, pictures and edges out of it.";
export const MIN_SIZE = "Keep the main logo at least 1 inch wide in print and 120 pixels wide on screens. Smaller than that, use the stacked logo or the icon.";
export const DOS = [
  "Use the files from your logo kit, never a screenshot or a retyped name.",
  "Use the see-through file on colors and photos, and the white one-color file on dark backgrounds.",
  "Use your colors’ exact hex codes when you set up your website, signs and printing.",
  "Check it’s easy to read where it will be seen, such as on a phone screen.",
];
export const DONTS = [
  "Don’t stretch, squash, tilt or crop it.",
  "Don’t change its colors, except to use the one-color files.",
  "Don’t add shadows, outlines, glows or other effects.",
  "Don’t move its parts around or set the name in a different font.",
  "Don’t put it on a busy photo or a color it doesn’t stand out from.",
];

export interface GuideImage {
  mimeType: string;
  data: Uint8Array;
}

export interface GuideInput {
  businessName: string;
  tagline: string;
  colors: PaletteColor[];
  lettering: string;
  simulated: boolean;
  images: { label: string; file: GuideImage | null }[];
  now: Date;
}

const PAGE = { width: 612, height: 792, margin: 48 } as const;
// Content stays above the footer
const BOTTOM = PAGE.margin + 4;
const INK = rgb(0.11, 0.14, 0.13);
const MUTED = rgb(0.36, 0.39, 0.38);
const PANEL = rgb(0.95, 0.95, 0.94);
const LINE = rgb(0.85, 0.85, 0.83);
const AMBER = rgb(0.48, 0.29, 0);

async function embed(doc: PDFDocument, file: GuideImage | null): Promise<PDFImage | null> {
  if (!file) return null;
  try {
    if (file.mimeType === "image/png") return await doc.embedPng(file.data);
    if (file.mimeType === "image/jpeg") return await doc.embedJpg(file.data);
  } catch {
    return null;
  }
  // Practice previews are SVG, which a PDF can't hold
  return null;
}

export async function logoGuidePdf(input: GuideInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const title = `${input.businessName} logo guide`;
  doc.setTitle(toWinAnsi(title));
  doc.setProducer("First Sale");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = PAGE.width - PAGE.margin * 2;
  const gap = 10;
  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  // Starts a new page when the next `space` points wouldn't fit above the footer
  const room = (space: number) => {
    if (y - space >= BOTTOM) return;
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
  };
  const lines = (value: string, font: PDFFont, size: number, maxWidth: number) => wrap(toWinAnsi(value), font, size, maxWidth);
  const text = (value: string, font: PDFFont, size: number, x: number, maxWidth: number, color = INK) => {
    for (const line of lines(value, font, size, maxWidth)) {
      room(size * 1.3);
      y -= size * 1.3;
      page.drawText(line, { x, y, size, font, color });
    }
  };
  const heading = (value: string, keepWith: number) => {
    room(10 + 12 * 1.3 + 2 + keepWith);
    y -= 10;
    text(value, bold, 12, PAGE.margin, width);
    y -= 2;
  };

  text(title, bold, 22, PAGE.margin, width);
  const date = input.now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  text(`Made ${date} by First Sale from the logo you approved.${input.tagline ? ` Tagline: “${input.tagline}”.` : ""}`, regular, 10, PAGE.margin, width, MUTED);

  if (input.simulated) {
    y -= 8;
    const notice = `${PRACTICE_LABEL}. These are placeholders from practice mode: don't use this guide or its logo for your business.`;
    const height = lines(notice, bold, 10, width - 16).length * 13 + 10;
    room(height);
    page.drawRectangle({ x: PAGE.margin, y: y - height, width, height, color: rgb(0.99, 0.95, 0.84), borderColor: AMBER, borderWidth: 1 });
    y -= 4;
    text(notice, bold, 10, PAGE.margin + 8, width - 16, AMBER);
    y -= 6;
  }

  // The logos, each on a panel so its own white background shows
  const panelHeight = 130;
  heading("Your logo", panelHeight + 8);
  const images = await Promise.all(input.images.map(async (each) => ({ label: each.label, image: await embed(doc, each.file), had: Boolean(each.file) })));
  const shown = images.filter((each) => each.had);
  const weights = shown.map((_, index) => (index === 0 ? 2 : 1));
  const unit = (width - gap * Math.max(0, shown.length - 1)) / Math.max(1, weights.reduce((sum, weight) => sum + weight, 0));
  let x = PAGE.margin;
  const top = y - 4;
  shown.forEach((each, index) => {
    const panelWidth = unit * weights[index];
    page.drawRectangle({ x, y: top - panelHeight, width: panelWidth, height: panelHeight, color: PANEL });
    const box = { width: panelWidth - 16, height: panelHeight - 34 };
    if (each.image) {
      const scale = Math.min(box.width / each.image.width, box.height / each.image.height);
      const w = each.image.width * scale;
      const h = each.image.height * scale;
      page.drawImage(each.image, { x: x + (panelWidth - w) / 2, y: top - 8 - box.height + (box.height - h) / 2, width: w, height: h });
    } else {
      page.drawRectangle({ x: x + 8, y: top - 8 - box.height, width: box.width, height: box.height, color: rgb(1, 1, 1), borderColor: LINE, borderWidth: 1 });
      const size = 8.5;
      const note = lines(input.simulated ? "Practice preview: no logo drawn" : "See the file in your logo kit", regular, size, box.width - 12);
      note.forEach((line, row) => {
        const lineY = top - 8 - box.height / 2 + ((note.length - 1) / 2 - row) * size * 1.3;
        page.drawText(line, { x: x + (panelWidth - regular.widthOfTextAtSize(line, size)) / 2, y: lineY, size, font: regular, color: MUTED });
      });
    }
    page.drawText(toWinAnsi(each.label), { x: x + 8, y: top - panelHeight + 10, size: 9, font: bold, color: INK });
    x += panelWidth + gap;
  });
  y = top - panelHeight - 4;

  // Colors in three columns, each kept together
  const columnWidth = (width - gap * 2) / 3;
  const rows = colorRows(input.colors);
  const columnHeight = (row: (typeof rows)[number]) =>
    Math.max(38, (lines(row.name, bold, 10, columnWidth - 42).length * 10 + 18) * 1.3) + 4 + lines(`On white ${row.ratio}:1. ${row.use}`, regular, 8.5, columnWidth).length * 8.5 * 1.3;
  heading("Colors", Math.max(0, ...rows.map(columnHeight)) + 6);
  const colorTop = y - 6;
  let lowest = colorTop;
  rows.forEach((row, index) => {
    const left = PAGE.margin + index * (columnWidth + gap);
    const [r, g, b] = rgbOf(row.hex).map((channel) => channel / 255);
    page.drawRectangle({ x: left, y: colorTop - 34, width: 34, height: 34, color: rgb(r, g, b), borderColor: LINE, borderWidth: 0.75 });
    y = colorTop + 2;
    text(row.name, bold, 10, left + 42, columnWidth - 42);
    text(row.hex, regular, 9, left + 42, columnWidth - 42, MUTED);
    text(row.rgb, regular, 9, left + 42, columnWidth - 42, MUTED);
    y = Math.min(y, colorTop - 38) - 4;
    text(`On white ${row.ratio}:1. ${row.use}`, regular, 8.5, left, columnWidth, MUTED);
    lowest = Math.min(lowest, y);
  });
  y = lowest;

  heading("Lettering", 3 * 10 * 1.3);
  const fonts = fontPair(input.lettering);
  text(`Your logo’s lettering: ${input.lettering}. It’s drawn artwork, not a font, so always use the logo file rather than typing the name.`, regular, 10, PAGE.margin, width);
  y -= 2;
  text(`For headings and everyday text, these free Google Fonts suit it: ${fonts.headings} for headings and ${fonts.body} for text (${GOOGLE_FONTS}). They're suggestions; any easy-to-read font works.`, regular, 10, PAGE.margin, width);

  heading("Space and size", 3 * 10 * 1.3);
  text(CLEAR_SPACE, regular, 10, PAGE.margin, width);
  y -= 2;
  text(MIN_SIZE, regular, 10, PAGE.margin, width);

  // Do's and don'ts side by side, kept together
  const half = (width - 20) / 2;
  const listHeight = (items: string[]) => 12 * 1.3 + 2 + items.reduce((sum, item) => sum + lines(item, regular, 9.5, half - 10).length * 9.5 * 1.3 + 2, 0);
  y -= 10;
  room(Math.max(listHeight(DOS), listHeight(DONTS)));
  const listTop = y;
  const list = (titleText: string, items: string[], left: number) => {
    y = listTop;
    text(titleText, bold, 12, left, half);
    y -= 2;
    for (const item of items) {
      page.drawText("•", { x: left, y: y - 9.5 * 1.3, size: 9.5, font: regular, color: INK });
      text(item, regular, 9.5, left + 10, half - 10);
      y -= 2;
    }
  };
  list("Do", DOS, PAGE.margin);
  list("Don’t", DONTS, PAGE.margin + half + 20);

  const pages = doc.getPages();
  pages.forEach((each, index) =>
    drawFooter(each, regular, `Not checked for trademarks: search for similar marks at ${USPTO.url} before you print or spend money on it. Made by First Sale.${pages.length > 1 ? ` Page ${index + 1} of ${pages.length}.` : ""}`),
  );
  return doc.save();
}

function drawFooter(page: PDFPage, font: PDFFont, value: string) {
  const size = 8;
  const lines = wrap(toWinAnsi(value), font, size, PAGE.width - PAGE.margin * 2);
  lines.forEach((line, index) => page.drawText(line, { x: PAGE.margin, y: PAGE.margin - 14 - index * 10, size, font, color: MUTED }));
}
