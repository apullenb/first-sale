import { describe, expect, it } from "vitest";
import { SNAPSTART_SITE_MONTHLY_USD, PLATFORM_DATA, PLATFORM_ORDER } from "@/data/website-platforms";
import { comparePlan, costSummary, feeText, firstYearText } from "./costs";
import type { PlatformInfo } from "./platforms";
import { finishStands } from "./site/finish";
import { packageTerms, TERMS } from "./terms";

const statuses = (platform: PlatformInfo) => Object.fromEntries(packageTerms(platform).map((row) => [row.term, row.status]));
const line = (platform: PlatformInfo, term: string) => costSummary(platform).extras.find((each) => each.term === term)!;

describe("comparePlan", () => {
  it.each(PLATFORM_ORDER)("prices %s on its cheapest plan with the owner's own web address and card payments", (id) => {
    const plan = comparePlan(PLATFORM_DATA[id]);
    expect(plan).toMatchObject({ ownAddress: true, takesPayments: true });
    const cheaper = PLATFORM_DATA[id].plans.filter((each) => each.ownAddress && each.takesPayments && each.monthlyUsd < plan.monthlyUsd);
    expect(cheaper).toEqual([]);
  });

  it("skips Square Free and Wix Light, which can't meet that need", () => {
    expect(comparePlan(PLATFORM_DATA.square).name).toBe("Square Plus");
    expect(comparePlan(PLATFORM_DATA.wix).name).toBe("Wix Core");
    expect(comparePlan(PLATFORM_DATA.shopify).name).toBe("Shopify Basic");
  });
});

describe("packageTerms", () => {
  it.each(PLATFORM_ORDER)("covers every term once, in the same order, for %s", (id) => {
    expect(packageTerms(PLATFORM_DATA[id]).map((row) => row.term)).toEqual([...TERMS]);
  });

  it("marks what each package includes, charges extra for, or leaves out", () => {
    expect(statuses(PLATFORM_DATA.first_sale)).toEqual({
      domain: "included",
      hosting: "included",
      builder: "included",
      checkout: "not_included",
      email: "not_included",
    });
    expect(statuses(PLATFORM_DATA.square)).toEqual({ domain: "extra", hosting: "included", builder: "included", checkout: "included", email: "extra" });
    expect(statuses(PLATFORM_DATA.wix)).toEqual({ domain: "included", hosting: "included", builder: "included", checkout: "included", email: "extra" });
    // Shopify forwards email but sells no inbox
    expect(statuses(PLATFORM_DATA.shopify)).toEqual({ domain: "extra", hosting: "included", builder: "included", checkout: "included", email: "not_included" });
  });

  it("says why, with the plan priced and its own card fee", () => {
    const square = packageTerms(PLATFORM_DATA.square);
    expect(square[0].note).toBe(
      "From $19.95 from Square; Square doesn’t say how long that covers. Needs Square Plus or higher, the plan priced here. A free yourname.square.site address comes with it.",
    );
    expect(square[3].note).toBe("Card fee 2.9% + 30¢ per sale on Square Plus.");
    expect(packageTerms(PLATFORM_DATA.wix)[0].note).toMatch(/^Free for the first year on yearly plans, then \$13\.35 or \$21\.35/);
    expect(packageTerms(PLATFORM_DATA.shopify)[4].note).toMatch(/doesn’t sell inboxes/);
  });

  it("gives Wix's free web address only with yearly billing", () => {
    const monthly: PlatformInfo = { ...PLATFORM_DATA.wix, plans: PLATFORM_DATA.wix.plans.map((plan) => ({ ...plan, billing: "monthly" as const })) };
    expect(statuses(monthly).domain).toBe("extra");
    expect(line(monthly, "domain")).toMatchObject({ amount: { kind: "unknown" }, counted: false });
  });

  it("follows the data, not the package's name", () => {
    const hostless: PlatformInfo = { ...PLATFORM_DATA.square, hosting: false, checkout: "payment_links", email: { kind: "none", via: "an email service", monthlyUsd: null } };
    expect(statuses(hostless)).toMatchObject({ hosting: "not_included", checkout: "not_included", email: "not_included" });
    const elsewhere: PlatformInfo = { ...PLATFORM_DATA.shopify, domain: { ...PLATFORM_DATA.shopify.domain, sold: "elsewhere", firstUsd: null } };
    expect(statuses(elsewhere).domain).toBe("not_included");
  });
});

