import { describe, expect, it } from "vitest";
import { dollarAmounts, isItemPage, priceStats, sourceContainsPrice } from "./price-compare";

describe("low, typical and high", () => {
  it("are the lowest, the median and the highest found price", () => {
    expect(priceStats([2800, 1500, 2200])).toEqual({ count: 3, lowCents: 1500, typicalCents: 2200, highCents: 2800, enough: true });
    expect(priceStats([1000, 3000, 2000, 4000])).toMatchObject({ typicalCents: 2500, lowCents: 1000, highCents: 4000 });
    expect(priceStats([1001, 1002])).toMatchObject({ typicalCents: 1002, enough: false });
  });

  it("need at least three prices to compare, and nothing comes from no prices", () => {
    expect(priceStats([1200])).toEqual({ count: 1, lowCents: 1200, typicalCents: 1200, highCents: 1200, enough: false });
    expect(priceStats([])).toBeNull();
    expect(priceStats([0, -5])).toBeNull();
  });
});

describe("a price the source contains", () => {
  it("reads every dollar amount", () => {
    expect(dollarAmounts("$24, $1,200.50 or $ 9.5 — not 30")).toEqual([2400, 120050, 950]);
  });

  it("is kept only when its source shows the same amount", () => {
    expect(sourceContainsPrice("$24.00", "Cedar candle, 8 oz — $24")).toBe(true);
    expect(sourceContainsPrice("$40/hour", "Grooming from $40 per hour")).toBe(true);
    expect(sourceContainsPrice("$25", "Cedar candle — $24")).toBe(false);
    expect(sourceContainsPrice("$20–$30", "Candles $20 and up")).toBe(false);
    expect(sourceContainsPrice("about twenty dollars", "Candles $20")).toBe(false);
    expect(sourceContainsPrice("$24", "24 candles in stock")).toBe(false);
  });
});

describe("an item's own page", () => {
  it("is an https page on the seller's site, not a home, search or results page", () => {
    expect(isItemPage("https://shop.example/products/cedar-candle")).toBe(true);
    expect(isItemPage("https://shop.example/services/full-groom?ref=x")).toBe(true);
    expect(isItemPage("http://shop.example/products/cedar")).toBe(false);
    expect(isItemPage("https://shop.example/")).toBe(false);
    expect(isItemPage("https://shop.example/search?q=candle")).toBe(false);
    expect(isItemPage("https://shop.example/collections/all?q=candle")).toBe(false);
    expect(isItemPage("https://www.google.com/maps/place/x")).toBe(false);
    expect(isItemPage("not a url")).toBe(false);
  });
});
