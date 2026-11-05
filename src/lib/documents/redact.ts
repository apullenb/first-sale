import { PDFDocument, type PDFFont, PDFTextField, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { getDocumentProxy, renderPageAsImage } from "unpdf";
import { findSensitive, type SensitiveKind } from "@/lib/privacy/sensitive";

// True redaction for PDFs with a text layer. Each private number's place on the page comes from the PDF's own text
// positions (or a form field's box), every page is drawn as an image with those places painted over, and a new PDF is
// built from the images. The result looks like the original but carries no text layer, so nothing hidden is left to
// copy or extract under a box. It's checked in code before it's kept; if any check fails, no file is kept at all.

// Page images at 2x, about 144 dpi: sharp enough to read and print
const SCALE = 2;
// Room around each number, in PDF points and in parts of the font size
const PAD = 2;
const PAD_EM = 0.2;

// Standard Helvetica widths, to place a number within its line: digits are wider than most letters
let metrics: Promise<PDFFont> | null = null;
const helvetica = () => (metrics ??= PDFDocument.create().then((doc) => doc.embedFont(StandardFonts.Helvetica)));

// How far along the line `count` characters reach, as a share of the line's width
function share(font: PDFFont, text: string, count: number): number {
  try {
    const whole = font.widthOfTextAtSize(text, 10);
    return whole > 0 ? font.widthOfTextAtSize(text.slice(0, count), 10) / whole : count / text.length;
  } catch {
    // Characters Helvetica can't encode: by count
    return count / text.length;
  }
}

export interface Box {
  page: number;
  kind: SensitiveKind;
  // In PDF points, origin bottom left
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type Redaction =
  | { ok: true; data: Uint8Array; boxes: Box[]; pages: number }
  | { ok: false; reason: string };

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  hasEOL: boolean;
}

// Where each private number sits: text first, then any typed into form fields
export async function findBoxes(bytes: Uint8Array): Promise<{ boxes: Box[]; found: number; pages: number }> {
  const proxy = await getDocumentProxy(new Uint8Array(bytes));
  const font = await helvetica();
  const boxes: Box[] = [];
  let found = 0;
  for (let number = 1; number <= proxy.numPages; number++) {
    const page = await proxy.getPage(number);
    const items = (await page.getTextContent()).items.filter((item): item is TextItem & typeof item => "str" in item);
    // The page's text with each item's place in it, so a number split across items is still found
    let text = "";
    const spans = items.map((item) => {
      const start = text.length;
      text += item.str;
      const span = { item, start, end: text.length };
      text += item.hasEOL ? "\n" : " ";
      return span;
    });
    for (const finding of findSensitive(text)) {
      found++;
      for (const { item, start, end } of spans) {
        if (end <= finding.start || start >= finding.end || !item.str.length) continue;
        const from = share(font, item.str, Math.max(finding.start, start) - start);
        const to = share(font, item.str, Math.min(finding.end, end) - start);
        boxes.push({ page: number, kind: finding.kind, ...textBox(item, from, to) });
      }
    }
  }
  const fields = await fieldBoxes(bytes);
  found += fields.found;
  return { boxes: [...boxes, ...fields.boxes], found, pages: proxy.numPages };
}

// The run of glyphs from `from` to `to` (fractions of the item), along the text's own direction, with room for
// ascenders and descenders
function textBox(item: TextItem, from: number, to: number): Omit<Box, "page" | "kind"> {
  const [a, b, c, d, e, f] = item.transform;
  const along = Math.hypot(a, b) || 1;
  const size = Math.hypot(c, d) || along;
  const ux = a / along;
  const uy = b / along;
  const vx = c / size;
  const vy = d / size;
  const side = PAD + PAD_EM * size;
  const points = [
    [from * item.width - side, -0.3 * size - PAD],
    [to * item.width + side, -0.3 * size - PAD],
    [from * item.width - side, 1.0 * size + PAD],
    [to * item.width + side, 1.0 * size + PAD],
  ].map(([t, v]) => [e + ux * t + vx * v, f + uy * t + vy * v]);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Values typed into fillable fields aren't in the text layer but show when the page is drawn
async function fieldBoxes(bytes: Uint8Array): Promise<{ boxes: Box[]; found: number }> {
  const boxes: Box[] = [];
  let found = 0;
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = doc.getPages();
    for (const field of doc.getForm().getFields()) {
      if (!(field instanceof PDFTextField)) continue;
      const kind = findSensitive(field.getText() ?? "")[0]?.kind;
      if (!kind) continue;
      found++;
      for (const widget of field.acroField.getWidgets()) {
        const at = pages.findIndex((page) => page.ref === widget.P());
        const rect = widget.getRectangle();
        boxes.push({ page: at >= 0 ? at + 1 : 1, kind, x0: rect.x - PAD, y0: rect.y - PAD, x1: rect.x + rect.width + PAD, y1: rect.y + rect.height + PAD });
      }
    }
  } catch {
    // No form, or one pdf-lib can't read: the text layer still decides
  }
  return { boxes, found };
}

// Where a number is on a photo or scanned page, in thousandths of its width and height from the top left
export interface Region {
  page: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export async function redactPdf(bytes: Uint8Array): Promise<Redaction> {
  let located;
  try {
    located = await findBoxes(bytes);
  } catch {
    return { ok: false, reason: "The PDF couldn’t be read to find where the numbers are." };
  }
  const { boxes, found, pages } = located;
  // Every number found has to have somewhere to paint over
  if (found === 0) return { ok: false, reason: "No private numbers were found to remove." };
  if (boxes.length < found) return { ok: false, reason: "Some numbers couldn’t be placed on the page." };
  return paintPdf(bytes, pages, (number, viewport) =>
    boxes
      .filter((box) => box.page === number)
      .map((box) => {
        // PDF points to page-image pixels, through the viewport's own matrix, so rotated pages land right too
        const [a, b, c, d, e, f] = viewport.transform;
        const corners = [
          [box.x0, box.y0],
          [box.x1, box.y0],
          [box.x0, box.y1],
          [box.x1, box.y1],
        ].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f]);
        const xs = corners.map(([x]) => x);
        const ys = corners.map(([, y]) => y);
        return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
      }),
  ).then((result) => (result.ok ? { ...result, boxes } : result));
}