describe("costSummary", () => {
  it("prices Square on Plus, with Plus's card fee, and leaves out the web address Square gives no period for", () => {
    const square = costSummary(PLATFORM_DATA.square);
    expect(square.base).toMatchObject({ label: "Square Plus plan", amount: { kind: "monthly", usd: 49, billing: "monthly" }, counted: true });
    expect(square).toMatchObject({ monthlyUsd: 49, upFrontUsd: null, firstYearUsd: 588, from: false, monthToMonth: null });
    expect(line(PLATFORM_DATA.square, "domain")).toMatchObject({ amount: { kind: "once", usd: 19.95, per: null }, counted: false, whyNot: "Square’s page doesn’t say how long it covers" });
    expect(line(PLATFORM_DATA.square, "checkout")).toMatchObject({ amount: { kind: "per_sale", text: "2.9% + 30¢ per card sale" }, counted: false });
    expect(line(PLATFORM_DATA.square, "email")).toMatchObject({ counted: false, whyNot: "price not checked here" });
  });

  it("shows yearly billing plainly, with month to month as its own line that isn't totaled", () => {
    const shopify = costSummary(PLATFORM_DATA.shopify);
    expect(shopify.base.amount).toEqual({ kind: "monthly", usd: 29, billing: "yearly" });
    expect(shopify.monthToMonth).toMatchObject({ amount: { kind: "monthly", usd: 39, billing: "monthly" }, counted: false });
    expect(shopify).toMatchObject({ monthlyUsd: 29, upFrontUsd: 348, firstYearUsd: 29 * 12 + 9, from: true });
    // Wix's page gives no month-to-month price, so there's no line for it
    expect(costSummary(PLATFORM_DATA.wix)).toMatchObject({ monthlyUsd: 29, upFrontUsd: 348, firstYearUsd: 348, monthToMonth: null });
    expect(line(PLATFORM_DATA.wix, "domain")).toMatchObject({ amount: { kind: "free_first_year" }, counted: true });
  });

  it("prices the SnapStart site from its demo constant, leaving out what isn't known", () => {
    const site = costSummary(PLATFORM_DATA.first_sale);
    expect(PLATFORM_DATA.first_sale.demoPrice).toBe(true);
    expect(site).toMatchObject({ monthlyUsd: SNAPSTART_SITE_MONTHLY_USD, firstYearUsd: SNAPSTART_SITE_MONTHLY_USD * 12, from: false });
    expect(site.extras.filter((each) => !each.counted).map((each) => each.term)).toEqual(["email", "checkout"]);
  });

  it("counts a known email price every month", () => {
    const withEmail: PlatformInfo = { ...PLATFORM_DATA.shopify, email: { kind: "addon", via: "Shopify", monthlyUsd: 6 } };
    expect(costSummary(withEmail)).toMatchObject({ monthlyUsd: 35, firstYearUsd: 35 * 12 + 9 });
  });

  it("writes the first year in code, saying what's left out", () => {
    expect(firstYearText(PLATFORM_DATA.wix)).toMatch(/^\$348 for the first year on Wix Core, paid \$29 a month, billed yearly \(\$348 up front\)\. Not counted: /);
    expect(firstYearText(PLATFORM_DATA.first_sale)).toMatch(/\(demo price\)\. Not counted: business email/);
  });

  it("writes card fees from the rate", () => {
    expect(feeText({ percent: 0.029, fixedCents: 30 })).toBe("2.9% + 30¢");
    expect(feeText({ percent: 0.035, fixedCents: 30 })).toBe("3.5% + 30¢");
  });
});

describe("finishStands", () => {
  const copy = { headline: "Rise", subheadline: "", intro: "", about: "", offerings: [], howToBuy: "", contact: "", faq: [], seoTitle: "", seoDescription: "" };
  const parts = { copy, approved: true, design: { style: "clean" } };

  it("keeps the demo finish only while the words stay approved and nothing changes", () => {
    expect(finishStands(parts, parts)).toBe(true);
    expect(finishStands(parts, { ...parts, approved: false })).toBe(false);
    expect(finishStands(parts, { ...parts, copy: { ...copy, about: "New story." } })).toBe(false);
    expect(finishStands(parts, { ...parts, design: { style: "bold" } })).toBe(false);
  });
});
