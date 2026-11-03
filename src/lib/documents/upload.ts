import { createHash } from "node:crypto";

// What the document workspace accepts. Checked by the file's first bytes, never by its name or the browser's label.

// Hosting caps a request at about 4.5 MB; photos are shrunk in the browser before upload
export const MAX_UPLOAD_BYTES = 4_000_000;
export const MAX_PASTE_CHARS = 30_000;

export const ACCEPTED_TYPES = {
  "application/pdf": "PDF",
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "image/webp": "WebP image",
} as const;
export type AcceptedType = keyof typeof ACCEPTED_TYPES;

export function sniffType(bytes: Uint8Array): AcceptedType | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  // RIFF....WEBP
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

export type UploadCheck =
  | { ok: true; type: AcceptedType; sha256: string; title: string }
  | { ok: false; message: string };

export function checkUpload(bytes: Uint8Array, fileName: string): UploadCheck {
  if (bytes.byteLength === 0) return { ok: false, message: "That file is empty." };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "That file is over 4 MB. Try a smaller scan, or take a photo of each page." };
  }
  const type = sniffType(bytes);
  if (!type) return { ok: false, message: "SnapStart can read PDFs and photos (PNG, JPEG or WebP). Try one of those." };
  return { ok: true, type, sha256: createHash("sha256").update(bytes).digest("hex"), title: cleanTitle(fileName) };
}

// Readable title from a file name, without path or odd characters
export function cleanTitle(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const title = base
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return title || "Untitled document";
}

export function dataUrl(type: string, bytes: Uint8Array): string {
  return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
}
