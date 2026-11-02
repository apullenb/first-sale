import { describe, expect, it } from "vitest";
import { descriptionProblems, descriptionUpdate } from "./square-description";
import type { SquareItem } from "@/lib/square/client";

const item: SquareItem = { id: "CANDLE", type: "ITEM", version: 123, item_data: { name: "Lavender candle", description_plaintext: "Handmade soy candle with lavender.", description_html: "<p>Handmade soy candle with lavender.</p>", variations: [{ id: "V", type: "ITEM_VARIATION", item_variation_data: { price_money: { amount: 1200, currency: "USD" } } }], image_ids: ["PHOTO"], tax_ids: ["TAX"] } };
describe("Square description rules", () => {
  it("allows a rewrite using the existing facts", () => {
    expect(descriptionProblems("Discover our handmade lavender soy candle.", item)).toEqual([]);
  });
  it("blocks unsupported ingredients, amounts and markup", () => {
    for (const text of ["Organic lavender candle", "Lavender candle 20 oz", "<script>candle</script>", ""]) expect(descriptionProblems(text, item).length).toBeGreaterThan(0);
  });
  it("preserves the complete object and variations while replacing the HTML description", () => {
    const result = descriptionUpdate(item, "Lavender & soy\nHandmade candle");
    expect(result.item_data.description_html).toBe("Lavender &amp; soy<br>Handmade candle");
    expect(result.item_data.variations).toEqual(item.item_data.variations);
    expect(result.item_data.image_ids).toEqual(["PHOTO"]);
    expect(result.item_data.tax_ids).toEqual(["TAX"]);
    expect(result.version).toBe(123);
    expect(result.item_data).not.toHaveProperty("description_plaintext");
    expect(item.item_data.description_html).toBe("<p>Handmade soy candle with lavender.</p>");
  });
});
