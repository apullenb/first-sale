import { z } from "zod";
import { dollars, parseDollars } from "@/lib/website/site/design";

// Plain rules for what the owner sells: products and services, their options, and money only as the owner typed it

export const PRODUCT_LIMITS = { products: 100, name: 80, description: 300, quantity: 1_000_000, priceText: 60, detail: 120, included: 300 } as const;
export const OPTION_LIMITS = { groups: 3, values: 20, label: 30, variants: 100 } as const;

export const ITEM_KINDS = ["product", "service"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
// Suggested items aren't used anywhere public until the owner confirms them
export const ITEM_STATUSES = ["suggested", "confirmed"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
// Who wrote the description: the owner, AI, or practice mode's stand-in
export const DESCRIPTION_AUTHORS = ["owner", "ai", "practice"] as const;
export type DescriptionAuthor = (typeof DESCRIPTION_AUTHORS)[number];
// Where a suggestion came from
export const ITEM_ORIGINS = ["owner", "answers", "photo"] as const;
export type ItemOrigin = (typeof ITEM_ORIGINS)[number];

// Which picture an item shows: a product photo's original, an approved edit, a Brand Library picture, or an approved generated picture
export const productPhotoRefSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("original"), photoId: z.string().min(1).max(60) }),
  z.object({ source: z.literal("version"), photoId: z.string().min(1).max(60), versionId: z.string().min(1).max(60) }),
  z.object({ source: z.literal("library"), fileId: z.string().min(1).max(60) }),
  z.object({ source: z.literal("generated"), pictureId: z.string().min(1).max(60) }),
]);
export type ProductPhotoRef = z.infer<typeof productPhotoRefSchema>;

export interface OptionGroup {
  // Such as "Size" or "Scent"
  name: string;
  values: string[];
}

// One combination of option values, one per group, in group order
export interface Variant {
  values: string[];
  // Null: the item's own price
  priceCents: number | null;
  // Null: not counted
  quantity: number | null;
}

export interface ItemOptions {
  groups: OptionGroup[];
  variants: Variant[];
}

export const NO_OPTIONS: ItemOptions = { groups: [], variants: [] };

export interface ProductValues {
  kind: ItemKind;
  status: ItemStatus;
  origin: ItemOrigin;
  name: string;
  description: string;
  descriptionBy: DescriptionAuthor;
  priceCents: number | null;
  // Services: how it's priced, exactly as typed ("$40 an hour", "From $120")
  priceText: string;
  unitCostCents: number | null;
  quantity: number | null;
  // Services only
  duration: string;
  location: string;
  included: string;
  options: ItemOptions;
  photo: ProductPhotoRef | null;
}

export interface VariantForm {
  values: string[];
  price: string;
  quantity: string;
}

// What the form sends: text as typed
export interface ProductForm {
  kind: ItemKind;
  name: string;
  description: string;
  price: string;
  unitCost: string;
  quantity: string;
  duration: string;
  location: string;
  included: string;
  groups: OptionGroup[];
  variants: VariantForm[];
  photo: ProductPhotoRef | null;
}

export type FormField = keyof ProductForm;
// Values the owner sets; the action adds status, origin and who wrote the description
export type CheckedForm = Omit<ProductValues, "status" | "origin" | "descriptionBy">;
export type ProductCheck = { ok: true; value: CheckedForm } | { ok: false; field: FormField; message: string };

const tidy = (text: string, max: number) =>
  text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const variantKey = (values: readonly string[]) => values.map((value) => value.toLowerCase()).join("\u0001");

function wholeNumber(text: string): number | null | "bad" {
  const clean = text.trim().replace(/,/g, "");
  if (!clean) return null;
  if (!/^\d{1,7}$/.test(clean) || Number(clean) > PRODUCT_LIMITS.quantity) return "bad";
  return Number(clean);
}

