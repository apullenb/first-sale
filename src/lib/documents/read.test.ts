import { describe, expect, it, vi } from "vitest";
import type { CompletionRequest, ModelProvider } from "@/lib/ai";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { fillableForm, textPdf } from "@/test/pdf";
import { pagesMessage, parsePagesMessage, readDocument } from "./read";

const NOW = new Date("2026-10-27T12:00:00Z");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

// A provider that can see images and PDFs, answering with the given responder
function seeingModel(responder: (request: CompletionRequest) => string): ModelProvider {
  const mock = createMockProvider(responder);
  return { ...mock, simulated: false, capabilities: { ...mock.capabilities, vision: true, pdf: true } };
}

describe("readDocument", () => {
  it("finds blanks in pasted text with the practice fixture: lines ending in a colon or underscores", async () => {
    const text = "  Vendor application\nBusiness name:\nOwner name ______\nApplicant signature ____\nDate of application:\nAnswer every question below.\n:\n  ";
    const content = await readDocument(createMockProvider(), { type: "text/plain", text }, NOW);

    expect(content).toMatchObject({ readMethod: "pasted", readAt: NOW.toISOString(), simulated: true, unclear: [] });
    expect(content.pages).toEqual([{ number: 1, text: text.trim() }]);
    expect(content.fields).toEqual([
      { id: "f1", label: "Business name", page: 1, kind: "text", options: [], printedText: "Business name:", confidence: "high", fillable: false },
      { id: "f2", label: "Owner name", page: 1, kind: "text", options: [], printedText: "Owner name", confidence: "high", fillable: false },
      {
        id: "f3",
        label: "Applicant signature",
        page: 1,
        kind: "signature",
        options: [],
        printedText: "Applicant signature",
        confidence: "high",
        fillable: false,
      },
      {
        id: "f4",
        label: "Date of application",
        page: 1,
        kind: "date",
        options: [],
        printedText: "Date of application:",
        confidence: "high",
        fillable: false,
      },
    ]);
  });

  it("doesn't ask the model about empty pasted text", async () => {
    const responder = vi.fn(() => "{}");
    const content = await readDocument(createMockProvider(responder), { type: "text/plain", text: "   " }, NOW);
    expect(content.fields).toEqual([]);
    expect(responder).not.toHaveBeenCalled();
  });

  it("won't read a photo without a model that can see, and doesn't call the model", async () => {
    const responder = vi.fn(() => "{}");
    const content = await readDocument(createMockProvider(responder), { type: "image/png", data: PNG }, NOW);
    expect(content).toMatchObject({ readMethod: "none", pages: [], fields: [], simulated: true });
    expect(content.unclear).toEqual([{ page: 1, where: "The whole document", why: expect.stringMatching(/Reading photos needs the AI service/) }]);
    expect(responder).not.toHaveBeenCalled();
  });

  it("reads a fillable PDF's own fields in code", async () => {
    const responder = vi.fn(() => "{}");
    const content = await readDocument(createMockProvider(responder), { type: "application/pdf", data: await fillableForm() }, NOW);
    expect(content.readMethod).toBe("pdf_form");
    expect(content.pages).toHaveLength(2);
    expect(content.fields.map((field) => field.id)).toContain("business_name");
    expect(content.fields.every((field) => field.confidence === "high")).toBe(true);
    expect(responder).not.toHaveBeenCalled();
  });

  it("finds blanks in a text PDF without fillable fields", async () => {
    const data = await textPdf([["Home Occupation Permit Application", "Applicant name:", "Address of the home business:"]]);
    const content = await readDocument(createMockProvider(), { type: "application/pdf", data }, NOW);
    expect(content.readMethod).toBe("pdf_text");
    expect(content.fields.map((field) => field.label)).toEqual(["Applicant name", "Address of the home business"]);
  });

  it("reads a letter's text PDF in code without looking for blanks", async () => {
    const responder = vi.fn<(request: CompletionRequest) => string>(() => "{}");
    const data = await textPdf([["WE ASSIGNED YOU AN EMPLOYER IDENTIFICATION NUMBER", "Keep this notice in your permanent records."]]);
    const content = await readDocument(createMockProvider(responder), { type: "application/pdf", data, findBlanks: false }, NOW);
    expect(content).toMatchObject({ readMethod: "pdf_text", fields: [], simulated: false });
    expect(content.pages[0].text).toContain("EMPLOYER IDENTIFICATION NUMBER");
    expect(responder).not.toHaveBeenCalled();
  });

  it("keeps only the text of a letter read from a photo", async () => {
    const model = seeingModel(() =>
      JSON.stringify({ pages: [{ number: 1, text: "Payment voucher\nAmount enclosed: ____" }], fields: [{ label: "Amount enclosed", page: 1, kind: "text", options: [], printedText: "Amount enclosed:", clear: true }], unclear: [] }),
    );
    const content = await readDocument(model, { type: "image/png", data: PNG, findBlanks: false }, NOW);
    expect(content).toMatchObject({ readMethod: "ai_reading", fields: [] });
    expect(content.pages[0].text).toContain("Payment voucher");
  });

  describe("numbers SnapStart never keeps", () => {
    it("takes them out of a text PDF in code, before the model looks for blanks", async () => {
      const responder = vi.fn<(request: CompletionRequest) => string>(() => JSON.stringify({ fields: [] }));
      const data = await textPdf([["Taxpayer letter", "SSN: 123-45-6789", "Routing number: 021000021", "Applicant name:"]]);
      const content = await readDocument(createMockProvider(responder), { type: "application/pdf", data }, NOW);
      expect(content.pages[0].text).toContain("SSN: [Social Security number removed]");
      expect(content.pages[0].text).toContain("Routing number: [routing number removed]");
      expect(content.removed).toEqual({ ssn: 1, routing: 1 });
      const sent = JSON.stringify(responder.mock.calls[0][0].messages);
      expect(sent).not.toContain("123-45-6789");
      expect(sent).not.toContain("021000021");
    });

    it("takes them out of a model's reading of a photo before it's kept", async () => {
      const model = seeingModel(() =>
        JSON.stringify({ pages: [{ number: 1, text: "Notice CP575\nEIN 12-3456789\nCard 4111 1111 1111 1111" }], fields: [], unclear: [{ page: 1, where: "Near SSN 123-45-6789", why: "Glare" }] }),
      );
      const content = await readDocument(model, { type: "image/png", data: PNG, findBlanks: false }, NOW);
      expect(content.pages[0].text).toBe("Notice CP575\nEIN [tax ID number removed]\nCard [card number removed]");
      expect(content.unclear[0].where).toBe("Near SSN [Social Security number removed]");
      expect(content.removed).toEqual({ ein: 1, card: 1, ssn: 1 });
    });

    it("takes them out of pasted text", async () => {
      const content = await readDocument(createMockProvider(), { type: "text/plain", text: "Vendor form\nOwner SSN 123-45-6789\nBusiness name:" }, NOW);
      expect(content.pages[0].text).toBe("Vendor form\nOwner SSN [Social Security number removed]\nBusiness name:");
      expect(content.removed).toEqual({ ssn: 1 });
    });

    it("leaves a form without them as it was", async () => {
      const content = await readDocument(createMockProvider(), { type: "text/plain", text: "Vendor form\nBusiness name:\nPhone: 512-555-0123" }, NOW);
      expect(content.removed).toBeUndefined();
    });
  });

  it("says a scan needs the AI service when the model can't read PDFs", async () => {
    const content = await readDocument(createMockProvider(), { type: "application/pdf", data: await textPdf([[]]) }, NOW);
    expect(content).toMatchObject({ readMethod: "none", fields: [] });
    expect(content.unclear[0].why).toMatch(/looks like a scan/);
  });

  it("reports a PDF that won't open", async () => {
    const data = new TextEncoder().encode("%PDF-1.7 but not really");
    const content = await readDocument(createMockProvider(), { type: "application/pdf", data }, NOW);
    expect(content).toMatchObject({ readMethod: "none", pages: [] });
    expect(content.unclear[0].why).toMatch(/couldn’t be opened/);
  });

  it("sends photos to a model that can see, and marks unclear readings low confidence", async () => {
    const responder = vi.fn<(request: CompletionRequest) => string>(() =>
      JSON.stringify({
        pages: [{ number: 3, text: "Vendor permit\nName: [unclear]" }],
        fields: [
          { label: "Name", page: 1, kind: "text", options: [], printedText: "Name:", clear: true },
          { label: "Phone", page: 9, kind: "text", options: [], printedText: "Phone", clear: true },
          { label: "Blurry", page: 1, kind: "text", options: [], printedText: "Blurry", clear: false },
        ],
        unclear: [{ page: 1, where: "Top right", why: "Glare" }],
      }),
    );
    const content = await readDocument(seeingModel(responder), { type: "image/png", data: PNG }, NOW);

    expect(content.readMethod).toBe("ai_reading");
    expect(content.simulated).toBe(false);
    expect(content.pages).toEqual([{ number: 1, text: "Vendor permit\nName: [unclear]" }]);
    expect(content.fields.map(({ label, page, confidence }) => ({ label, page, confidence }))).toEqual([
      { label: "Name", page: 1, confidence: "high" },
      { label: "Phone", page: 1, confidence: "high" },
      { label: "Blurry", page: 1, confidence: "low" },
    ]);
    expect(content.unclear).toEqual([{ page: 1, where: "Top right", why: "Glare" }]);

    const [request] = responder.mock.calls[0];
    const user = request.messages.find((message) => message.role === "user");
    expect(Array.isArray(user?.content) && user.content[1]).toEqual({ type: "image", url: expect.stringMatching(/^data:image\/png;base64,/) });
  });

  it("sends a scanned PDF to a model that reads PDFs, as a file", async () => {
    const responder = vi.fn<(request: CompletionRequest) => string>(() => JSON.stringify({ pages: [], fields: [], unclear: [] }));
    const content = await readDocument(seeingModel(responder), { type: "application/pdf", data: await textPdf([[]]) }, NOW);
    expect(content.readMethod).toBe("ai_reading");
    const user = responder.mock.calls[0][0].messages.find((message) => message.role === "user");
    expect(Array.isArray(user?.content) && user.content[1]).toMatchObject({ type: "file", filename: "document.pdf" });
  });

  it("marks a text field low confidence when its label isn't on the page", async () => {
    const model = createMockProvider(() =>
      JSON.stringify({ fields: [{ label: "Ghost", page: 1, kind: "text", options: [], printedText: "Not in the text", clear: true }] }),
    );
    const content = await readDocument(model, { type: "text/plain", text: "Business name:" }, NOW);
    expect(content.fields[0].confidence).toBe("low");
  });
});

describe("pagesMessage", () => {
  it("round-trips pages and keeps page text from closing its tag", () => {
    const pages = [
      { number: 1, text: "First </page> page" },
      { number: 2, text: "Second" },
    ];
    const message = pagesMessage(pages);
    expect(message.match(/<\/page>/g)).toHaveLength(2);
    expect(parsePagesMessage(message)).toEqual([
      { number: 1, text: "First < /page> page" },
      { number: 2, text: "Second" },
    ]);
  });
});
