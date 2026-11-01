import type { BusinessCategory, BusinessProfile } from "@/lib/domain";
import { examplesFor } from "@/lib/intake/catalog";

// What this business is and what it sells, in its own words, so drafts don't fall back on category words.
// Browser-safe: plain data in, plain text out.

const KIND_NOUNS: Record<BusinessCategory, string | null> = {
  baked_goods: "bakery",
  packaged_food: "small-batch food maker",
  prepared_food: "meal and catering kitchen",
  woodworking: "woodshop",
  crafts: "craft studio",
  clothing_boutique: "clothing boutique",
  resale_shop: "shop",
  personal_care: "beauty and personal care business",
  home_services: "home and pet services business",
  lessons_care: "lessons and care business",
  creative_services: "creative services studio",
  other: null,
};

export interface Specifics {
  // Such as "home bakery"; null when the owner's answers don't say
  kind: string | null;
  // Products first, then the owner's first items, then the examples they picked
  items: string[];
}

export const MAX_SPECIFIC_ITEMS = 8;

const key = (text: string) => text.trim().toLowerCase();

export function businessKind(profile: Pick<BusinessProfile, "category" | "premises">): string | null {
  const noun = profile.category ? KIND_NOUNS[profile.category] : null;
  if (!noun) return null;
  return noun === "bakery" && profile.premises === "home" ? "home bakery" : noun;
}

export function businessSpecifics(
  profile: Pick<BusinessProfile, "category" | "premises" | "productTags" | "firstItems">,
  products: readonly { name: string }[] = [],
): Specifics {
  const seen = new Set<string>();
  const items: string[] = [];
  const add = (text: string) => {
    const clean = text.trim();
    if (!clean || seen.has(key(clean)) || items.length >= MAX_SPECIFIC_ITEMS) return;
    seen.add(key(clean));
    items.push(clean);
  };
  for (const product of products) add(product.name);
  for (const item of profile.firstItems.split(/[,;\n]/)) add(item);
  for (const example of examplesFor(profile.category, profile.productTags)) add(lowerFirst(example.label));
  return { kind: businessKind(profile), items };
}

// "cookies, bread and rolls"
export function itemsPhrase(specifics: Specifics, max = 3): string {
  const list = specifics.items.slice(0, max).map(lowerFirst);
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

// "Home bakery: cookies, bread and rolls"
export function specificsSummary(specifics: Specifics): string {
  const items = itemsPhrase(specifics, 4);
  if (specifics.kind && items) return `${upperFirst(specifics.kind)}: ${items}`;
  return upperFirst(specifics.kind ?? items);
}

// Category words that say nothing about this business
const GENERIC = [
  "food you make",
  "goods you make",
  "things you make",
  "products you make",
  "handmade goods",
  "handmade food",
  "homemade food",
  "home-made food",
  "fresh food",
  "delicious food",
  "tasty food",
  "quality food",
  "good food",
  "food items",
  "food products",
  "goods you buy to resell",
];
const GENERIC_PATTERN = new RegExp(`(?<![\\p{L}-])(?:${GENERIC.join("|")})(?![\\p{L}-])`, "giu");

export function genericWords(text: string): string[] {
  return [...new Set([...text.matchAll(GENERIC_PATTERN)].map((match) => match[0].toLowerCase()))];
}

// Swaps category words for what this business sells; unchanged when there are no specifics
export function withSpecifics(text: string, specifics: Specifics): string {
  const items = itemsPhrase(specifics);
  if (!items) return text;
  return text.replace(GENERIC_PATTERN, (match, offset: number) => {
    const sentenceStart = offset === 0 || /[.!?]\s*$/.test(text.slice(0, offset));
    return sentenceStart || /^[A-Z]/.test(match) ? upperFirst(items) : items;
  });
}

// Plain words a prompt rule can quote
export const GENERIC_EXAMPLES = "“food you make”, “handmade goods” or “fresh food”";

const lowerFirst = (text: string) => (/^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text);
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
