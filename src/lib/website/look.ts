import { seeThroughUrl } from "@/lib/brand/files";
import type { BrandFile, BrandKit } from "@/lib/brand/types";

// How the site preview looks: the owner's brand kit when they have one, the app's theme otherwise
export interface SiteLook {
  primary: string;
  // Text on the primary color: white or near-black, whichever reads better
  onPrimary: string;
  background: string;
  logoUrl: string | null;
  heroUrl: string | null;
  // Brand files that are practice previews, not made by the AI service
  practice: boolean;
}

export const DEFAULT_LOOK: SiteLook = { primary: "#1e6b52", onPrimary: "#ffffff", background: "#f6f5f1", logoUrl: null, heroUrl: null, practice: false };

const HEX = /^#[0-9a-f]{6}$/i;

export function lookFromBrand(brand: BrandKit | null): SiteLook {
  if (!brand) return DEFAULT_LOOK;
  const primary = brand.colors.find((color) => HEX.test(color.hex))?.hex ?? DEFAULT_LOOK.primary;
  return {
    primary,
    onPrimary: textOn(primary),
    background: DEFAULT_LOOK.background,
    logoUrl: siteLogo(brand.logos.primary)?.url ?? null,
    heroUrl: brand.images.websiteHero?.url ?? null,
    practice: brand.simulated,
  };
}

// WCAG relative luminance
function luminance(hex: string): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [1, 3, 5].map((at) => channel(parseInt(hex.slice(at, at + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// White text needs at least 4.5:1 contrast
export function textOn(hex: string): string {
  return contrast(hex, "#ffffff") >= 4.5 ? "#ffffff" : "#1c2321";
}

// Brand file links look like /brand/files/{id}?view=1 (brandFileUrl)
export function brandAssetId(file: BrandFile | null): string | null {
  return file?.url.match(/^\/brand\/files\/([^/?#]+)/)?.[1] ?? null;
}

// Websites show the main logo see-through, so it sits on any background
export function siteLogo(file: BrandFile | null): BrandFile | null {
  const id = brandAssetId(file);
  return file && id ? { ...file, url: seeThroughUrl(id) } : file;
}
