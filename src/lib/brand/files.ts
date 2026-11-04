import { IMAGE_SPECS, LOGO_SPECS } from "./sizes";
import type { AssetKind, BrandImageKind, VersionKind } from "./types";

// File addresses and download names, shared by pages and the file route

export const brandFileUrl = (assetId: string, view = true) => `/brand/files/${assetId}${view ? "?view=1" : ""}`;

// A logo with its plain background removed; the original when that can't be done
export const seeThroughUrl = (assetId: string, view = true) => `/brand/files/${assetId}?clear=1${view ? "&view=1" : ""}`;

export const EXTENSIONS: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg" };

export function kindTitle(kind: AssetKind): string {
  return kind in IMAGE_SPECS ? IMAGE_SPECS[kind as BrandImageKind].title : LOGO_SPECS[kind as "logo" | VersionKind].title;
}

export function brandFileName(name: string, kind: AssetKind, simulated: boolean, size?: string): string {
  return [name, kindTitle(kind).toLowerCase(), size, simulated ? "practice preview" : null].filter(Boolean).join(" - ");
}
