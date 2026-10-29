import { describe, expect, it } from "vitest";
import { PLATFORM_DATA, PLATFORM_ORDER } from "@/data/website-platforms";
import { usd } from "./costs";
import { contrast, DEFAULT_LOOK, lookFromBrand, textOn } from "./look";
import { platformFacts } from "./options";

const VENDOR_HOSTS: Record<string, string[]> = {
  // Stripe and Square make the payment links
  first_sale: ["stripe.com", "squareup.com"],
  square: ["squareup.com"],
  wix: ["wix.com"],
  shopify: ["shopify.com"],
};

describe("platform data", () => {
  it.each(PLATFORM_ORDER)("links %s only to its own official pages", (id) => {
    const info = PLATFORM_DATA[id];
    const urls = [
      info.signupUrl,
      info.domainSetup?.source.url,
      ...info.sources.map((source) => source.url),
      ...info.setupSteps.flatMap((step) => [step.help?.url, step.goTo?.url]),
    ].filter((url): url is string => Boolean(url));
    for (const url of urls) {
      const host = new URL(url).hostname;
      expect(url.startsWith("https://")).toBe(true);
      expect(VENDOR_HOSTS[id].some((vendor) => host === vendor || host.endsWith(`.${vendor}`))).toBe(true);
    }
  });

  it.each(["square", "wix", "shopify"] as const)("gives %s web address records, or says where the platform shows them", (id) => {
    const setup = PLATFORM_DATA[id].domainSetup;
    if (!setup) throw new Error(`${id} has no domain setup`);
    expect(setup.records.length > 0 || Boolean(setup.shownIn)).toBe(true);
    for (const record of setup.records) expect(["@", "www"]).toContain(record.host);
    expect(PLATFORM_DATA[id].setupSteps.some((step) => step.paste.includes("dns"))).toBe(true);
  });

  it("keeps step instructions out of the facts AI explains", () => {
    const facts = platformFacts(PLATFORM_DATA.shopify);
    expect(facts.setupSteps).toBeUndefined();
    expect(facts.domainSetup).toBeUndefined();
  });

  it("gives every setup step a unique key per platform", () => {
    const keys = PLATFORM_ORDER.flatMap((id) => PLATFORM_DATA[id].setupSteps.map((step) => step.key));
    expect(new Set(keys).size).toBe(keys.length);
    for (const id of PLATFORM_ORDER) expect(PLATFORM_DATA[id].setupSteps.every((step) => step.key.startsWith(`${id}-`))).toBe(true);
  });
});

describe("costs", () => {
  it("writes dollar amounts", () => {
    expect(usd(1.5)).toBe("$1.50");
    expect(usd(348)).toBe("$348");
  });
});

describe("site look", () => {
  it("uses dark text on light brand colors and white on dark ones", () => {
    expect(textOn("#1e6b52")).toBe("#ffffff");
    expect(textOn("#f5d76e")).toBe("#1c2321");
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrast("#ffffff", "#ffffff")).toBe(1);
  });

  it("falls back to the app's theme without a brand kit", () => {
    expect(lookFromBrand(null)).toEqual(DEFAULT_LOOK);
  });
});
