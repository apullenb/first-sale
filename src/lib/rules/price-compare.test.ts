import { describe, expect, it } from "vitest";
import { comparableStats, dollarAmounts, isItemPage, priceStats, priceUnit, sourceContainsPrice } from "./price-compare";

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

describe("comparable units", () => {
  it("read what a price is for from its own words", () => {
    expect(priceUnit("$40/hour")).toBe("hour");
    expect(priceUnit("$45 an hour")).toBe("hour");
    expect(priceUnit("From $65 per visit")).toBe("visit");
    expect(priceUnit("$30 a lesson")).toBe("session");
    expect(priceUnit("$120 monthly")).toBe("month");
    expect(priceUnit("$24.00")).toBe("");
  });

  it("compare only prices for the same unit, the owner's own when found", () => {
    const prices = [
      { price: "$60 per visit", cents: 6000 },
      { price: "$80 per visit", cents: 8000 },
      { price: "$70 a visit", cents: 7000 },
      { price: "$35/hour", cents: 3500 },
    ];
    expect(comparableStats(prices)).toEqual({ unit: "visit", stats: { count: 3, lowCents: 6000, typicalCents: 7000, highCents: 8000, enough: true } });
    expect(comparableStats(prices, "$40 an hour")).toMatchObject({ unit: "hour", stats: { count: 1, enough: false } });
    expect(comparableStats(prices, "$75")).toMatchObject({ unit: "visit" });
    expect(comparableStats([])).toBeNull();
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
