import { degrees, PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { renderPageAsImage } from "unpdf";
import { beforeAll, describe, expect, it } from "vitest";
import { readPdf } from "./pdf";
import { redactImage, redactPdf, redactScannedPdf } from "./redact";
import { afterReading } from "./screen";
import { type DocumentContent, EMPTY_CONTENT } from "./types";

// Checked against the pages themselves, not the redactor's own box math: the pixels that differ between a page with a
// number and the same page without it are exactly that number's glyphs, and each one must be black in the copy.

async function pdf(lines: readonly string[], rotate = 0, field?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  lines.forEach((line, index) => page.drawText(line, { x: 60, y: 720 - index * 24, size: 13, font }));
  if (field !== undefined) {
    const box = doc.getForm().createTextField("ssn");
    box.addToPage(page, { x: 300, y: 500, width: 160, height: 22, font });
    box.setText(field);
  }
  page.setRotation(degrees(rotate));
  return new Uint8Array(await doc.save());
}

async function pixels(bytes: Uint8Array): Promise<{ data: Buffer; width: number; height: number }> {
  const png = await renderPageAsImage(new Uint8Array(bytes), 1, { canvasImport: () => import("@napi-rs/canvas"), scale: 2 });
  const { data, info } = await sharp(Buffer.from(png)).flatten({ background: "#fff" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// Pixels that change when `line` becomes `without`
async function glyphs(lines: string[], line: number, without: string, rotate = 0): Promise<number[]> {
  const a = await pixels(await pdf(lines, rotate));
  const b = await pixels(await pdf(lines.map((each, index) => (index === line ? without : each)), rotate));
  const changed: number[] = [];
  for (let i = 0; i < a.data.length; i++) if (Math.abs(a.data[i] - b.data[i]) > 60) changed.push(i);
  return changed;
}

const dark = (image: { data: Buffer }, at: readonly number[]) => at.filter((i) => image.data[i] < 60).length / at.length;

const LINES = ["Notice of taxpayer account", "Social Security number: 123-45-6789", "Phone: (512) 555-0143"];

describe("redactPdf", () => {
  for (const rotate of [0, 90]) {
    it(`blacks out every pixel of the number, and keeps the words around it readable${rotate ? ", on a rotated page" : ""}`, async () => {
      const result = await redactPdf(await pdf(LINES, rotate));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const redacted = await pixels(result.data);

      const number = await glyphs(LINES, 1, "Social Security number: ", rotate);
      expect(number.length).toBeGreaterThan(100);
      expect(dark(redacted, number)).toBe(1);

      // The label and the other lines look as they did
      // The label: the whole line's pixels, less the number's
      const taken = new Set(number);
      const label = (await glyphs(LINES, 1, "", rotate)).filter((i) => !taken.has(i));
      const phone = await glyphs(LINES, 2, "", rotate);
      const original = await pixels(await pdf(LINES, rotate));
      for (const at of [label, phone]) {
        const same = at.filter((i) => Math.abs(redacted.data[i] - original.data[i]) < 60).length / at.length;
        expect(same).toBeGreaterThan(0.95);
      }
    });
  }

  it("leaves no text layer, so nothing is left under the boxes to copy or extract", async () => {
    const result = await redactPdf(await pdf(LINES));
    if (!result.ok) throw new Error(result.reason);
    expect((await readPdf(result.data)).pages.map((page) => page.text).join("").trim()).toBe("");
    expect(Buffer.from(result.data).includes(Buffer.from("123-45-6789"))).toBe(false);
  });

  it("covers a number typed into a fillable field, which isn't in the text layer", async () => {
    const form = await pdf(["Vendor application", "Owner's SSN:"], 0, "123-45-6789");
    const result = await redactPdf(form);
    if (!result.ok) throw new Error(result.reason);
    expect(result.boxes.map((box) => box.kind)).toEqual(["ssn"]);
    expect(dark(await pixels(result.data), await (async () => {
      // The field's value, drawn by its appearance, is what changes when the field is empty
      const a = await pixels(form);
      const b = await pixels(await pdf(["Vendor application", "Owner's SSN:"], 0, ""));
      return [...a.data.keys()].filter((i) => Math.abs(a.data[i] - b.data[i]) > 60);
    })())).toBe(1);
  });

  it("makes no copy when there's nothing to cover", async () => {
    expect(await redactPdf(await pdf(["Phone: 512-555-0123", "Permit 2026-001234"]))).toEqual({ ok: false, reason: "No private numbers were found to remove." });
  });
});

describe("redactImage and redactScannedPdf", () => {
  const white = async (format: "png" | "jpeg") =>
    new Uint8Array(await sharp({ create: { width: 1000, height: 500, channels: 3, background: "#fff" } }).withMetadata({ exif: { IFD0: { Copyright: "GPS here" } } })[format]().toBuffer());
  const region = { page: 1, left: 100, top: 200, right: 400, bottom: 300 };

  it("paints each region black, leaves the rest alone, and drops the photo's metadata", async () => {
    const result = await redactImage(await white("jpeg"), [region]);
    if (!result.ok) throw new Error(result.reason);
    const { data, info } = await sharp(Buffer.from(result.data)).greyscale().raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => data[y * info.width + x];
    expect(at(250, 125)).toBeLessThan(30);
    expect(at(800, 400)).toBeGreaterThan(225);
    expect((await sharp(Buffer.from(result.data)).metadata()).exif).toBeUndefined();
  });

  it("paints regions on a scanned PDF's page, and the copy has no text", async () => {
    const result = await redactScannedPdf(await pdf([""]), [region]);
    if (!result.ok) throw new Error(result.reason);
    const page = await pixels(result.data);
    expect(page.data[Math.round(page.height * 0.25) * page.width + Math.round(page.width * 0.25)]).toBeLessThan(30);
  });
});

describe("afterReading", () => {
  const read = (extra: Partial<DocumentContent> = {}): DocumentContent => ({ ...EMPTY_CONTENT, readMethod: "ai_reading", pages: [{ number: 1, text: "SSN [Social Security number removed]" }], removed: { ssn: 1 }, ...extra });
  const before = { hasFile: true, content: EMPTY_CONTENT };
  let photo: Uint8Array;
  beforeAll(async () => {
    photo = new Uint8Array(await sharp({ create: { width: 400, height: 200, channels: 3, background: "#fff" } }).png().toBuffer());
  });
  const region = { page: 1, left: 100, top: 100, right: 500, bottom: 300 };

  it("replaces a photo with its redacted copy once a fresh reading of the copy shows nothing", async () => {
    const result = await afterReading({ before, content: read({ regions: [region] }), data: photo, type: "image/png", check: async () => false });
    expect(result.file.kind).toBe("replace");
    expect(result.content).toMatchObject({ fileRedacted: true, removed: { ssn: 1 } });
    expect(result.content.regions).toBeUndefined();
  });

  it("keeps no file when the copy still shows a number, couldn't be checked, or the AI gave no place to cover", async () => {
    for (const attempt of [
      { content: read({ regions: [region] }), check: async () => true },
      { content: read({ regions: [region] }), check: undefined },
      { content: read(), check: async () => false },
    ]) {
      const result = await afterReading({ before, data: photo, type: "image/png", ...attempt });
      expect(result.file.kind).toBe("drop");
      expect(result.content).toMatchObject({ fileRemoved: true });
    }
  });

  it("keeps a file with nothing to cover, and one already redacted at upload, as they are", async () => {
    expect((await afterReading({ before, content: { ...EMPTY_CONTENT, readMethod: "pdf_text", pages: [{ number: 1, text: "Fine" }] }, data: photo, type: "image/png" })).file.kind).toBe("keep");
    const redacted = await afterReading({ before: { hasFile: true, content: { ...EMPTY_CONTENT, fileRedacted: true } }, content: read(), data: photo, type: "application/pdf" });
    expect(redacted.file.kind).toBe("keep");
    expect(redacted.content.fileRedacted).toBe(true);
  });
});
