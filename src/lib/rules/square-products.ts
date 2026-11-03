import { z } from "zod";
import { PRODUCT_LIMITS, OPTION_LIMITS, NO_OPTIONS, type ItemOptions } from "./products";
import { descriptionUpdate, originalDescription } from "./square-description";
import type { SquareItem } from "@/lib/square/client";

export interface SyncProduct {
  name: string;
  description: string;
  descriptionBy: string;
  status: string;
  priceCents: number | null;
  kind: "product" | "service";
  options: ItemOptions;
}
const money = z.object({ amount: z.number().int().min(0).max(10_000_000), currency: z.literal("USD") });
export const variationSchema = z.object({ id: z.string(), item_variation_data: z.object({ name: z.string(), pricing_type: z.literal("FIXED_PRICING"), price_money: money }).passthrough() }).passthrough();
const variantLabel = (values: string[]) => values.join(" / ");

export function syncFingerprint(product: SyncProduct): string {
  return JSON.stringify({ name: product.name, description: product.description, kind: product.kind, priceCents: product.priceCents,
    options: { groups: product.options.groups, variants: product.options.variants.map(({ values, priceCents }) => ({ values, priceCents })) } });
}

export function importSquareProduct(item: SquareItem): SyncProduct {
  const name = item.item_data.name;
  const description = originalDescription(item);
  if (name.length > PRODUCT_LIMITS.name || description.length > PRODUCT_LIMITS.description) throw new Error("Name or description exceeds the product library’s size limits.");
  const variations = z.array(variationSchema).min(1).max(OPTION_LIMITS.values).parse(item.item_data.variations);
  if (variations.some((variant) => variant.item_variation_data.name.length > OPTION_LIMITS.label)) throw new Error("An option name is too long for the product library.");
  const labels = variations.map((variant) => variant.item_variation_data.name);
  if (new Set(labels).size !== labels.length) throw new Error("Options have duplicate names.");
  return { name, description, descriptionBy: "owner", status: "confirmed", kind: item.item_data.product_type === "APPOINTMENTS_SERVICE" ? "service" : "product",
    priceCents: variations.length === 1 ? variations[0].item_variation_data.price_money.amount : null,
    options: variations.length === 1 ? NO_OPTIONS : { groups: [{ name: "Option", values: labels }], variants: variations.map((variant) => ({ values: [variant.item_variation_data.name], priceCents: variant.item_variation_data.price_money.amount, quantity: null })) } };
}

export function squareProductObject(product: SyncProduct, id: string, remote: SquareItem | null): SquareItem {
  if (product.status !== "confirmed" || product.descriptionBy === "practice") throw new Error("Confirm the product and replace practice descriptions before publishing.");
  if (!product.name.trim() || /[<>]/.test(product.name) || /[<>]/.test(product.description)) throw new Error("Use a product name and plain-text description without markup.");
  const variants = product.options.variants.length ? product.options.variants : [{ values: ["Regular"], priceCents: product.priceCents, quantity: null }];
  const existing = remote ? z.array(variationSchema).parse(remote.item_data.variations) : [];
  if (remote && (existing.length !== variants.length || (variants.length > 1 && variants.some((variant, i) => variantLabel(variant.values) !== existing[i].item_variation_data.name)))) {
    throw new Error("Options changed. Update option structure in Square, then get its latest version here before changing prices.");
  }
  const variations = variants.map((variant, index) => {
    const price = money.parse({ amount: variant.priceCents ?? product.priceCents, currency: "USD" });
    const prior = existing[index];
    return { ...(prior ?? { id: `#variation-${index}`, type: "ITEM_VARIATION" }), item_variation_data: {
      ...(prior?.item_variation_data ?? {}), item_id: remote?.id ?? `#${id}`, name: prior?.item_variation_data.name ?? variantLabel(variant.values), pricing_type: "FIXED_PRICING", price_money: price,
    } };
  });
  const base: SquareItem = remote ?? { id: `#${id}`, type: "ITEM", version: 0, item_data: { name: product.name } };
  const remoteKind = remote?.item_data.product_type === "APPOINTMENTS_SERVICE" ? "service" : "product";
  if (remote && product.kind !== remoteKind) throw new Error("Change the product or service type in Square first, then pull its latest version.");
  const updated = descriptionUpdate(base, product.description);
  return { ...updated, item_data: { ...updated.item_data, name: product.name, ...(remote ? {} : { product_type: product.kind === "service" ? "APPOINTMENTS_SERVICE" : "REGULAR" }), variations } };
}

export interface ProductSyncStatus {
  origin: "imported" | "published";
  linked: boolean;
  dirty: boolean;
  pending: boolean;
  accountMatches: boolean;
  importedAt: string | null;
  publishedAt: string | null;
  pushedAt: string | null;
}
