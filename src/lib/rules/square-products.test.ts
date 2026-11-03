import { describe, expect, it } from "vitest";
import { importSquareProduct, squareProductObject, syncFingerprint } from "./square-products";
import { productValues } from "@/lib/products/test-values";
import type { SquareItem } from "@/lib/square/client";

const item: SquareItem = { id: "I", type: "ITEM", version: 1, item_data: { name: "Candle", description_plaintext: "Soy candle", variations: [
  { id: "SMALL", type: "ITEM_VARIATION", item_variation_data: { name: "Small", pricing_type: "FIXED_PRICING", price_money: { amount: 1000, currency: "USD" } } },
  { id: "LARGE", type: "ITEM_VARIATION", item_variation_data: { name: "Large", pricing_type: "FIXED_PRICING", price_money: { amount: 1800, currency: "USD" } } },
] } };
describe("Square product mappings", () => {
  it("imports options and changes only the prices of their matching variations", () => {
    const product = importSquareProduct(item);
    expect(product.options.groups).toEqual([{ name: "Option", values: ["Small", "Large"] }]);
    product.options.variants[1].priceCents = 1900;
    const result = squareProductObject(product, "local", item);
    expect(result.item_data.variations).toMatchObject([{ id: "SMALL", item_variation_data: { price_money: { amount: 1000 } } }, { id: "LARGE", item_variation_data: { price_money: { amount: 1900 } } }]);
  });
  it("refuses unsupported currencies and changed option structures", () => {
    const changed = structuredClone(item);
    (changed.item_data.variations as { item_variation_data: { price_money: { currency: string } } }[])[0].item_variation_data.price_money.currency = "CAD";
    expect(() => importSquareProduct(changed)).toThrow();
    const product = importSquareProduct(item);
    product.options.variants.reverse();
    expect(() => squareProductObject(product, "local", item)).toThrow("Options changed");
  });
  it("tracks selling fields while excluding costs, photos and stock", () => {
    const product = productValues();
    expect(syncFingerprint({ ...product, quantity: 500, unitCostCents: 1 } as typeof product)).toBe(syncFingerprint(product));
    expect(syncFingerprint({ ...product, description: "New words" })).not.toBe(syncFingerprint(product));
    expect(syncFingerprint({ ...product, priceCents: 1100 })).not.toBe(syncFingerprint(product));
  });
  it("requires a saved price and never derives one from prose", () => {
    expect(() => squareProductObject(productValues({ priceCents: null }), "local", null)).toThrow();
    const created = squareProductObject(productValues({ priceCents: 1234 }), "local", null);
    expect(created.item_data.variations).toMatchObject([{ item_variation_data: { price_money: { amount: 1234, currency: "USD" } } }]);
  });
});
