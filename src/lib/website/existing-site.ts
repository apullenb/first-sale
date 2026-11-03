import type { ExistingSite, ExistingPlatform } from "./types";

// A site the owner already has. Connecting is a demo: only the platform and address are kept.

export const EXISTING_LABELS: Record<ExistingPlatform, string> = {
  square: "Square",
  wix: "Wix",
  shopify: "Shopify",
  other: "Another builder",
};

// Runs in the browser too, where URL.parse is newer than some supported versions
function parse(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

// The address as a plain web link, adding https:// when it's left off; null when it isn't one
export function siteAddress(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const url = parse(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (!url || !["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
  // A real host has a dot, like risebakery.com
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) return null;
  return url.toString().replace(/\/$/, "");
}

export function hasSquareSite(existing: ExistingSite | null | undefined, marked?: { note: string | null } | null): boolean {
  return existing ? existing.platform === "square" : marked?.note === "Built with Square";
}
