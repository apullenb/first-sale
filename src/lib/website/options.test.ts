import { describe, expect, it } from "vitest";
import type { CompletionRequest, WebSearchHit } from "@/lib/ai";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { OwnerFacingError } from "@/lib/errors";
import { testProfile } from "@/test/fixtures";
import { PLATFORM_DATA } from "@/data/website-platforms";
import { checkOptions, explainOption, explanationKey, findMoreOptions, isCurrentExplanation, platformFacts } from "./options";

const hits: WebSearchHit[] = [
  { title: "Squarespace pricing", url: "https://www.squarespace.com/pricing", snippet: "Personal plan $16 a month, billed yearly.", cited: true },
  { title: "GoDaddy builder", url: "https://www.godaddy.com/websites/website-builder", snippet: "Build a website for free.", cited: false },
  { title: "10 Best Website Builders of 2026", url: "https://www.forbes.com/advisor/business/best-website-builders/", snippet: "Weebly plans from $10.", cited: false },
];
const option = (overrides: Record<string, unknown> = {}) => ({
  name: "Squarespace",
  website: "https://www.squarespace.com",
  prices: "From $16 a month, billed yearly",
  pros: ["Polished designs"],
  cons: ["Fewer selling tools"],
  bestFor: "Design-focused sites",
  sourceUrls: ["https://www.squarespace.com/pricing"],
  ...overrides,
});

describe("checkOptions", () => {
  it("keeps an option backed by a real result, with its price from the result", () => {
    expect(checkOptions([option()], hits, ["Square", "Wix", "Shopify"])).toEqual([
      {
        name: "Squarespace",
        website: "https://www.squarespace.com",
        prices: "From $16 a month, billed yearly",
        pros: ["Polished designs"],
        cons: ["Fewer selling tools"],
        bestFor: "Design-focused sites",
        sources: [{ title: "Squarespace pricing", url: "https://www.squarespace.com/pricing" }],
      },
    ]);
  });

  it("drops a price the results don't show", () => {
    expect(checkOptions([option({ prices: "From $12 a month" })], hits, [])[0].prices).toBeNull();
  });

  it("checks every point against the option's own sources, not the other results", () => {
    const [checked] = checkOptions(
      [
        option({
          prices: "From $10 a month",
          pros: ["Plans from $16", "Plans from $5 a month"],
          cons: ["Free forever", "A $99 setup fee"],
          bestFor: "Cheapest at $1",
        }),
      ],
      hits,
      [],
    );
    expect(checked).toMatchObject({ prices: null, pros: ["Plans from $16"], cons: [], bestFor: "" });
  });

  it("doesn't borrow a price or money claim from a result about another builder", () => {
    const hostinger = option({
      name: "Hostinger",
      website: "https://www.hostinger.com",
      prices: "From $10 a month",
      pros: ["No monthly fee", "Zero transaction fees"],
      sourceUrls: [hits[2].url, "https://www.hostinger.com/website-builder"],
    });
    const withHostinger = [...hits, { title: "Hostinger builder", url: "https://www.hostinger.com/website-builder", snippet: "Drag and drop pages.", cited: true }];
    expect(checkOptions([hostinger], withHostinger, [])[0]).toMatchObject({ prices: null, pros: [], sources: [{ url: "https://www.hostinger.com/website-builder" }] });
  });

  it("lists each source once, and matches the builder's whole name to its site", () => {
    expect(checkOptions([option({ sourceUrls: [hits[0].url, hits[0].url] })], hits, [])[0].sources).toHaveLength(1);
    expect(checkOptions([option({ name: "Squares", website: "https://www.squarespace.com" })], hits, [])).toEqual([]);
  });

  it("needs the builder's own site, not an article about it", () => {
    const weebly = option({ name: "Weebly", website: "https://www.forbes.com/advisor/weebly", sourceUrls: [hits[2].url] });
    expect(checkOptions([weebly], hits, [])).toEqual([]);
    expect(checkOptions([option({ name: "Wix.com" })], hits, ["Wix"])).toEqual([]);
  });

  it("drops options whose site or sources aren't among the results, and the ones already listed", () => {
    expect(checkOptions([option({ website: "https://squarespace.example.com" })], hits, [])).toEqual([]);
    expect(checkOptions([option({ sourceUrls: ["https://elsewhere.com/review"] })], hits, [])).toEqual([]);
    expect(checkOptions([option({ name: "Square Online" })], hits, ["Square"])).toEqual([]);
    expect(checkOptions([option(), option()], hits, [])).toHaveLength(1);
  });
});

