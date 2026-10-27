import { PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { fillableForm } from "@/test/pdf";
import { answerSheet, fillPdfCopy } from "./fill";
import { readPdf } from "./pdf";
import { toWinAnsi } from "./pdf-writer";
import type { DocumentField, DraftAnswer, DraftAnswers } from "./types";

const confirmed = (value: string): DraftAnswer => ({ value, source: "owner", state: "confirmed", note: "" });
const suggested = (value: string): DraftAnswer => ({ value, source: "profile.name", state: "suggested", note: "" });

async function formAndFields(): Promise<{ bytes: Uint8Array; fields: DocumentField[] }> {
  const bytes = await fillableForm();
  return { bytes, fields: (await readPdf(bytes)).fields };
}

describe("fillPdfCopy", () => {
  it("fills only confirmed answers and leaves the original alone", async () => {
    const { bytes, fields } = await formAndFields();
    const answers: DraftAnswers = {
      business_name: confirmed("Rise Bakery"),
      street_address: suggested("1 Main St"),
      is_llc: confirmed("Yes"),
      filing_state: confirmed("Ohio"),
      contact_email: { value: "", source: "", state: "unanswered", note: "" },
    };

    const outcome = await fillPdfCopy(bytes, fields, answers);
    expect(outcome).toMatchObject({ ok: true, filled: 3, skipped: [] });

    const form = (await PDFDocument.load(outcome.ok ? outcome.bytes : new Uint8Array())).getForm();
    expect(form.getTextField("business_name").getText()).toBe("Rise Bakery");
    expect(form.getTextField("street_address").getText()).toBeUndefined();
    expect(form.getCheckBox("is_llc").isChecked()).toBe(true);
    expect(form.getDropdown("filing_state").getSelected()).toEqual(["Ohio"]);
    expect(form.getTextField("contact_email").getText()).toBeUndefined();

    const original = (await PDFDocument.load(bytes)).getForm();
    expect(original.getTextField("business_name").getText()).toBeUndefined();
  });

  it("never fills a signature field, even with a confirmed answer", async () => {
    const { bytes, fields } = await formAndFields();
    const outcome = await fillPdfCopy(bytes, fields, {
      business_name: confirmed("Rise Bakery"),
      applicant_signature: confirmed("Jo Baker"),
    });
    expect(outcome).toMatchObject({ ok: true, filled: 1, skipped: [] });

    const doc = await PDFDocument.load(outcome.ok ? outcome.bytes : new Uint8Array());
    const signature = doc.getForm().getSignature("applicant_signature");
    expect(signature.acroField.dict.get(PDFName.of("V"))).toBeUndefined();
  });

  it("unchecks a checkbox for any answer but Yes", async () => {
    const { bytes, fields } = await formAndFields();
    const outcome = await fillPdfCopy(bytes, fields, { is_llc: confirmed("No") });
    const form = (await PDFDocument.load(outcome.ok ? outcome.bytes : new Uint8Array())).getForm();
    expect(form.getCheckBox("is_llc").isChecked()).toBe(false);
  });

  it("skips a text answer longer than the field allows", async () => {
    const { bytes, fields } = await formAndFields();
    const outcome = await fillPdfCopy(bytes, fields, {
      business_name: confirmed("Rise Bakery"),
      street_address: confirmed("1234 A Very Long Street Name That Goes On, Columbus"),
    });
    expect(outcome).toMatchObject({ ok: true, filled: 1, skipped: ["Street address"] });
  });

  // pdf-lib's dropdown select() takes any value by turning on editing
  it("skips a dropdown answer that isn't one of the form's options", async () => {
    const { bytes, fields } = await formAndFields();
    const outcome = await fillPdfCopy(bytes, fields, { business_name: confirmed("Rise Bakery"), filing_state: confirmed("Texas") });
    expect(outcome).toMatchObject({ ok: true, filled: 1, skipped: ["Filing state"] });

    const dropdown = (await PDFDocument.load(outcome.ok ? outcome.bytes : new Uint8Array())).getForm().getDropdown("filing_state");
    expect(dropdown.getSelected()).toEqual([]);
    expect(dropdown.isEditable()).toBe(false);
  });

  it("joins lines in a single-line field and swaps characters the font can't draw", async () => {
    const { bytes, fields } = await formAndFields();
    const outcome = await fillPdfCopy(bytes, fields, { business_name: confirmed("Rise\n\nBakery ✓") });
    const form = (await PDFDocument.load(outcome.ok ? outcome.bytes : new Uint8Array())).getForm();
    expect(form.getTextField("business_name").getText()).toBe("Rise, Bakery ?");
  });

  it("refuses when nothing is confirmed", async () => {
    const { bytes, fields } = await formAndFields();
    expect(await fillPdfCopy(bytes, fields, { business_name: suggested("Rise Bakery") })).toEqual({
      ok: false,
      reason: "nothing_confirmed",
    });
    expect(await fillPdfCopy(bytes, fields, { business_name: confirmed("") })).toEqual({ ok: false, reason: "nothing_confirmed" });
  });

  it("reports a file that won't open", async () => {
    const fields: DocumentField[] = [
      { id: "a", label: "A", page: 1, kind: "text", options: [], printedText: "", confidence: "high", fillable: true },
    ];
    expect(await fillPdfCopy(new TextEncoder().encode("not a pdf"), fields, { a: confirmed("x") })).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });
});

describe("answerSheet", () => {
  it("returns a PDF listing each blank and where its answer came from", async () => {
    const fields: DocumentField[] = [
      { id: "f1", label: "Business name", page: 1, kind: "text", options: [], printedText: "", confidence: "high", fillable: false },
      { id: "f2", label: "Signature", page: 2, kind: "signature", options: [], printedText: "", confidence: "high", fillable: false },
      { id: "f3", label: "Phone", page: 2, kind: "text", options: [], printedText: "", confidence: "high", fillable: false },
    ];
    const bytes = await answerSheet({
      formTitle: "Trade name registration ✓",
      fields,
      answers: {
        f1: confirmed("Rise Bakery"),
        f2: { value: "", source: "", state: "fill_yourself", note: "Only you can sign." },
      },
      sourceLabel: (source) => (source === "owner" ? "You" : source),
      preparedOn: "October 27, 2026",
    });

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const text = (await readPdf(bytes)).pages.map((page) => page.text).join("\n");
    expect(text).toContain("Answers for: Trade name registration ?");
    expect(text).toContain("Not filed");
    expect(text).toContain("Rise Bakery");
    expect(text).toContain("You confirmed this · From: You · Page 1");
    expect(text).toContain("Only you can sign.");
    expect(text).toContain("Not answered yet");
  });
});

describe("toWinAnsi", () => {
  it("keeps Windows-1252 characters and replaces the rest", () => {
    expect(toWinAnsi("Café “quoted” – €5 • ok")).toBe("Café “quoted” – €5 • ok");
    expect(toWinAnsi("Tab\there")).toBe("Tab here");
    expect(toWinAnsi("Line\nbreak")).toBe("Line\nbreak");
    expect(toWinAnsi("a−b‐c")).toBe("a-b-c");
    expect(toWinAnsi("日本 ✓ 😀")).toBe("?? ? ?");
  });

  it("composes accents before checking them", () => {
    expect(toWinAnsi("Café")).toBe("Café");
  });
});


describe("prepared copies say they aren't filed", () => {
  it("marks the filled PDF's details as not filed", async () => {
    const { bytes, fields } = await formAndFields();
    const outcome = await fillPdfCopy(bytes, fields, { business_name: confirmed("Rise Bakery") });
    const doc = await PDFDocument.load(outcome.ok ? outcome.bytes : new Uint8Array());
    expect(doc.getSubject()).toMatch(/Not filed/);
  });

  it("prints only confirmed answers on an answer sheet", async () => {
    const { fields } = await formAndFields();
    const sheet = await answerSheet({
      formTitle: "Test form",
      fields,
      answers: { business_name: confirmed("Rise Bakery"), street_address: suggested("1 Main St") },
      sourceLabel: () => "Your business details",
      preparedOn: "October 27, 2026",
    });
    const text = (await readPdf(sheet)).pages.map((page) => page.text).join("\n");
    expect(text).toContain("Rise Bakery");
    expect(text).not.toContain("1 Main St");
    expect(text).toContain("Not confirmed yet");
  });
});
