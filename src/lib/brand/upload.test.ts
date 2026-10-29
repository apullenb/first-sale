import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { pngBytes } from "@/lib/photos/test-images";
import { checkLibraryUpload, checkLogoUpload, logoWords, pictureTitle } from "./upload";

describe("uploading a logo", () => {
  it("takes a PNG, JPEG or WebP by its bytes, with a fingerprint", () => {
    const checked = checkLogoUpload(pngBytes(600, 300), "Rise logo final.png");
    expect(checked).toMatchObject({ ok: true, type: "image/png", width: 600, height: 300, title: "Rise logo final" });
    if (checked.ok) expect(checked.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses SVG, PDFs, other files, empty files and tiny pictures", () => {
    const svg = new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(checkLogoUpload(svg, "logo.svg")).toMatchObject({ ok: false, message: expect.stringMatching(/SVG/) });
    expect(checkLogoUpload(new TextEncoder().encode("%PDF-1.7"), "logo.pdf")).toMatchObject({ ok: false, message: expect.stringMatching(/PDF/) });
    expect(checkLogoUpload(new TextEncoder().encode("hello"), "logo.png")).toMatchObject({ ok: false, message: expect.stringMatching(/isn’t a picture/) });
    expect(checkLogoUpload(new Uint8Array(), "logo.png")).toMatchObject({ ok: false, message: expect.stringMatching(/empty/) });
    expect(checkLogoUpload(pngBytes(80, 80), "logo.png")).toMatchObject({ ok: false, message: expect.stringMatching(/too small \(80 × 80/) });
    const huge = pngBytes(1, 1);
    new DataView(huge.buffer, huge.byteOffset).setUint32(16, 3_000_000_000);
    expect(checkLogoUpload(huge, "logo.png")).toMatchObject({ ok: false, message: expect.stringMatching(/too large/) });
  });

  it("refuses logos too big to decode on a phone, and moving pictures", () => {
    const wide = pngBytes(1, 1);
    new DataView(wide.buffer, wide.byteOffset).setUint32(16, 5000);
    new DataView(wide.buffer, wide.byteOffset).setUint32(20, 5000);
    expect(checkLogoUpload(wide, "logo.png")).toMatchObject({ ok: false, message: expect.stringMatching(/too large \(5000 × 5000/) });
    expect(checkLibraryUpload(wide, "stall.png", "")).toMatchObject({ ok: true });

    // An animation control chunk spliced in before the image data
    const still = pngBytes(600, 300);
    const actl = new Uint8Array([0, 0, 0, 8, ...new TextEncoder().encode("acTL"), 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
    const moving = new Uint8Array([...still.subarray(0, 33), ...actl, ...still.subarray(33)]);
    expect(checkLogoUpload(moving, "logo.png")).toMatchObject({ ok: false, message: expect.stringMatching(/Moving pictures/) });
    expect(checkLogoUpload(still, "logo.png")).toMatchObject({ ok: true });
  });

  it("refuses files over the upload limit", () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(pngBytes(600, 300));
    expect(checkLogoUpload(big, "logo.png")).toMatchObject({ ok: false, message: expect.stringMatching(/over 4 MB/) });
  });
});

describe("uploading to the Brand Library", () => {
  it("takes small pictures a logo can't be, and the owner's name for them", () => {
    expect(checkLibraryUpload(pngBytes(64, 64), "IMG_2041.png", "")).toMatchObject({ ok: true, title: "Picture" });
    expect(checkLibraryUpload(pngBytes(64, 64), "IMG_2041.png", "  Our   market\nstall ")).toMatchObject({ ok: true, title: "Our market stall" });
    expect(checkLibraryUpload(pngBytes(16, 16), "tiny.png", "")).toMatchObject({ ok: false });
  });

  it("names a file from its own name when the camera didn't make it up", () => {
    expect(pictureTitle("", "C:\\photos\\market_day.jpg", "Picture")).toBe("market day");
    expect(pictureTitle("", "Screenshot 2026-10-01.png", "Picture")).toBe("Picture");
  });
});

describe("the words in an uploaded logo", () => {
  it("are kept as typed, without control characters or extra spaces", () => {
    expect(logoWords("  Rise\u0000   Bakery\n")).toBe("Rise Bakery");
    expect(logoWords("x".repeat(500))).toHaveLength(120);
  });
});