describe("findMoreOptions", () => {
  it("says so plainly in practice mode, without searching", async () => {
    await expect(findMoreOptions(createMockProvider(), { profile: testProfile(), exclude: ["Square"] })).rejects.toBeInstanceOf(OwnerFacingError);
  });

  it("searches, then keeps only checked options", async () => {
    const model = {
      ...createMockProvider(() => JSON.stringify({ options: [option(), option({ name: "Made Up", website: "https://madeup.example" })] })),
      webSearch: async () => ({ hits, answer: "" }),
    };
    const found = await findMoreOptions(model, { profile: testProfile(), exclude: ["Square", "Wix", "Shopify"] }, new Date("2026-10-27T12:00:00Z"));
    expect(found.options.map((each) => each.name)).toEqual(["Squarespace"]);
    expect(found.searchedAt).toBe("2026-10-27T12:00:00.000Z");
  });
});

describe("explainOption", () => {
  it("flags numbers that aren't in the option's facts", async () => {
    const model = createMockProvider((request: CompletionRequest) =>
      request.responseFormat
        ? JSON.stringify({
            overview: "A store builder.",
            whatItsLike: "Easy.",
            goodFit: "You ship.",
            watchOut: "Fees add up: about $45 a month in apps.",
            firstYear: "$29 × 12 = $348.",
            stillNeed: ["A web address"],
          })
        : "",
    );
    const explanation = await explainOption(model, { profile: testProfile(), name: "Shopify", facts: { price: "$29 a month" } });
    // A year of a monthly price is its own arithmetic, so $348 isn't flagged
    expect(explanation.flags).toEqual(["Check “$45”: it isn’t in this option’s facts."]);
    expect(explanation.factsKey).toBe(explanationKey(testProfile(), { price: "$29 a month" }));
  });

  it("knows a built-in option's first-year total, so it isn't flagged", async () => {
    const facts = platformFacts(PLATFORM_DATA.shopify);
    const model = createMockProvider((request: CompletionRequest) =>
      request.responseFormat
        ? JSON.stringify({ overview: "", whatItsLike: "", goodFit: "", watchOut: "", firstYear: "$348 + $9 = $357.", stillNeed: [] })
        : "",
    );
    expect((await explainOption(model, { profile: testProfile(), name: "Shopify", facts })).flags).toEqual([]);
  });

  it("reuses an explanation only for the same facts and answers, and not a practice one once the AI is connected", async () => {
    const facts = { oneLine: "A free store." };
    const profile = testProfile();
    const practice = await explainOption(createMockProvider(), { profile, name: "Square", facts });
    expect(isCurrentExplanation(practice, profile, facts, true)).toBe(true);
    expect(isCurrentExplanation(practice, profile, facts, false)).toBe(false);
    expect(isCurrentExplanation({ ...practice, simulated: false }, profile, { oneLine: "Changed." }, false)).toBe(false);
    expect(isCurrentExplanation(practice, testProfile({ channels: ["own_website"] }), facts, true)).toBe(false);
    expect(isCurrentExplanation(undefined, profile, facts, true)).toBe(false);
  });

  it("restates the facts in practice mode, labeled as practice", async () => {
    const explanation = await explainOption(createMockProvider(), {
      profile: testProfile(),
      name: "Square",
      facts: { oneLine: "A free store.", notIncluded: [{ item: "Your own web address" }] },
    });
    expect(explanation).toMatchObject({ simulated: true, stillNeed: ["Your own web address"] });
    expect(explanation.overview).toMatch(/Practice mode/);
  });
});
