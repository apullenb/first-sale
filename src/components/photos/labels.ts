import { CROPS, LOOKS } from "@/lib/photos/looks";
import type { PhotoCrop, PhotoLook } from "@/lib/photos/types";

export const originalSrc = (photoId: string, view = true) => `/photos/${photoId}/file${view ? "?view=1" : ""}`;
export const versionSrc = (photoId: string, versionId: string, view = true) =>
  `/photos/${photoId}/versions/${versionId}/file${view ? "?view=1" : ""}`;

export function versionLabel(version: { number: number; look: PhotoLook; crop: PhotoCrop }): string {
  return `Version ${version.number} · ${LOOKS[version.look].label} · ${CROPS[version.crop].label}`;
}

export function fileFacts(file: { width: number; height: number; mimeType: string }): string {
  const kind = { "image/png": "PNG", "image/jpeg": "JPEG", "image/webp": "WebP" }[file.mimeType] ?? "image";
  return `${file.width} × ${file.height} pixels, ${kind}`;
}
