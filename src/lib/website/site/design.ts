import { z } from "zod";

// The owner's choices for the site First Sale builds: look, which parts show, and each item's price, photo and buy link.
// Plain data, so client components and the schema can import it.

export const SITE_STYLES = ["clean", "bold", "warm"] as const;
export type SiteStyle = (typeof SITE_STYLES)[number];

export const STYLE_LABELS: Record<SiteStyle, { name: string; hint: string }> = {
  clean: { name: "Clean", hint: "White page, your color on buttons and headings" },
  bold: { name: "Bold", hint: "A wide band of your color across the top" },
  warm: { name: "Warm", hint: "Cream page, rounded corners and classic headings" },
};

export const SITE_SECTIONS = ["offerings", "about", "howToBuy", "faq", "contact"] as const;
export type SiteSection = (typeof SITE_SECTIONS)[number];

export const SECTION_LABELS: Record<SiteSection, string> = {
  offerings: "What you sell",
  about: "About",
  howToBuy: "How to order",
  faq: "Questions",
  contact: "Contact",
};

export const MAX_PRICE_CENTS = 10_000_000;
const HEX = /^#[0-9a-f]{6}$/i;

const photoRef = z.object({ photoId: z.string().min(1).max(60), versionId: z.string().min(1).max(60) });

export const siteItemSchema = z.object({
  // The item's name in the words, matched without case
  name: z.string().trim().min(1).max(80),
  // Typed by the owner; null shows no price
  priceCents: z.number().int().min(0).max(MAX_PRICE_CENTS).nullable(),
  buyUrl: z.string().trim().max(500),
  photo: photoRef.nullable(),
});
export type SiteItem = z.infer<typeof siteItemSchema>;

export const siteDesignSchema = z.object({
  style: z.enum(SITE_STYLES),
  color: z.string().regex(HEX),
  showLogo: z.boolean(),
  showHero: z.boolean(),
  hidden: z.array(z.enum(SITE_SECTIONS)).max(SITE_SECTIONS.length),
  items: z.array(siteItemSchema).max(12),
  // Buttons built from the business email and phone the owner saved
  showEmail: z.boolean(),
  showPhone: z.boolean(),
});
export type SiteDesign = z.infer<typeof siteDesignSchema>;

export function defaultDesign(color: string): SiteDesign {
  return {
    style: "clean",
    color: HEX.test(color) ? color.toLowerCase() : "#1e6b52",
    showLogo: true,
    showHero: true,
    hidden: [],
    items: [],
    showEmail: true,
    showPhone: true,
  };
}

// Saved designs from an older shape still read, field by field
export function readDesign(raw: unknown, color: string): SiteDesign {
  const base = defaultDesign(color);
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const field = <K extends keyof SiteDesign>(key: K): SiteDesign[K] => {
    const parsed = siteDesignSchema.shape[key].safeParse(stored[key]);
    return parsed.success ? (parsed.data as SiteDesign[K]) : base[key];
  };
  return {
    style: field("style"),
    color: field("color").toLowerCase(),
    showLogo: field("showLogo"),
    showHero: field("showHero"),
    hidden: field("hidden"),
    items: field("items"),
    showEmail: field("showEmail"),
    showPhone: field("showPhone"),
  };
}

const key = (name: string) => name.trim().toLowerCase();

export function itemFor(design: SiteDesign, name: string): SiteItem | null {
  return design.items.find((item) => key(item.name) === key(name)) ?? null;
}

export function shows(design: SiteDesign, section: SiteSection): boolean {
  return !design.hidden.includes(section);
}

// "12", "$12.50" or "1,200" as cents; null when it isn't a plain dollar amount
export function parseDollars(input: string): number | null {
  const text = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, part = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(part.padEnd(2, "0"));
  return cents <= MAX_PRICE_CENTS ? cents : null;
}

export function dollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 });
}

// Card checkouts owners can make in their own dashboard without code
const PAYMENT_HOSTS = ["buy.stripe.com", "square.link", "checkout.square.site", "www.paypal.com", "paypal.me"];

// Rules for a buy link: https only, no sign-in details, a real host
// Runs in the browser too, where URL.parse is newer than some supported versions
function parse(url: string): URL | null {
  try {
    return new URL(url.trim());
  } catch {
    return null;
  }
}

export function buyLinkProblem(url: string): string | null {
  if (!url.trim()) return null;
  const parsed = parse(url);
  if (!parsed || parsed.protocol !== "https:") return "Buy links must start with https://.";
  if (parsed.username || parsed.password) return "Buy links can’t include a user name or password.";
  if (!parsed.hostname.includes(".")) return "That doesn’t look like a web address.";
  return null;
}

export function isKnownPaymentLink(url: string): boolean {
  const host = parse(url)?.hostname.toLowerCase() ?? "";
  return PAYMENT_HOSTS.includes(host);
}
