import { createHash } from "node:crypto";
import { cleanTitle, MAX_UPLOAD_BYTES, sniffType } from "@/lib/documents/upload";
import { imageInfo, type PhotoType } from "@/lib/photos/image-info";
import { MAX_LOGO_WORDS, MAX_PICTURE_NAME, MAX_PICTURE_SIDE, MIN_LIBRARY_SIDE, MIN_LOGO_SIDE } from "./library";

// What the owner may upload as their logo or into their Brand Library, checked by the file's own bytes. Never changed after.

export type PictureCheck = { ok: true; type: PhotoType; width: number; height: number; sha256: string; title: string } | { ok: false; message: string };

const TYPES = "Use a PNG, JPEG or WebP picture.";

function checkPicture(bytes: Uint8Array, fileName: string, name: string, minSide: number, fallback: string): PictureCheck {
  if (bytes.byteLength === 0) return { ok: false, message: "That file is empty. Choose it again." };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, message: "That file is over 4 MB. Save a smaller copy, then upload that." };
  const info = imageInfo(bytes);
  if (!info) {
    const svg = /\.svgz?$/i.test(fileName) || new TextDecoder().decode(bytes.subarray(0, 300)).includes("<svg");
    if (svg) return { ok: false, message: `SVG files can’t be uploaded, because they can carry code. Export a PNG from your design app instead.` };
    return { ok: false, message: sniffType(bytes) === "application/pdf" ? `That’s a PDF. ${TYPES}` : `That isn’t a picture First Sale can use. ${TYPES}` };
  }
  if (Math.max(info.width, info.height) > MAX_PICTURE_SIDE) {
    return { ok: false, message: `This picture is too large (${info.width} × ${info.height} pixels). Save a copy no more than ${MAX_PICTURE_SIDE.toLocaleString("en-US")} pixels on each side.` };
  }
  if (Math.min(info.width, info.height) < minSide) {
    return { ok: false, message: `This picture is too small (${info.width} × ${info.height} pixels). Use one at least ${minSide} pixels on each side.` };
  }
  return { ok: true, type: info.type, width: info.width, height: info.height, sha256: createHash("sha256").update(bytes).digest("hex"), title: pictureTitle(name, fileName, fallback) };
}

export function checkLogoUpload(bytes: Uint8Array, fileName: string): PictureCheck {
  return checkPicture(bytes, fileName, "", MIN_LOGO_SIDE, "My logo");
}

export function checkLibraryUpload(bytes: Uint8Array, fileName: string, name: string): PictureCheck {
  return checkPicture(bytes, fileName, name, MIN_LIBRARY_SIDE, "Picture");
}

// The owner's name for it, else the file name; camera files are often just "image"
export function pictureTitle(name: string, fileName: string, fallback: string): string {
  const typed = name.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_PICTURE_NAME);
  if (typed) return typed;
  const base = fileName.split(/[\\/]/).pop()?.replace(/\.[a-z0-9]{1,5}$/i, "").trim() ?? "";
  return !base || /^(image|photo|img|dsc|pxl|screenshot)[\s\d_-]*$/i.test(base) ? fallback : cleanTitle(fileName).slice(0, MAX_PICTURE_NAME);
}

// The words in an uploaded logo, as typed; control characters and extra spaces removed
export function logoWords(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_LOGO_WORDS);
}