// Tidied groups: blank values dropped, repeats removed; an error names the first problem
export function checkGroups(groups: readonly OptionGroup[]): { ok: true; groups: OptionGroup[] } | { ok: false; message: string } {
  const kept: OptionGroup[] = [];
  for (const group of groups) {
    const name = tidy(group.name, OPTION_LIMITS.label);
    const seen = new Set<string>();
    const values: string[] = [];
    for (const raw of group.values) {
      const value = tidy(raw, OPTION_LIMITS.label);
      if (!value || seen.has(value.toLowerCase())) continue;
      seen.add(value.toLowerCase());
      values.push(value);
    }
    if (!name && !values.length) continue;
    if (!name) return { ok: false, message: "Give each option a name, such as Size or Color." };
    if (!values.length) return { ok: false, message: `Add at least one choice for ${name}, such as Small, Medium and Large.` };
    if (values.length > OPTION_LIMITS.values) return { ok: false, message: `${name} can have up to ${OPTION_LIMITS.values} choices.` };
    if (kept.some((each) => each.name.toLowerCase() === name.toLowerCase())) return { ok: false, message: `There are two options called ${name}. Give each its own name.` };
    kept.push({ name, values });
  }
  if (kept.length > OPTION_LIMITS.groups) return { ok: false, message: `An item can have up to ${OPTION_LIMITS.groups} options.` };
  if (combinationCount(kept) > OPTION_LIMITS.variants) {
    return { ok: false, message: `Those options make more than ${OPTION_LIMITS.variants} combinations. Use fewer choices.` };
  }
  return { ok: true, groups: kept };
}

export function combinationCount(groups: readonly OptionGroup[]): number {
  return groups.length ? groups.reduce((total, group) => total * group.values.length, 1) : 0;
}

// Every combination of values, in group order
export function combinations(groups: readonly OptionGroup[]): string[][] {
  if (!groups.length) return [];
  return groups.reduce<string[][]>((rows, group) => rows.flatMap((row) => group.values.map((value) => [...row, value])), [[]]);
}

// One form row per combination, keeping what was typed for combinations that still exist
export function variantRows<T extends { values: string[] }>(groups: readonly OptionGroup[], previous: readonly T[], blank: (values: string[]) => T): T[] {
  const byKey = new Map(previous.map((row) => [variantKey(row.values), row]));
  return combinations(groups).map((values) => {
    const found = byKey.get(variantKey(values));
    return found ? { ...found, values } : blank(values);
  });
}

export function variantLabel(values: readonly string[]): string {
  return values.join(" / ");
}

export function checkProduct(form: ProductForm, confirming: boolean): ProductCheck {
  const service = form.kind === "service";
  const name = tidy(form.name, PRODUCT_LIMITS.name);
  if (!name) return { ok: false, field: "name", message: service ? "Give the service a name." : "Give the product a name." };

  const groups = checkGroups(form.groups);
  if (!groups.ok) return { ok: false, field: "groups", message: groups.message };
  const typed = new Map(form.variants.map((row) => [variantKey(row.values.map((value) => tidy(value, OPTION_LIMITS.label))), row]));
  const variants: Variant[] = [];
  for (const values of combinations(groups.groups)) {
    const row = typed.get(variantKey(values));
    let priceCents: number | null = null;
    if (row?.price.trim()) {
      priceCents = parseDollars(row.price);
      if (priceCents === null) return { ok: false, field: "variants", message: `Type the price for ${variantLabel(values)} as dollars and cents, or leave it empty.` };
    }
    const quantity = service ? null : wholeNumber(row?.quantity ?? "");
    if (quantity === "bad") return { ok: false, field: "variants", message: `Type how many ${variantLabel(values)} you have as a whole number, or leave it empty.` };
    variants.push({ values, priceCents, quantity });
  }

  // Services: the price as typed; a plain amount is also kept in cents
  const priceText = service ? tidy(form.price, PRODUCT_LIMITS.priceText) : "";
  let priceCents: number | null = null;
  if (service) {
    priceCents = priceText ? parseDollars(priceText) : null;
  } else if (form.price.trim()) {
    priceCents = parseDollars(form.price);
    if (priceCents === null) return { ok: false, field: "price", message: "Type the price as dollars and cents, such as 12 or 12.50." };
  } else if (confirming && !(variants.length && variants.every((variant) => variant.priceCents !== null))) {
    return { ok: false, field: "price", message: "Type the price as dollars and cents, such as 12 or 12.50." };
  }

  let unitCostCents: number | null = null;
  if (!service && form.unitCost.trim()) {
    unitCostCents = parseDollars(form.unitCost);
    if (unitCostCents === null) return { ok: false, field: "unitCost", message: "Type what one costs you as dollars and cents, or leave it empty." };
  }
  const quantity = service ? null : wholeNumber(form.quantity);
  if (quantity === "bad") return { ok: false, field: "quantity", message: "Type how many you have as a whole number, or leave it empty." };

  const options = { groups: groups.groups, variants };
  return {
    ok: true,
    value: {
      kind: form.kind,
      name,
      description: tidy(form.description, PRODUCT_LIMITS.description),
      priceCents,
      priceText,
      unitCostCents,
      quantity: service ? null : stockOf(quantity, options),
      duration: service ? tidy(form.duration, PRODUCT_LIMITS.detail) : "",
      location: service ? tidy(form.location, PRODUCT_LIMITS.detail) : "",
      included: service ? tidy(form.included, PRODUCT_LIMITS.included) : "",
      options,
      photo: form.photo,
    },
  };
}

