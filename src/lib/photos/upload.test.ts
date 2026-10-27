import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { imageInfo } from "./image-info";
import { jpegHeader, pngBytes, webpHeader } from "./test-images";
import { checkPhotoUpload, photoTitle } from "./upload";

describe("reading a photo's size from its bytes", () => {
  it("reads PNG, JPEG and every kind of WebP", () => {
    expect(imageInfo(pngBytes(640, 480))).toEqual({ type: "image/png", width: 640, height: 480, orientation: null });
    expect(imageInfo(jpegHeader(1200, 900))).toEqual({ type: "image/jpeg", width: 1200, height: 900, orientation: null });
    expect(imageInfo(webpHeader("VP8 ", 800, 600))).toMatchObject({ type: "image/webp", width: 800, height: 600 });
    expect(imageInfo(webpHeader("VP8L", 1024, 768))).toMatchObject({ width: 1024, height: 768 });
    expect(imageInfo(webpHeader("VP8X", 2048, 1536))).toMatchObject({ width: 2048, height: 1536 });
  });

  it("reads a JPEG's EXIF orientation", () => {
    expect(imageInfo(jpegHeader(1200, 900, 6))?.orientation).toBe(6);
    expect(imageInfo(jpegHeader(1200, 900, 1))?.orientation).toBe(1);
  });

  it("rejects anything that isn't a PNG, JPEG or WebP, whatever it's called", () => {
    expect(imageInfo(new TextEncoder().encode("%PDF-1.7 not a photo"))).toBeNull();
    expect(imageInfo(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(imageInfo(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});

describe("checking an uploaded photo", () => {
  it("accepts a photo and reports its real type and size", () => {
    const check = checkPhotoUpload(pngBytes(640, 480), "walnut-board.jpg");
    expect(check).toMatchObject({ ok: true, type: "image/png", width: 640, height: 480, title: "walnut-board" });
  });

  it("goes by the bytes, never the file name", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\n...");
    expect(checkPhotoUpload(pdf, "photo.jpg").ok).toBe(false);
  });

  it("refuses empty and oversized files", () => {
    expect(checkPhotoUpload(new Uint8Array(), "a.png")).toMatchObject({ ok: false, message: expect.stringContaining("empty") });
    const huge = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    huge.set(pngBytes(640, 480));
    expect(checkPhotoUpload(huge, "a.png")).toMatchObject({ ok: false, message: expect.stringContaining("4 MB") });
  });

  it("refuses photos too small to show the product's details", () => {
    const check = checkPhotoUpload(pngBytes(200, 600), "thumb.png");
    expect(check).toMatchObject({ ok: false, message: expect.stringContaining("200 × 600") });
  });

  it("refuses a JPEG still marked as turned, which didn't come through the page", () => {
    expect(checkPhotoUpload(jpegHeader(1200, 900, 6), "camera.jpg")).toMatchObject({ ok: false, message: expect.stringContaining("right way up") });
    expect(checkPhotoUpload(jpegHeader(1200, 900, 1), "camera.jpg").ok).toBe(true);
  });

  it("names it from the owner's words, else a readable file name", () => {
    expect(photoTitle("  Walnut   board ", "x.jpg")).toBe("Walnut board");
    expect(photoTitle("", "IMG_1234.jpg")).toBe("Product photo");
    expect(photoTitle("", "PXL_20261027_120000.jpg")).toBe("Product photo");
    expect(photoTitle("", "image.jpg")).toBe("Product photo");
    expect(photoTitle("", "blue_mug.png")).toBe("blue mug");
  });
});
