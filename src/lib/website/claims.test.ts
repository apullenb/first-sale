import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { testProfile } from "@/test/fixtures";
import { claimConflicts, type ClaimRecords, siteClaimRecords } from "./claims";
import { draftWebsite } from "./content";
import { defaultDesign } from "./site/design";
import type { WebsiteCopy } from "./types";

const blank: WebsiteCopy = {
  headline: "Maple Crumb Test Bakery",
  subheadline: "",
  intro: "",
  about: "",
  offerings: [],
  howToBuy: "Order by message for pickup or nearby delivery.",
  contact: "",
  faq: [],
  seoTitle: "",
  seoDescription: "",
};
const records = (patch: Partial<ClaimRecords> = {}): ClaimRecords => ({
  prices: [{ name: "Cookie six-pack", cents: 1200 }],
  handoff: ["pickup_home", "local_delivery"],
  ...patch,
});

describe("price claims", () => {
  it("flags an unrestricted “under $10” beside a $12 item", () => {
    const copy = { ...blank, faq: [{ question: "What do things cost?", answer: "Everything is priced under $10." }] };
    expect(claimConflicts(copy, records())).toEqual(["Answer 1 says “under $10”, but Cookie six-pack is $12. Change the words or the price."]);
  });

  it("lets a hedged claim stand while it's still true", () => {
    const copy = { ...blank, intro: "Most treats are under $10." };
    expect(claimConflicts(copy, records({ prices: [{ name: "Cookie six-pack", cents: 1200 }, { name: "Brownie", cents: 400 }] }))).toEqual([]);
    expect(claimConflicts(copy, records())).toHaveLength(1);
  });

  it("treats “under” as strict and “up to” as inclusive", () => {
    expect(claimConflicts({ ...blank, intro: "All items under $12." }, records())).toHaveLength(1);
    expect(claimConflicts({ ...blank, intro: "All items up to $12." }, records())).toEqual([]);
    expect(claimConflicts({ ...blank, intro: "Boxes $12 or less." }, records())).toEqual([]);
  });

  it("flags a “starting at” price above the cheapest item", () => {
    const copy = { ...blank, subheadline: "Boxes starting at $15." };
    expect(claimConflicts(copy, records())[0]).toMatch(/starting at \$15.*Cookie six-pack is \$12/);
  });

  it("ignores [bracketed] notes and sites without prices", () => {
    expect(claimConflicts({ ...blank, intro: "[Add if items are under $10]" }, records())).toEqual([]);
    expect(claimConflicts({ ...blank, intro: "Everything under $10." }, records({ prices: [] }))).toEqual([]);
  });

  it("reads the site's prices, saved products included", () => {
    const copy = { ...blank, offerings: [{ name: "Cookie six-pack", description: "" }] };
    const built = siteClaimRecords(copy, [{ id: "p1", name: "Cookie six-pack", description: "", priceCents: 1200 }], defaultDesign("#336699"), ["pickup_home"]);
    expect(built.prices).toEqual([{ name: "Cookie six-pack", cents: 1200 }]);
  });
});

describe("ordering claims", () => {
  it("flags pickup-only words when nearby delivery was chosen", () => {
    const copy = { ...blank, howToBuy: "Pickup only, at our Denton kitchen." };
    expect(claimConflicts(copy, records())).toEqual(
      expect.arrayContaining([
        "How to buy says there’s no delivery, but you said you deliver nearby. Change the words or your answers.",
        "How to buy doesn’t mention local delivery, which you offer. Say how delivery works.",
      ]),
    );
  });

  it("flags ways the owner didn't pick, but not questions", () => {
    const copy = { ...blank, faq: [{ question: "Do you ship?", answer: "Yes, we ship nationwide." }] };
    expect(claimConflicts(copy, records())).toEqual(["Answer 1 offers shipping, but your answers don’t say you ship. Change the words or your answers."]);
    expect(claimConflicts({ ...blank, intro: "Do you ship?" }, records())).toEqual([]);
  });

  it("asks How to buy to name each chosen way", () => {
    expect(claimConflicts({ ...blank, howToBuy: "Message us to order." }, records())).toEqual([
      "How to buy doesn’t mention local delivery, which you offer. Say how delivery works.",
      "How to buy doesn’t mention pickup, which you offer. Say how pickup works.",
    ]);
  });

  it("says nothing when the owner hasn't decided", () => {
    expect(claimConflicts({ ...blank, howToBuy: "Pickup only." }, records({ handoff: ["unsure"] }))).toEqual([]);
  });
});

describe("drafting from saved facts", () => {
  const profile = testProfile({
    name: "Maple Crumb Test Bakery",
    category: "baked_goods",
    premises: "home",
    productTags: ["cookies", "breads"],
    location: { city: "Denton", state: "TX" },
    channels: ["markets", "own_website", "social_media"],
    handoff: ["pickup_home", "local_delivery"],
    startupBudget: "under_1k",
  });
  const facts = { profile, platform: "first_sale" as const, details: [], planAnswers: { prices: "Most items under $10" }, products: [{ name: "Cookie six-pack", description: "Six chewy cookies", priceCents: 1200 }] };

  it("uses the product catalog and chosen delivery in practice mode, with no conflicts", async () => {
    const content = await draftWebsite(createMockProvider(), facts);
    expect(content.offerings[0]).toEqual({ name: "Cookie six-pack", description: "Six chewy cookies" });
    expect(content.howToBuy).toMatch(/delivery/i);
    expect(content.howToBuy).toMatch(/pickup/i);
    expect(content.intro).toMatch(/home bakery/);
    expect(claimConflicts(content, records())).toEqual([]);
  });

  it("swaps category words a draft uses for what the bakery sells", async () => {
    const generic: WebsiteCopy = { ...blank, intro: "Fresh food made in Denton." };
    const model = createMockProvider((request) => (request.responseFormat ? JSON.stringify(generic) : ""));
    expect((await draftWebsite(model, facts)).intro).toBe("Cookie six-pack, cookies and bread and rolls made in Denton.");
  });
});
