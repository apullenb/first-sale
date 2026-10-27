import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { fillableForm, textPdf } from "@/test/pdf";
import { labelNear, pdfText, readPdf } from "./pdf";

describe("readPdf", () => {
  it("reads page text and fillable fields, labeled from the printed text next to them", async () => {
    const reading = await readPdf(await fillableForm());

    expect(reading.totalPages).toBe(2);
    expect(reading.looksScanned).toBe(false);
    expect(reading.pages[0]).toMatchObject({ number: 1 });
    expect(reading.pages[0].text).toContain("Business Registration Form");
    expect(reading.pages[0].text).toContain("This form registers a trade name with the Secretary of State.");
    expect(reading.pages[1].text).toContain("Contact email");

    const byId = new Map(reading.fields.map((field) => [field.id, field]));
    expect(byId.get("business_name")).toMatchObject({
      label: "Business name",
      printedText: "Business name",
      page: 1,
      kind: "text",
      options: [],
      confidence: "high",
      fillable: true,
    });
    expect(byId.get("street_address")).toMatchObject({ label: "Street address", kind: "text", page: 1 });
    expect(byId.get("is_llc")).toMatchObject({ label: "Limited liability company", kind: "checkbox", page: 1 });
    expect(byId.get("filing_state")).toMatchObject({ label: "Filing state", kind: "choice", options: ["Ohio", "Michigan"] });
    expect(byId.get("contact_email")).toMatchObject({ label: "Contact email", kind: "text", page: 2 });
    expect(byId.get("applicant_signature")).toMatchObject({
      label: "Applicant signature",
      kind: "signature",
      page: 1,
      fillable: false,
    });
  });

  it("prefers a field's tooltip over nearby text, and falls back to a readable field name", async () => {
    const doc = await PDFDocument.load(await fillableForm());
    const form = doc.getForm();
    const named = form.getTextField("business_name");
    named.acroField.dict.set(PDFName.of("TU"), PDFString.of("Legal name of the business"));
    const page = doc.getPage(1);
    form.createTextField("topmostSubform[0].Page2[0].f2_1[0]").addToPage(page, { x: 400, y: 300, width: 100, height: 20 });

    const reading = await readPdf(await doc.save());
    const byId = new Map(reading.fields.map((field) => [field.id, field]));
    expect(byId.get("business_name")).toMatchObject({ label: "Legal name of the business", printedText: "Business name" });
    expect(byId.get("topmostSubform[0].Page2[0].f2_1[0]")).toMatchObject({ label: "f2 1", printedText: "", page: 2 });
  });

  it("says a PDF with no text looks scanned", async () => {
    const reading = await readPdf(await textPdf([[], []]));
    expect(reading).toMatchObject({ totalPages: 2, fields: [], looksScanned: true });
  });

  it("doesn't call a page of real text scanned", async () => {
    const reading = await readPdf(await textPdf([["Apply for a vendor license before your first market day."]]));
    expect(reading.looksScanned).toBe(false);
    expect(reading.fields).toEqual([]);
  });
});

describe("pdfText", () => {
  it("joins every page's text and caps its length", async () => {
    const bytes = await textPdf([["First page line."], ["Second page line."]]);
    expect(await pdfText(bytes, 10_000)).toBe("First page line.\nSecond page line.");
    expect(await pdfText(bytes, 5)).toBe("First");
  });
});

describe("labelNear", () => {
  const item = (str: string, x: number, y: number, width = str.length * 5) => ({ str, x, y, width, hasEOL: false });
  const box = { x: 200, y: 500, width: 150, height: 20 };

  it("takes words to the left on the same line", () => {
    expect(labelNear([item("Owner", 100, 505), item("name", 135, 505), item("Far away", 10, 300)], box)).toBe("Owner name");
  });

  it("falls back to words just above the box", () => {
    expect(labelNear([item("Mailing address", 210, 525)], box)).toBe("Mailing address");
  });

  it("takes the words right of a checkbox, without trailing dots", () => {
    const check = { x: 50, y: 500, width: 12, height: 12 };
    expect(labelNear([item("Yes, I sell food....", 66, 501), item("Left label", 0, 501)], check, true)).toBe("Yes, I sell food");
  });
});
