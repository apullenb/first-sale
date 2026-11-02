import type { BusinessProfile } from "@/lib/domain";
import { categoryFor, examplesFor } from "@/lib/intake/catalog";
import { type ItemKind, PRODUCT_LIMITS } from "@/lib/rules/products";

// From intake answers: whether the business sells products, services or both, and which items to suggest.
// Browser-safe plain data; names only, never prices.

export type SellsWhat = { products: boolean; services: boolean };
type Profile = Pick<BusinessProfile, "category" | "offeringKinds" | "productTags" | "firstItems">;

export const MAX_SUGGESTIONS = 8;
const PRODUCT_OFFERINGS = ["food", "handmade", "resale"] as const;

export function sellsWhat(profile: Profile, items: readonly { kind: ItemKind }[] = []): SellsWhat {
  const kind = categoryFor(profile.category)?.kind ?? null;
  const services = kind === "services" || profile.offeringKinds.includes("services") || items.some((item) => item.kind === "service");
  const products =
    (kind !== null && kind !== "services" && kind !== "other") ||
    profile.offeringKinds.some((each) => (PRODUCT_OFFERINGS as readonly string[]).includes(each)) ||
    items.some((item) => item.kind === "product");
  // Nothing says either way: start with products
  return { products: products || !services, services };
}

// The kind an answer most likely names: the business kind decides when it sells both
export function likelyKind(profile: Profile): ItemKind {
  const kind = categoryFor(profile.category)?.kind ?? null;
  if (kind === "services") return "service";
  if (kind && kind !== "other") return "product";
  const what = sellsWhat(profile);
  return what.services && !what.products ? "service" : "product";
}

export interface SuggestedItem {
  name: string;
  kind: ItemKind;
  // Owner-facing: which answer it came from
  from: "first_items" | "examples";
}

const key = (text: string) => text.trim().toLowerCase();
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const words = (text: string) => key(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
// "Candles" is already covered by "Hand-poured soy candles"
const covered = (label: string, by: string) => {
  const inner = words(label);
  const outer = new Set(words(by));
  return inner.length > 0 && inner.every((word) => outer.has(word) || outer.has(`${word}s`) || outer.has(word.replace(/s$/, "")));
};

// The owner's own first items, then the examples they picked, skipping anything already listed
export function suggestedItems(profile: Profile, existing: readonly { name: string }[] = []): SuggestedItem[] {
  const kind = likelyKind(profile);
  const taken = existing.map((item) => item.name);
  const out: SuggestedItem[] = [];
  const add = (raw: string, from: SuggestedItem["from"]) => {
    const name = upperFirst(raw.replace(/\s+/g, " ").trim().replace(/[.!]+$/, "")).slice(0, PRODUCT_LIMITS.name);
    if (name.length < 2 || out.length >= MAX_SUGGESTIONS) return;
    if ([...taken, ...out.map((item) => item.name)].some((other) => key(other) === key(name) || (from === "examples" && covered(name, other)))) return;
    out.push({ name, kind, from });
  };
  for (const item of profile.firstItems.split(/[,;\n]/)) add(item, "first_items");
  for (const example of examplesFor(profile.category, profile.productTags)) add(example.label, "examples");
  return out;
}

// The step's name in the menu and on its page: "Add" until something is confirmed, then "Manage"
export function itemsStepTitle(what: SellsWhat, managing: boolean): string {
  const verb = managing ? "Manage" : "Add";
  if (what.products && what.services) return `${verb} what you sell`;
  return `${verb} your ${what.services ? "services" : "products"}`;
}
