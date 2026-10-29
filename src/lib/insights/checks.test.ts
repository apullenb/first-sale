import { describe, expect, it } from "vitest";
import { type CheckContext, checkInsights, INSIGHT_CAPS, insightKey, isDiscouraging } from "./checks";
import type { InsightReplyItem, InsightsReply } from "./types";

const item = (title: string, overrides: Partial<InsightReplyItem> = {}): InsightReplyItem => ({
  title,
  detail: `${title}, in a couple of kind sentences.`,
  action: "Take one small step this week.",
  link: null,
  stepKey: null,
  ...overrides,
});

const reply = (overrides: Partial<InsightsReply> = {}): InsightsReply => ({
  opening: "Rise Bakery is off to a lovely start.",
  strengths: [item("Clear first offer"), item("Launch date set"), item("Steps already done")],
  watch: [item("Plan for busy weekends")],
  tips: [item("Tell your neighbors first")],
  ideas: [item("Offer a tasting box")],
  ...overrides,
});

const context = (overrides: Partial<CheckContext> = {}): CheckContext => ({
  known: new Set(["1000", "2026", "12"]),
  counts: new Set(["2", "5", "34"]),
  steps: new Map([["sales-tax-permit", { id: "step-1", title: "Get a sales tax permit" }]]),
  dismissed: new Set(),
  businessName: "Rise Bakery",
  ...overrides,
});

const titles = (result: ReturnType<typeof checkInsights>, section: string) =>
  result.items.filter((each) => each.section === section).map((each) => each.title);