// A scanned PDF: its pages drawn as images with each region painted over
export async function redactScannedPdf(bytes: Uint8Array, regions: readonly Region[]): Promise<Redaction> {
  if (!regions.length) return { ok: false, reason: "No places were given to cover." };
  const proxy = await getDocumentProxy(new Uint8Array(bytes));
  return paintPdf(bytes, proxy.numPages, (number, viewport) =>
    regions.filter((region) => region.page === number).map((region) => fromThousandths(region, viewport.width, viewport.height)),
  );
}

// A photo: the same picture with each region painted over, turned upright and without its metadata, such as location
export async function redactImage(bytes: Uint8Array, regions: readonly Region[]): Promise<{ ok: true; data: Uint8Array } | { ok: false; reason: string }> {
  if (!regions.length) return { ok: false, reason: "No places were given to cover." };
  const upright = sharp(Buffer.from(bytes)).rotate();
  const { info } = await upright.clone().raw().toBuffer({ resolveWithObject: true });
  const rects = regions.filter((region) => region.page === 1).map((region) => fromThousandths(region, info.width, info.height));
  const painted = upright.composite([{ input: overlay(info.width, info.height, rects), top: 0, left: 0 }]);
  const format = (await sharp(Buffer.from(bytes)).metadata()).format;
  const out = format === "png" ? painted.png() : format === "webp" ? painted.webp({ quality: 90 }) : painted.jpeg({ quality: 90 });
  return { ok: true, data: new Uint8Array(await out.toBuffer()) };
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// A model's region, a little larger on every side, in pixels
function fromThousandths(region: Region, width: number, height: number): Rect {
  const grow = 0.01;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return {
    left: clamp(region.left / 1000 - grow) * width,
    top: clamp(region.top / 1000 - grow) * height,
    right: clamp(region.right / 1000 + grow) * width,
    bottom: clamp(region.bottom / 1000 + grow) * height,
  };
}

function overlay(width: number, height: number, rects: readonly Rect[]): Buffer {
  const shapes = rects.map((rect) => {
    const left = Math.max(0, Math.floor(rect.left));
    const top = Math.max(0, Math.floor(rect.top));
    return `<rect x="${left}" y="${top}" width="${Math.ceil(rect.right - left)}" height="${Math.ceil(rect.bottom - top)}" fill="#000"/>`;
  });
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${shapes.join("")}</svg>`);
}

type Viewport = { width: number; height: number; transform: number[] };

// Every page drawn as an image, the given rectangles painted over, and a new PDF built from the images, then checked:
// same pages, and no text left anywhere to extract
async function paintPdf(bytes: Uint8Array, pages: number, rectsFor: (page: number, viewport: Viewport) => Rect[]): Promise<Redaction> {
  const proxy = await getDocumentProxy(new Uint8Array(bytes));
  const out = await PDFDocument.create();
  for (let number = 1; number <= pages; number++) {
    const page = await proxy.getPage(number);
    const viewport = page.getViewport({ scale: SCALE });
    const png = await renderPageAsImage(new Uint8Array(bytes), number, { canvasImport: () => import("@napi-rs/canvas"), scale: SCALE });
    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);
    const painted = sharp(Buffer.from(png)).composite([{ input: overlay(width, height, rectsFor(number, viewport)), top: 0, left: 0 }]);
    // Whichever is smaller: PNG for text, JPEG for photos and scans
    const [asPng, asJpeg] = await Promise.all([painted.clone().png({ compressionLevel: 9 }).toBuffer(), painted.clone().flatten({ background: "#fff" }).jpeg({ quality: 85 }).toBuffer()]);
    const image = asPng.length <= asJpeg.length ? await out.embedPng(asPng) : await out.embedJpg(asJpeg);
    const size = page.getViewport({ scale: 1 });
    out.addPage([size.width, size.height]).drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
  }
  const data = new Uint8Array(await out.save());

  const check = await getDocumentProxy(new Uint8Array(data));
  if (check.numPages !== pages) return { ok: false, reason: "The redacted copy lost a page." };
  for (let number = 1; number <= check.numPages; number++) {
    const left = (await (await check.getPage(number)).getTextContent()).items.filter((item) => "str" in item && item.str.trim());
    if (left.length) return { ok: false, reason: "The redacted copy still had text in it." };
  }
  return { ok: true, data, boxes: [], pages };
}
