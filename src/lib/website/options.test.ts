import { describe, expect, it } from "vitest";
import type { CompletionRequest, WebSearchHit } from "@/lib/ai";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { OwnerFacingError } from "@/lib/errors";
import { testProfile } from "@/test/fixtures";
import { PLATFORM_DATA, PLATFORM_ORDER } from "@/data/website-platforms";
import { checkOptions, explainOption, explanationKey, findMoreOptions, hasMoney, isCurrentExplanation, platformFacts, withoutMoney } from "./options";

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
        ? JSON.stringify({ overview: "A store builder.", whatItsLike: "Most owners set it up in 4 days.", goodFit: "You ship.", watchOut: "Easy.", stillNeed: ["A web address"] })
        : "",
    );
    const explanation = await explainOption(model, { profile: testProfile(), name: "Shopify", facts: { trial: "3 days free" } });
    expect(explanation.flags).toEqual(["Check “4”: it isn’t in this option’s facts."]);
    expect(explanation.factsKey).toBe(explanationKey(testProfile(), { trial: "3 days free" }));
  });

  it("drops every amount of money the model writes, since money comes only from code", async () => {
    const model = createMockProvider((request: CompletionRequest) =>
      request.responseFormat
        ? JSON.stringify({
            overview: "A store builder. The first year is $29 × 12 = $348.",
            whatItsLike: "Easy to start.",
            goodFit: "You ship. Cards cost 2.9% each.",
            watchOut: "Apps add up to 40 dollars. Designs are limited.",
            stillNeed: ["A web address", "Email for $6 a month"],
          })
        : "",
    );
    const explanation = await explainOption(model, { profile: testProfile(), name: "Shopify", facts: platformFacts(PLATFORM_DATA.shopify) });
    expect(explanation).toMatchObject({ overview: "A store builder.", goodFit: "You ship.", watchOut: "Designs are limited.", stillNeed: ["A web address"] });
    expect(JSON.stringify(explanation)).not.toMatch(/\$|%|dollars/);
  });

  it("gives the model a built-in option's facts with no prices", () => {
    for (const id of PLATFORM_ORDER) expect(hasMoney(JSON.stringify(platformFacts(PLATFORM_DATA[id])))).toBe(false);
    expect(withoutMoney("Free to start. Then $49 a month. No ads.")).toBe("Free to start. No ads.");
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
      facts: { oneLine: "A free store.", youDo: ["Add your items"] },
    });
    expect(explanation).toMatchObject({ simulated: true, stillNeed: ["Add your items"] });
    expect(explanation.overview).toMatch(/Practice mode/);
  });
});
