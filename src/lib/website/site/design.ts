import { z } from "zod";
import type { WebsiteCopy } from "@/lib/website/types";

// The owner's choices for the site SnapStart builds: look, which parts show, and each item's price, photo and buy link.
// Plain data, so client components and the schema can import it.

export const SITE_STYLES = ["clean", "bold", "warm"] as const;
export type SiteStyle = (typeof SITE_STYLES)[number];

export const STYLE_LABELS: Record<SiteStyle, { name: string; hint: string }> = {
  clean: { name: "Studio", hint: "Crisp editorial layout, generous space and a bold feature image" },
  bold: { name: "Statement", hint: "Dramatic dark canvas, oversized type and vivid accents" },
  warm: { name: "Atelier", hint: "Warm paper tones, elegant serif type and soft shapes" },
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
export const MAX_ITEMS = 12;
const HEX = /^#[0-9a-f]{6}$/i;

const photoRef = z.object({ photoId: z.string().min(1).max(60), versionId: z.string().min(1).max(60) });

export const siteItemSchema = z.object({
  // The item's name in the words, matched without case
  name: z.string().trim().min(1).max(80),
  // Typed by the owner; null shows no price
  priceCents: z.number().int().min(0).max(MAX_PRICE_CENTS).nullable(),
  buyUrl: z.string().trim().max(500),
  photo: photoRef.nullable(),
  hidePhoto: z.boolean().optional(),
  description: z.string().max(300).optional(),
});
export type SiteItem = z.infer<typeof siteItemSchema>;

export const themeSchema = z.object({
  name: z.string().min(1).max(60),
  rationale: z.string().max(400),
  layout: z.enum(["split", "cover", "centered"]),
  font: z.enum(["sans", "serif", "editorial"]),
  background: z.string().regex(HEX),
  foreground: z.string().regex(HEX),
  surface: z.string().regex(HEX),
  accent: z.string().regex(HEX),
  radius: z.number().int().min(0).max(40),
  titleScale: z.number().min(0.7).max(1.2),
  density: z.enum(["airy", "balanced", "compact"]).optional(),
  catalogLayout: z.enum(["grid", "list", "featured"]).optional(),
  imageShape: z.enum(["square", "portrait", "landscape"]).optional(),
  sectionOrder: z.array(z.enum(SITE_SECTIONS)).max(5).optional(),
  simulated: z.boolean().optional(),
});
export type SiteTheme = z.infer<typeof themeSchema>;

export const siteDesignSchema = z.object({
  labels: z.object({ catalog: z.string().max(60), about: z.string().max(60), order: z.string().max(60), contact: z.string().max(60) }).optional(),
  heroComposition: z.enum(["collection", "single"]).optional(),
  imagePosition: z.enum(["center", "top", "bottom"]).optional(),
  theme: themeSchema.optional(),
  heroImage: photoRef.nullable().optional(),
  style: z.enum(SITE_STYLES),
  color: z.string().regex(HEX),
  showLogo: z.boolean(),
  showHero: z.boolean(),
  hidden: z.array(z.enum(SITE_SECTIONS)).max(SITE_SECTIONS.length),
  items: z.array(siteItemSchema).max(MAX_ITEMS),
  // Buttons built from the business email and phone the owner saved
  showEmail: z.boolean(),
  showPhone: z.boolean(),
  // Saved products left off the site; the rest show under What you sell
  hiddenProducts: z.array(z.string().min(1).max(60)).max(100),
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
    hiddenProducts: [],
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
    ...(stored.heroComposition ? { heroComposition: field("heroComposition") } : {}),
    ...(stored.labels ? { labels: field("labels") } : {}),
    ...(stored.imagePosition ? { imagePosition: field("imagePosition") } : {}),
    ...(stored.theme ? { theme: field("theme") } : {}),
    ...(stored.heroImage ? { heroImage: field("heroImage") } : {}),
    style: field("style"),
    color: field("color").toLowerCase(),
    showLogo: field("showLogo"),
    showHero: field("showHero"),
    hidden: field("hidden"),
    items: field("items"),
    showEmail: field("showEmail"),
    showPhone: field("showPhone"),
    hiddenProducts: field("hiddenProducts"),
  };
}

const key = (name: string) => name.trim().toLowerCase();

export function itemFor(design: SiteDesign, name: string): SiteItem | null {
  return design.items.find((item) => key(item.name) === key(name)) ?? null;
}

// A product the owner saved on Add your products, as the site shows it
export interface SiteProduct {
  id: string;
  name: string;
  photo?: z.infer<typeof photoRef> | null;
  description: string;
  // Exactly as the owner typed it; null when it has no plain price
  priceCents: number | null;
}

// The site as it shows: the drafted words' items, then saved products that aren't already among them or turned off.
// An item with no price of its own shows its product's price.
export function withProducts(copy: WebsiteCopy, products: SiteProduct[], design: SiteDesign): { copy: WebsiteCopy; design: SiteDesign } {
  const added = products.filter(
    (product) => !design.hiddenProducts.includes(product.id) && !copy.offerings.some((offering) => key(offering.name) === key(product.name)),
  );
  const existing = copy.offerings.filter((offering) => !products.length || products.some((product) => key(product.name) === key(offering.name))).filter((offering) => !products.some((product) => key(product.name) === key(offering.name) && design.hiddenProducts.includes(product.id))).map((offering) => {
    const product = products.find((product) => key(product.name) === key(offering.name));
    return product ? { name: offering.name, description: product.description } : offering;
  });
  const room = Math.max(0, MAX_ITEMS - existing.length);
  const offerings = [...existing, ...added.slice(0, room).map((product) => ({ name: product.name, description: product.description }))];
  const items = offerings.flatMap((offering): SiteItem[] => {
    const item = itemFor(design, offering.name);
    const price = productPrice(products, offering.name);
    const photo = products.find((product) => key(product.name) === key(offering.name))?.photo ?? null;
    if (item) return [{ ...item, priceCents: item.priceCents ?? price, photo: item.hidePhoto ? null : item.photo ?? photo }];
    return price !== null || photo ? [{ name: offering.name, priceCents: price, buyUrl: "", photo }] : [];
  });
  return { copy: { ...copy, offerings: offerings.map((offering) => ({ ...offering, description: itemFor({ ...design, items }, offering.name)?.description ?? offering.description })) }, design: { ...design, items } };
}

// A saved product's price for an item with the same name
export function productPrice(products: SiteProduct[], name: string): number | null {
  return products.find((product) => key(product.name) === key(name))?.priceCents ?? null;
}

export function shows(design: SiteDesign, section: SiteSection): boolean {
  return !design.hidden.includes(section);
}

// "12", "$12.50" or "1,200" as cents; null when it isn't a plain dollar amount
export function parseDollars(input: string, max = MAX_PRICE_CENTS): number | null {
  const text = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, part = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(part.padEnd(2, "0"));
  return cents <= max ? cents : null;
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
