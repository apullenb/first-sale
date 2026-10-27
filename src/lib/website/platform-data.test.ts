import { describe, expect, it } from "vitest";
import { PLATFORM_DATA, PLATFORM_ORDER } from "@/data/website-platforms";
import { cardFeeOn, firstYearCost, usd } from "./costs";
import { DEFAULT_LOOK, lookFromBrand, textOn } from "./look";

const VENDOR_HOSTS: Record<string, string[]> = {
  square: ["squareup.com"],
  wix: ["wix.com"],
  shopify: ["shopify.com"],
};

describe("platform data", () => {
  it.each(PLATFORM_ORDER)("links %s only to its own official pages", (id) => {
    const info = PLATFORM_DATA[id];
    const urls = [info.signupUrl, ...info.sources.map((source) => source.url), ...info.setupSteps.flatMap((step) => (step.help ? [step.help.url] : []))];
    for (const url of urls) {
      const host = new URL(url).hostname;
      expect(url.startsWith("https://")).toBe(true);
      expect(VENDOR_HOSTS[id].some((vendor) => host === vendor || host.endsWith(`.${vendor}`))).toBe(true);
    }
  });

  it("gives every setup step a unique key per platform", () => {
    const keys = PLATFORM_ORDER.flatMap((id) => PLATFORM_DATA[id].setupSteps.map((step) => step.key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const id of PLATFORM_ORDER) expect(PLATFORM_DATA[id].setupSteps.every((step) => step.key.startsWith(`${id}-`))).toBe(true);
  });
});

describe("costs", () => {
  it("adds a year of the starting plan and the web address", () => {
    expect(firstYearCost(PLATFORM_DATA.shopify).total).toBe(29 * 12 + 9);
    expect(firstYearCost(PLATFORM_DATA.square).total).toBe(0);
  });

  it("works out the card fee on an order", () => {
    expect(cardFeeOn(PLATFORM_DATA.square, 40)).toBe(1.62);
    expect(cardFeeOn(PLATFORM_DATA.shopify, 40)).toBe(1.46);
    expect(usd(1.5)).toBe("$1.50");
    expect(usd(348)).toBe("$348");
  });
});

describe("site look", () => {
  it("uses dark text on light brand colors and white on dark ones", () => {
    expect(textOn("#1e6b52")).toBe("#ffffff");
    expect(textOn("#f5d76e")).toBe("#1c2321");
  });

  it("falls back to the app's theme without a brand kit", () => {
    expect(lookFromBrand(null)).toEqual(DEFAULT_LOOK);
  });
});
