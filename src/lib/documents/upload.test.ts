import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkUpload, cleanTitle, dataUrl, MAX_UPLOAD_BYTES, sniffType } from "./upload";

const bytes = (...values: number[]) => new Uint8Array([...values, 0, 0, 0, 0, 0, 0, 0, 0]);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
// RIFF, 4 size bytes, WEBP
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);
// Windows executable header
const EXE = bytes(0x4d, 0x5a, 0x90, 0x00);

describe("sniffType", () => {
  it.each([
    ["a PDF", PDF, "application/pdf"],
    ["a PNG", PNG, "image/png"],
    ["a JPEG", JPEG, "image/jpeg"],
    ["a WebP", WEBP, "image/webp"],
  ])("knows %s by its first bytes", (_name, data, type) => {
    expect(sniffType(data)).toBe(type);
  });

  it("refuses other files, including a RIFF file that isn't WebP", () => {
    expect(sniffType(EXE)).toBeNull();
    expect(sniffType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45))).toBeNull();
    expect(sniffType(new TextEncoder().encode("hello"))).toBeNull();
    expect(sniffType(new Uint8Array())).toBeNull();
  });
});

describe("checkUpload", () => {
  it("accepts a PDF with its hash and a clean title", () => {
    expect(checkUpload(PDF, "My_Form.pdf")).toEqual({
      ok: true,
      type: "application/pdf",
      sha256: createHash("sha256").update(PDF).digest("hex"),
      title: "My Form",
    });
  });

  it("goes by the bytes, not the name: a renamed .exe is refused", () => {
    expect(checkUpload(EXE, "form.pdf")).toMatchObject({ ok: false, message: expect.stringMatching(/PDFs and photos/) });
  });

  it("refuses empty files", () => {
    expect(checkUpload(new Uint8Array(), "a.pdf")).toEqual({ ok: false, message: "That file is empty." });
  });

  it("allows exactly the size limit and refuses one byte more", () => {
    const atLimit = new Uint8Array(MAX_UPLOAD_BYTES);
    atLimit.set(PDF);
    expect(checkUpload(atLimit, "a.pdf").ok).toBe(true);

    const over = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    over.set(PDF);
    expect(checkUpload(over, "a.pdf")).toMatchObject({ ok: false, message: expect.stringMatching(/over 4 MB/) });
  });
});

describe("cleanTitle", () => {
  it("drops the path, extension, control characters and underscores", () => {
    expect(cleanTitle("C:\\Users\\jo\\Downloads\\Vendor_License__Form.PDF")).toBe("Vendor License Form");
    expect(cleanTitle("/tmp/scan<script>.jpeg")).toBe("scanscript");
    expect(cleanTitle("line\nbreak.png")).toBe("linebreak");
  });

  it("caps long titles and names untitled files", () => {
    expect(cleanTitle(`${"a".repeat(200)}.pdf`)).toHaveLength(120);
    expect(cleanTitle(".pdf")).toBe("Untitled document");
    expect(cleanTitle("")).toBe("Untitled document");
  });
});

describe("dataUrl", () => {
  it("encodes bytes as base64", () => {
    expect(dataUrl("application/pdf", new TextEncoder().encode("%PDF-"))).toBe("data:application/pdf;base64,JVBERi0=");
  });
});
