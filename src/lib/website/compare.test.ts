import { describe, expect, it } from "vitest";
import { FIRST_SALE_SITE_MONTHLY_USD, PLATFORM_DATA, PLATFORM_ORDER } from "@/data/website-platforms";
import { costSummary, feeText } from "./costs";
import type { PlatformInfo } from "./platforms";
import { packageTerms, TERMS } from "./terms";

const statuses = (platform: PlatformInfo) => Object.fromEntries(packageTerms(platform).map((row) => [row.term, row.status]));

describe("packageTerms", () => {
  it.each(PLATFORM_ORDER)("covers every term once, in the same order, for %s", (id) => {
    expect(packageTerms(PLATFORM_DATA[id]).map((row) => row.term)).toEqual([...TERMS]);
  });

  it("marks what each package includes, charges extra for, or leaves out", () => {
    expect(statuses(PLATFORM_DATA.first_sale)).toEqual({
      domain: "not_included",
      hosting: "included",
      builder: "included",
      checkout: "not_included",
      email: "not_included",
    });
    expect(statuses(PLATFORM_DATA.square)).toEqual({ domain: "extra", hosting: "included", builder: "included", checkout: "included", email: "extra" });
    expect(statuses(PLATFORM_DATA.wix)).toEqual({ domain: "included", hosting: "included", builder: "included", checkout: "included", email: "extra" });
    expect(statuses(PLATFORM_DATA.shopify)).toEqual({ domain: "extra", hosting: "included", builder: "included", checkout: "included", email: "extra" });
  });

  it("says why, with the prices from the platform data", () => {
    const square = packageTerms(PLATFORM_DATA.square);
    expect(square[0].note).toBe("Needs Square Plus ($49 a month), plus the address, from $19.95. Free address: yourname.square.site.");
    expect(packageTerms(PLATFORM_DATA.shopify)[0].note).toBe("From $9 a year from Shopify. Free address: yourstore.myshopify.com.");
    expect(packageTerms(PLATFORM_DATA.wix)[0].note).toMatch(/^Free for the first year, then \$13\.35 or \$21\.35/);
    expect(square[3].note).toBe("Card fee 3.3% + 30¢ per sale.");
  });

  it("follows the data, not the package's name", () => {
    const hostless: PlatformInfo = { ...PLATFORM_DATA.square, hosting: false, checkout: "payment_links", email: { kind: "none", via: "an email service", monthlyUsd: null } };
    expect(statuses(hostless)).toMatchObject({ hosting: "not_included", checkout: "not_included", email: "not_included" });
    const freeDomain: PlatformInfo = { ...PLATFORM_DATA.shopify, domain: { ...PLATFORM_DATA.shopify.domain, firstYearFree: true } };
    expect(statuses(freeDomain).domain).toBe("included");
    // A plan upgrade is still an extra cost, even with a free first year
    const upgrade: PlatformInfo = { ...PLATFORM_DATA.wix, domain: { ...PLATFORM_DATA.wix.domain, needsPlan: { name: "Wix Business", monthlyUsd: 39 } } };
    expect(statuses(upgrade).domain).toBe("extra");
  });
});

describe("costSummary", () => {
  it("adds Square Plus and the web address to Square Free, and leaves email out of the total", () => {
    const square = costSummary(PLATFORM_DATA.square);
    expect(square.base).toMatchObject({ label: "Square Free plan", amount: { kind: "monthly", usd: 0 } });
    expect(square.extras.map((line) => [line.term, line.amount.kind])).toEqual([
      ["domain", "monthly"],
      ["domain", "once"],
      ["email", "unknown"],
      ["checkout", "per_sale"],
    ]);
    expect(square.extras[0].amount).toEqual({ kind: "monthly", usd: 49 });
    expect(square).toMatchObject({ monthlyUsd: 49, firstYearUsd: 607.95, from: true, perSale: "3.3% + 30¢ per card sale" });
    expect(square.notCounted).toEqual(["email"]);
  });

  it("counts Wix's free first-year address as nothing, and Shopify's from its yearly price", () => {
    expect(costSummary(PLATFORM_DATA.wix)).toMatchObject({ monthlyUsd: 29, firstYearUsd: 348, from: false, perSale: "2.9% + 30¢ per card sale" });
    expect(costSummary(PLATFORM_DATA.wix).extras[0].amount).toMatchObject({ kind: "free_first_year" });
    expect(costSummary(PLATFORM_DATA.shopify)).toMatchObject({ monthlyUsd: 29, firstYearUsd: 29 * 12 + 9, from: true });
  });

  it("prices the First Sale site from its demo constant, with unknown extras listed, not guessed", () => {
    const site = costSummary(PLATFORM_DATA.first_sale);
    expect(PLATFORM_DATA.first_sale.demoPrice).toBe(true);
    expect(site).toMatchObject({ monthlyUsd: FIRST_SALE_SITE_MONTHLY_USD, firstYearUsd: FIRST_SALE_SITE_MONTHLY_USD * 12, from: false });
    expect(site.notCounted).toEqual(["domain", "email"]);
    expect(site.extras.at(-1)).toMatchObject({ label: "Card fees, through your payment provider", amount: { kind: "per_sale", text: "2.9% + 30¢ per card sale" } });
  });

  it("counts a known email price every month", () => {
    const withEmail: PlatformInfo = { ...PLATFORM_DATA.shopify, email: { kind: "addon", via: "Shopify", monthlyUsd: 6 } };
    expect(costSummary(withEmail)).toMatchObject({ monthlyUsd: 35, firstYearUsd: 35 * 12 + 9, notCounted: [] });
  });

  it("writes card fees from the rate", () => {
    expect(feeText({ percent: 0.029, fixedCents: 30 })).toBe("2.9% + 30¢");
    expect(feeText({ percent: 0.035, fixedCents: 30 })).toBe("3.5% + 30¢");
  });
});