// Counted per option when any option is counted; otherwise the item's own count
export function stockOf(quantity: number | null, options: ItemOptions): number | null {
  const counted = options.variants.filter((variant) => variant.quantity !== null);
  if (!counted.length) return quantity;
  return counted.reduce((total, variant) => total + (variant.quantity ?? 0), 0);
}

export function tracksVariantStock(options: ItemOptions): boolean {
  return options.variants.some((variant) => variant.quantity !== null);
}

// Lowest and highest price a customer can pay; an option without its own price uses the item's
export function priceRange(item: Pick<ProductValues, "priceCents" | "options">): { minCents: number; maxCents: number } | null {
  const prices = item.options.variants.length ? item.options.variants.map((variant) => variant.priceCents ?? item.priceCents) : [item.priceCents];
  const known = prices.filter((cents): cents is number => cents !== null);
  if (!known.length) return null;
  return { minCents: Math.min(...known), maxCents: Math.max(...known) };
}

// The price as customers see it: dollar amounts from rules, a service's own words otherwise
export function priceLabel(item: Pick<ProductValues, "kind" | "priceCents" | "priceText" | "options">): string {
  const variantPriced = item.options.variants.some((variant) => variant.priceCents !== null);
  if (item.kind === "service" && item.priceText && !variantPriced) return item.priceText;
  const range = priceRange(item);
  if (!range) return item.kind === "service" ? item.priceText : "";
  return range.minCents === range.maxCents ? dollars(range.minCents) : `${dollars(range.minCents)}–${dollars(range.maxCents)}`;
}

// "Size: Small, Large · Scent: Cedar, Lavender"
export function optionsSummary(options: ItemOptions): string {
  return options.groups.map((group) => `${group.name}: ${group.values.join(", ")}`).join(" · ");
}

// What's left from each sale before the owner's time and other costs; null without a unit cost
export function marginOf(priceCents: number, unitCostCents: number | null): { cents: number; percent: number | null } | null {
  if (unitCostCents === null) return null;
  const cents = priceCents - unitCostCents;
  return { cents, percent: priceCents > 0 ? Math.round((cents / priceCents) * 100) : null };
}

const money = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(cents % 100 ? 2 : 0));

// Back into the form's text, so editing shows what was saved
export function formOf(item: ProductValues): ProductForm {
  return {
    kind: item.kind,
    name: item.name,
    description: item.description,
    price: item.kind === "service" ? item.priceText : money(item.priceCents),
    unitCost: money(item.unitCostCents),
    // With counted options, the total is worked out from them
    quantity: item.quantity === null || tracksVariantStock(item.options) ? "" : String(item.quantity),
    duration: item.duration,
    location: item.location,
    included: item.included,
    groups: item.options.groups.map((group) => ({ name: group.name, values: [...group.values] })),
    variants: item.options.variants.map((variant) => ({ values: [...variant.values], price: money(variant.priceCents), quantity: variant.quantity === null ? "" : String(variant.quantity) })),
    photo: item.photo,
  };
}

// Saved options from older rows or the database, read safely
export function readOptions(value: unknown): ItemOptions {
  const parsed = itemOptionsSchema.safeParse(value);
  return parsed.success ? parsed.data : NO_OPTIONS;
}

export const itemOptionsSchema = z.object({
  groups: z.array(z.object({ name: z.string().max(OPTION_LIMITS.label), values: z.array(z.string().max(OPTION_LIMITS.label)).max(OPTION_LIMITS.values) })).max(OPTION_LIMITS.groups),
  variants: z
    .array(z.object({ values: z.array(z.string().max(OPTION_LIMITS.label)).max(OPTION_LIMITS.groups), priceCents: z.number().int().min(0).nullable(), quantity: z.number().int().min(0).nullable() }))
    .max(OPTION_LIMITS.variants),
});

export { dollars };
