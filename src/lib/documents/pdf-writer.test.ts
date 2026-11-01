import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { pdfText } from "./pdf";
import { writePdf } from "./pdf-writer";

describe("writePdf", () => {
  it("embeds its fonts, so viewers don't swap in letters of other widths", async () => {
    const bytes = await writePdf({ title: "Maple Crumb Test Bakery: Business Plan", blocks: [{ heading: "1. Summary", paragraphs: ["Cookies “by the dozen” — $18."] }], footer: "Footer" });
    const doc = await PDFDocument.load(bytes);
    const fonts = doc.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter((object): object is PDFDict => object instanceof PDFDict && object.get(PDFName.of("Type")) === PDFName.of("FontDescriptor"));
    expect(fonts.length).toBe(2);
    for (const font of fonts) expect(font.get(PDFName.of("FontFile2"))).toBeDefined();
    const text = await pdfText(bytes, 10_000);
    expect(text).toContain("Maple Crumb Test Bakery: Business Plan");
    expect(text).toContain("Cookies “by the dozen” — $18.");
  });
});