describe("checkInsights", () => {
  it("keeps a kind, specific reply as it is, in section order", () => {
    const result = checkInsights(reply(), context());
    expect(result.opening).toBe("Rise Bakery is off to a lovely start.");
    expect(result.items.map((each) => each.section)).toEqual(["strengths", "strengths", "strengths", "watch", "tips", "ideas"]);
    expect(result.removed).toBe(0);
  });

  it("caps each section, and never has more to watch than to celebrate", () => {
    const many = (prefix: string) => Array.from({ length: 6 }, (_, index) => item(`${prefix} ${String.fromCharCode(97 + index)}`));
    const capped = checkInsights(reply({ strengths: many("Strength"), watch: many("Watch"), tips: many("Tip"), ideas: many("Idea") }), context());
    expect(titles(capped, "strengths")).toHaveLength(INSIGHT_CAPS.strengths);
    expect(titles(capped, "watch")).toHaveLength(INSIGHT_CAPS.watch);
    expect(titles(capped, "tips")).toHaveLength(INSIGHT_CAPS.tips);
    expect(titles(capped, "ideas")).toHaveLength(INSIGHT_CAPS.ideas);
    expect(capped.removed).toBe(24 - 4 - 3 - 4 - 3);

    const oneStrength = checkInsights(reply({ strengths: [item("Clear first offer")], watch: many("Watch") }), context());
    expect(titles(oneStrength, "watch")).toEqual(["Watch a"]);

    const noStrengths = checkInsights(reply({ strengths: [], watch: many("Watch") }), context());
    expect(titles(noStrengths, "watch")).toEqual([]);
  });

  it("drops things to keep an eye on that don't come with something to do", () => {
    const result = checkInsights(reply({ watch: [item("Plan for busy weekends", { action: "" }), item("Think about storage", { action: "Ok." })] }), context());
    expect(titles(result, "watch")).toEqual([]);
    expect(result.removed).toBe(2);
  });

  it("lets strengths go without an action", () => {
    const result = checkInsights(reply({ strengths: [item("Clear first offer", { action: "" })] }), context());
    expect(result.items[0]).toMatchObject({ title: "Clear first offer", action: null });
  });

  it.each([
    "Honestly, this is a bad idea for your town.",
    "Most bakeries like this will fail in the first year.",
    "The cookie market is saturated.",
    "You may want to reconsider selling at markets.",
    "This plan is unrealistic for one person.",
    "A common mistake is pricing too low.",
    "You lack experience running a business.",
    "This won’t work without a storefront.",
    "Bakery markets can be competitive and risky.",
    "Many home bakers struggle to make money.",
    "Your budget is tight, which isn’t enough for a booth.",
    "Most new bakeries close within a year.",
    "Your business might fail without a website.",
    "Many new food businesses fail in their first year.",
    "Bread can be competitive at markets.",
    "It’s a tough market and hard to make money at first.",
  ])("leaves out discouraging wording: %s", (detail) => {
    const result = checkInsights(reply({ watch: [item("Something to think about", { detail })] }), context());
    expect(titles(result, "watch")).toEqual([]);
    expect(result.removed).toBe(1);
  });

  it("keeps gentle wording that only sounds close", () => {
    for (const text of [
      "Sell out your first batch",
      "Plan for a rainy market day",
      "Keep a backup if your card reader stops working",
      "Your card reader might fail, so bring a backup",
      "Don’t give up if the first market is slow",
      "Customers love a real story",
      "Keep your prices competitive with a sample tray",
      "These ideas fit a small budget",
      "Most shoppers stop at tables with a clear sign",
      "Busy parents who struggle to find good bread will love a weekly loaf",
      "Your pre-order window closes in a day or two",
    ]) {
      expect(isDiscouraging(text)).toBe(false);
    }
  });

  it("drops made-up statistics and numbers First Sale doesn't know", () => {
    const result = checkInsights(
      reply({
        tips: [
          item("Take cards", { detail: "8 in 10 market shoppers pay by card." }),
          item("Win regulars", { detail: "Half of market shoppers come back the next week." }),
          item("Post often", { detail: "Post 3 times a week to stay in mind." }),
          item("Make every dollar count", { detail: "Start with your best loaf and a simple sign." }),
          item("Count down to launch", { detail: "Your launch is 34 days away, so plan one bake a week until then." }),
        ],
      }),
      context(),
    );
    expect(titles(result, "tips")).toEqual(["Make every dollar count", "Count down to launch"]);
  });

  it("replaces a discouraging or fact-stating opening with a warm one written by rules", () => {
    expect(checkInsights(reply({ opening: "Rise Bakery will fail without a plan." }), context()).opening).toBe("Here’s what stands out about Rise Bakery so far.");
    expect(checkInsights(reply({ opening: "You’ll owe sales tax on every sale." }), context()).opening).toBe("Here’s what stands out about Rise Bakery so far.");
    expect(checkInsights(reply({ opening: "  " }), context({ businessName: null })).opening).toBe("Here’s what stands out about your business so far.");
    expect(checkInsights(reply({ opening: "Rise Bakery is on its way, and your LLC is already formed." }), context()).opening).toBe(
      "Rise Bakery is on its way, and your LLC is already formed.",
    );
  });

  it("drops money and percentages the owner never gave", () => {
    const result = checkInsights(
      reply({
        tips: [
          item("Price your cookies well", { detail: "Most bakers charge $3 a cookie." }),
          item("Grow with repeat customers", { detail: "Repeat buyers are 60% of sales." }),
          item("Aim high", { detail: "Bakers like you make 500 dollars a weekend." }),
          item("Charge a little more", { detail: "Most shoppers will pay fifty dollars for a cake." }),
          item("Stay inside your budget", { detail: "You planned to spend under $1,000, so start with what you have." }),
        ],
      }),
      context(),
    );
    expect(titles(result, "tips")).toEqual(["Stay inside your budget"]);
  });

  it("keeps legal points to pointers at sourced pages", () => {
    const result = checkInsights(
      reply({
        watch: [
          item("See what applies to your kitchen", { detail: "Your requirements page lists the permit rules for a home kitchen where you are." }),
          item("Settle your business structure", { detail: "Your structure page compares an LLC and a sole proprietorship for your answers.", link: "business" }),
          item("Sales tax on website orders", { detail: "Your plan has a sales tax step for online orders.", link: "website" }),
        ],
      }),
      context(),
    );
    expect(result.items.filter((each) => each.section === "watch").map((each) => [each.title, each.link?.href])).toEqual([
      ["See what applies to your kitchen", "/requirements"],
      ["Settle your business structure", "/structure"],
      ["Sales tax on website orders", "/requirements"],
    ]);
    expect(result.removed).toBe(0);
  });

  it.each([
    "Good news: home bakers in Texas don’t need a license to sell at markets.",
    "Texas requires an assumed name certificate within 60 days.",
    "The permit fee is about fifty dollars.",
    "Renew your permit every year.",
    "Permits renew after 2 years.",
    "An LLC can limit your personal liability.",
    "You’ll owe sales tax on market sales.",
    "Cottage food sellers are exempt from inspections.",
    "Bread is tax-free in Texas.",
    "Loaves sold at markets aren’t taxable here.",
    "Your LLC keeps your house and savings safe from business debts.",
    "Home kitchens in Ohio aren’t inspected.",
    "You won’t need any paperwork from the city to sell bread.",
    "Texas lets home bakers sell bread straight to customers.",
  ])("drops legal points that state a rule, deadline or number: %s", (detail) => {
    const result = checkInsights(reply({ watch: [item("Good to know", { detail, link: "requirements" })] }), context());
    expect(titles(result, "watch")).toEqual([]);
  });

  it("doesn't treat everyday words as legal ones", () => {
    const result = checkInsights(
      reply({
        tips: [
          item("Fine-tune your best sellers", { detail: "Watch which loaves sell out first and bake more of those." }),
          item("Give yourself a deadline for the logo", { detail: "A date keeps the fun work moving.", link: "brand" }),
          item("Team up with a café", { detail: "A partnership with the café down the street could put your bread on their counter." }),
          item("Sell gift certificates", { detail: "Gift certificates make easy holiday presents, and a card reader is lighter than a cash register." }),
          item("Keep your logo handy", { detail: "Save your logo file where you can find it, and use a rule of thumb: one look everywhere.", link: "brand" }),
          item("Know your card costs", { detail: "Square shows its card fees up front, so you can price with them in mind.", link: "website" }),
        ],
      }),
      context(),
    );
    expect(result.items.filter((each) => each.section === "tips").map((each) => each.link?.href ?? null)).toEqual([null, "/brand", null, null]);
    expect(titles(result, "tips")).toEqual(["Fine-tune your best sellers", "Give yourself a deadline for the logo", "Team up with a café", "Sell gift certificates"]);

    const more = checkInsights(
      reply({
        tips: [
          item("Keep your logo handy", { detail: "Save your logo file where you can find it, and use a rule of thumb: one look everywhere.", link: "brand" }),
          item("Know your card costs", { detail: "Square shows its card fees up front, so you can price with them in mind.", link: "website" }),
          item("Square’s fees", { detail: "Your website page shows what each builder charges.", link: "website" }),
        ],
      }),
      context(),
    );
    expect(more.items.filter((each) => each.section === "tips").map((each) => each.link?.href)).toEqual(["/brand", "/website", "/website"]);
  });

  it("keeps a sourced link the model chose for a legal point", () => {
    const result = checkInsights(reply({ watch: [item("Your sales tax permit", { detail: "Your plan has a tax step.", stepKey: "sales-tax-permit" })] }), context());
    expect(result.items.find((each) => each.section === "watch")?.link).toEqual({ href: "/checklist/step-1", label: "Get a sales tax permit" });
  });

  it("lets a point about the owner's own plan step say it's needed and repeat the plan's counts", () => {
    const result = checkInsights(
      reply({
        strengths: [item("Real progress", { detail: "You’ve finished 2 of 5 steps before your first sale, including your LLC.", action: "" }), item("Clear first offer")],
        watch: [item("Your permit step", { detail: "The sales tax permit you need is the next step in your plan.", stepKey: "sales-tax-permit" })],
      }),
      context(),
    );
    expect(result.items.map((each) => [each.title, each.link?.href ?? null])).toEqual([
      ["Real progress", "/structure"],
      ["Clear first offer", null],
      ["Your permit step", "/checklist/step-1"],
      ["Tell your neighbors first", null],
      ["Offer a tasting box", null],
    ]);
  });

  it("turns links into app pages, ignoring step keys that aren't in the plan", () => {
    const result = checkInsights(
      reply({ ideas: [item("Show off your logo", { link: "brand" }), item("Start a tasting list", { link: "website", stepKey: "made-up-step" })] }),
      context(),
    );
    expect(result.items.filter((each) => each.section === "ideas").map((each) => each.link)).toEqual([
      { href: "/brand", label: "Branding" },
      { href: "/website", label: "Website" },
    ]);
  });

  it("leaves out repeats and anything the owner dismissed before, without counting dismissed ones as removed", () => {
    const result = checkInsights(
      reply({ tips: [item("Tell your neighbors first"), item("Tell your  neighbors first!"), item("Bake a sample tray")] }),
      context({ dismissed: new Set([insightKey("tips", "Bake a sample tray")]) }),
    );
    expect(titles(result, "tips")).toEqual(["Tell your neighbors first"]);
    expect(result.removed).toBe(1);
  });
});
