import { createHash } from "node:crypto";
import { cleanTitle, MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { imageInfo, type PhotoType } from "./image-info";

// What the product photo workspace accepts, checked by the file's own bytes

export const PHOTO_TYPES: PhotoType[] = ["image/png", "image/jpeg", "image/webp"];
// Shorter sides than this can't show a product's details faithfully
export const MIN_PHOTO_SIDE = 300;
export const MAX_PHOTO_NAME = 80;

export type PhotoUploadCheck =
  | { ok: true; type: PhotoType; width: number; height: number; sha256: string; title: string }
  | { ok: false; message: string };

export function checkPhotoUpload(bytes: Uint8Array, fileName: string, name = ""): PhotoUploadCheck {
  if (bytes.byteLength === 0) return { ok: false, message: "That file is empty. Choose the photo again." };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "That photo is over 4 MB. Choose it again on this page and it will be made smaller for you." };
  }
  const info = imageInfo(bytes);
  if (!info) return { ok: false, message: "That isn’t a photo SnapStart can use. Try a JPEG, PNG or WebP photo." };
  // The page turns photos upright before upload; a file still marked as turned didn't come through it
  if (info.orientation !== null && info.orientation !== 1) {
    return { ok: false, message: "This photo needs turning the right way up. Choose it again on this page." };
  }
  if (Math.min(info.width, info.height) < MIN_PHOTO_SIDE) {
    return {
      ok: false,
      message: `This photo is too small (${info.width} × ${info.height} pixels) to show your product’s details. Use the original photo from your phone, not a thumbnail or screenshot.`,
    };
  }
  return {
    ok: true,
    type: info.type,
    width: info.width,
    height: info.height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    title: photoTitle(name, fileName),
  };
}

// The owner's name for it, else the file name; camera files are often just "image"
export function photoTitle(name: string, fileName: string): string {
  const typed = name.replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_PHOTO_NAME);
  if (typed) return typed;
  const base = fileName.split(/[\\/]/).pop()?.replace(/\.[a-z0-9]{1,5}$/i, "").trim() ?? "";
  return !base || /^(image|photo|img|dsc|pxl)[\s\d_-]*$/i.test(base) ? "Product photo" : cleanTitle(fileName);
}
