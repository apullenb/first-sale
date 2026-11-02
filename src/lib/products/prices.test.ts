import { describe, expect, it } from "vitest";
import type { WebSearchHit } from "@/lib/ai";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { checkPrices, comparePrices } from "./prices";

const hit = (url: string, snippet: string): WebSearchHit => ({ title: "Shop", url, snippet, cited: true });

describe("prices from search", () => {
  const results = [hit("https://candles.example/products/cedar", "Cedar soy candle, 8 oz. $26.00"), hit("https://www.google.com/search?q=candles", "Candles from $10"), hit("https://other.example/p/tin", "")];

  it("keep only prices their own result shows, on an item page, read into cents by code", () => {
    const kept = checkPrices(
      [
        { item: "Cedar candle", seller: "Cedar Shop", price: "$26.00", sourceUrl: "https://candles.example/products/cedar" },
        // Not in the result's text
        { item: "Cedar candle", seller: "Cedar Shop", price: "$28", sourceUrl: "https://candles.example/products/cedar" },
        // A search page
        { item: "Candles", seller: "Someone", price: "$10", sourceUrl: "https://www.google.com/search?q=candles" },
        // Not one of the results
        { item: "Candle", seller: "Made up", price: "$26", sourceUrl: "https://invented.example/p/1" },
        // No text to check against
        { item: "Tin", seller: "Other", price: "$12", sourceUrl: "https://other.example/p/tin" },
        // No seller
        { item: "Cedar candle", seller: " ", price: "$26", sourceUrl: "https://candles.example/products/cedar" },
      ],
      results,
    );
    expect(kept).toEqual([{ item: "Cedar candle", seller: "Cedar Shop", price: "$26.00", cents: 2600, url: "https://candles.example/products/cedar", sourceTitle: "Shop" }]);
  });

  it("are labeled practice samples with clearly fake sellers in practice mode", async () => {
    const check = await comparePrices(createMockProvider(), { item: { name: "Cedar candle", kind: "product", description: "" }, area: { city: "Denver", state: "Colorado", online: true } }, new Date("2026-11-01T12:00:00Z"));
    expect(check.simulated).toBe(true);
    expect(check.area).toBe("Denver, Colorado and online");
    expect(check.prices.every((price) => price.seller.startsWith("Sample Seller"))).toBe(true);
  });
});
