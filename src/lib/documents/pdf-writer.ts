import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, rgb } from "pdf-lib";

// Plain, printable PDFs for generated documents: business plans, answer sheets, the startup plan.

export interface PdfBlock {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  // Label, value and a small note under it, for answer sheets
  entries?: { label: string; value: string; note?: string }[];
}

export interface PdfSpec {
  title: string;
  subtitle?: string;
  // Shown in a box under the title, such as "Prepared, not filed"
  notice?: string;
  blocks: PdfBlock[];
  footer: string;
}

const PAGE = { width: 612, height: 792, margin: 54 } as const;
const INK = rgb(0.11, 0.14, 0.13);
const MUTED = rgb(0.36, 0.39, 0.38);

// Characters the standard PDF fonts can draw (Windows-1252); anything else becomes "?"
const CP1252_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

export function toWinAnsi(text: string): string {
  return [...text.normalize("NFC")]
    .map((char) => {
      const code = char.codePointAt(0)!;
      if (char === "\t") return " ";
      if (char === "\r") return "";
      if ((code >= 0x20 && code < 0x7f) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.has(char) || char === "\n") return char;
      if (code === 0x2212 || code === 0x2010 || code === 0x2011) return "-";
      return "?";
    })
    .join("");
}

// Letters the standard fonts can't draw, which toWinAnsi would print as "?"
export function unprintable(text: string): string[] {
  return [...new Set([...text.normalize("NFC")].filter((char) => char !== "?" && toWinAnsi(char) === "?"))];
}

// Embedded so every viewer draws the letters at the widths used for layout. Arimo has Helvetica's widths,
// trimmed to the characters toWinAnsi keeps (OFL.txt); fontkit's own subsetting drops glyphs.
const FONT_DIR = path.join(process.cwd(), "src/lib/documents/fonts");
let fontFiles: Promise<Uint8Array[]> | null = null;

export async function embedFonts(doc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
  fontFiles ??= Promise.all(["Arimo-Regular.ttf", "Arimo-Bold.ttf"].map((name) => readFile(path.join(FONT_DIR, name)))).catch((error) => {
    fontFiles = null;
    throw error;
  });
  const [regular, bold] = await fontFiles;
  doc.registerFontkit(fontkit);
  return { regular: await doc.embedFont(regular, { subset: false }), bold: await doc.embedFont(bold, { subset: false }) };
}

export async function writePdf(spec: PdfSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(toWinAnsi(spec.title));
  doc.setProducer("SnapStart Business Assembly Kit");
  const { regular, bold } = await embedFonts(doc);
  const width = PAGE.width - PAGE.margin * 2;

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
  };
  const write = (text: string, font: PDFFont, size: number, options: { color?: typeof INK; indent?: number; gap?: number } = {}) => {
    const indent = options.indent ?? 0;
    for (const line of wrap(toWinAnsi(text), font, size, width - indent)) {
      if (y - size < PAGE.margin + 20) newPage();
      y -= size * 1.35;
      page.drawText(line, { x: PAGE.margin + indent, y, size, font, color: options.color ?? INK });
    }
    y -= options.gap ?? 0;
  };

  write(spec.title, bold, 20, { gap: 4 });
  if (spec.subtitle) write(spec.subtitle, regular, 11, { color: MUTED, gap: 6 });
  if (spec.notice) {
    const lines = wrap(toWinAnsi(spec.notice), bold, 10.5, width - 20);
    const height = lines.length * 14 + 14;
    page.drawRectangle({ x: PAGE.margin, y: y - height, width, height, borderColor: INK, borderWidth: 1 });
    y -= 8;
    write(spec.notice, bold, 10.5, { indent: 10, gap: 14 });
  }

  for (const block of spec.blocks) {
    if (block.heading) {
      // Keeps a heading with the first lines under it
      if (y - 8 - 13 * 1.35 - 3 * 10.5 * 1.35 < PAGE.margin + 20) newPage();
      else y -= 8;
      write(block.heading, bold, 13, { gap: 2 });
    }
    for (const paragraph of block.paragraphs ?? []) {
      for (const part of paragraph.split(/\n+/)) write(part, regular, 10.5, { gap: 5 });
    }
    for (const bullet of block.bullets ?? []) {
      const lines = wrap(toWinAnsi(bullet), regular, 10.5, width - 14);
      lines.forEach((line, index) => {
        if (y - 10.5 < PAGE.margin + 20) newPage();
        y -= 10.5 * 1.35;
        if (index === 0) page.drawText("•", { x: PAGE.margin + 2, y, size: 10.5, font: regular, color: INK });
        page.drawText(line, { x: PAGE.margin + 14, y, size: 10.5, font: regular, color: INK });
      });
      y -= 3;
    }
    for (const entry of block.entries ?? []) {
      // Keeps a label, such as a signer's name, with its line
      if (y - 3 * 10.5 * 1.35 < PAGE.margin + 20) newPage();
      write(entry.label, bold, 10.5);
      write(entry.value || "-", regular, 10.5, { indent: 10 });
      if (entry.note) write(entry.note, regular, 9, { indent: 10, color: MUTED });
      y -= 6;
    }
  }

  const pages = doc.getPages();
  pages.forEach((each, index) => {
    const label = toWinAnsi(`${spec.footer} · Page ${index + 1} of ${pages.length}`);
    each.drawText(label, { x: PAGE.margin, y: PAGE.margin - 20, size: 8.5, font: regular, color: MUTED });
  });
  return doc.save();
}

export function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      // A single word wider than the line is broken by characters
      line = word;
      while (font.widthOfTextAtSize(line, size) > maxWidth) {
        let cut = line.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}
