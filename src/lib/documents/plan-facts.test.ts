import { describe, expect, it } from "vitest";
import type { BusinessProfile } from "@/lib/domain";
import { testProfile } from "@/test/fixtures";
import { answerText, cleanAnswer, knownFacts, type PlanSources, planQuestions, restoreAnswers, sellsOf, withOverrides } from "./plan-facts";

const bakery = testProfile({
  name: "Rise & Shine Bakery",
  location: { state: "TX", county: "Travis", city: "Austin" },
  category: "baked_goods",
  productTags: ["cookies", "breads"],
  offeringKinds: ["food"],
  channels: ["markets"],
});

const lawnCare = testProfile({
  name: "Green Edge Lawn Care",
  location: { state: "TX", county: "Travis", city: "Austin" },
  category: "home_services",
  productTags: ["lawn"],
  offeringKinds: ["services"],
  channels: ["in_person"],
});

function sources(profile: BusinessProfile, more: Partial<PlanSources> = {}): PlanSources {
  return { profile, structure: null, products: [], brand: null, marketing: null, fees: null, steps: [], progress: null, purpose: null, ...more };
}

function questionsFor(profile: BusinessProfile, more: Partial<PlanSources> = {}) {
  const known = knownFacts(sources(profile, more)).map((fact) => fact.key);
  return planQuestions({ profile, known });
}

const allText = (questions: ReturnType<typeof planQuestions>) =>
  questions.flatMap((question) => [question.title, question.why, question.otherHint, ...question.options.map(([, label]) => label)]).join("\n");

describe("sellsOf", () => {
  it("reads products, services or both from the owner's answers", () => {
    expect(sellsOf(bakery)).toBe("products");
    expect(sellsOf(lawnCare)).toBe("services");
    expect(sellsOf(testProfile({ offeringKinds: ["handmade", "services"] }))).toBe("both");
  });

  it("asks when the business is “something else”, and uses the answer", () => {
    const other = testProfile({ offeringKinds: ["other"], category: "other" });
    expect(sellsOf(other)).toBeNull();
    expect(planQuestions({ profile: other, known: [] })[0].key).toBe("sells");
    expect(sellsOf(other, { sells: { picks: ["services"], other: null } })).toBe("services");
  });
});

describe("planQuestions", () => {
  it("never asks a service business about products, stock or shelves", () => {
    const questions = questionsFor(lawnCare);
    const keys = questions.map((question) => question.key);
    expect(keys).toEqual(expect.arrayContaining(["customers", "different", "pricing", "prices", "service_area", "costs", "funding"]));
    expect(keys).not.toContain("supplies");
    expect(allText(questions)).not.toMatch(/stock|shel(f|ves)|inventory|product|item|booth|packaging|ingredient/i);
    expect(questions.find((question) => question.key === "prices")?.title).toBe("About what will a typical visit cost a customer?");
    expect(allText(questions)).toMatch(/Mower, trimmer and blower/);
  });

  it("never asks a bakery about service areas, crews or how it charges for work", () => {
    const questions = questionsFor(bakery);
    const keys = questions.map((question) => question.key);
    expect(keys).toEqual(expect.arrayContaining(["customers", "different", "prices", "supplies", "costs", "funding", "background"]));
    expect(keys).not.toContain("service_area");
    expect(keys).not.toContain("pricing");
    expect(allText(questions)).not.toMatch(/crew|service area|per visit|by the hour|appointment/i);
    expect(questions.find((question) => question.key === "supplies")?.title).toBe("Where will you buy your ingredients?");
  });

  it("asks a business that does both about prices, how it charges and where it works", () => {
    const keys = questionsFor(testProfile({ offeringKinds: ["handmade", "services"], category: "crafts" })).map((question) => question.key);
    expect(keys).toEqual(expect.arrayContaining(["prices", "pricing", "service_area", "supplies"]));
  });

  it("asks a shop where its stock comes from only when it doesn't know", () => {
    const shop = testProfile({ offeringKinds: ["resale"], category: "clothing_boutique", channels: ["storefront"] });
    expect(questionsFor(shop).find((question) => question.key === "supplies")?.title).toBe("Where will your stock come from?");
    expect(questionsFor({ ...shop, inventorySources: ["secondhand"] }).map((question) => question.key)).not.toContain("supplies");
  });

  it("skips what First Sale already knows", () => {
    const full = { ...bakery, firstYearSales: "under_5k", hiringPlans: "not_now", launchDate: "2027-01-15" } as const;
    const keys = questionsFor(full, {
      products: [{ name: "Sourdough loaf", priceCents: 900 }],
      brand: { customers: "Neighbors who want fresh bread", tagline: "", story: "" },
      marketing: { summary: "Markets first, then Instagram.", audience: "Neighbors" },
    }).map((question) => question.key);
    expect(keys).not.toContain("customers");
    expect(keys).not.toContain("prices");
    expect(keys).not.toContain("reach");
    expect(keys).not.toContain("sales_goal");
    expect(keys).not.toContain("help");
    expect(keys).not.toContain("launch");
  });

  it("asks for a sales goal, help and timing when they're missing", () => {
    const keys = questionsFor(bakery).map((question) => question.key);
    expect(keys).toEqual(expect.arrayContaining(["sales_goal", "help", "launch"]));
  });

  it("leaves out loans and credit cards for an owner who said no to debt", () => {
    const funding = (profile: BusinessProfile) => questionsFor(profile).find((question) => question.key === "funding")!.options.map(([value]) => value);
    expect(funding(bakery)).toContain("loan");
    expect(funding({ ...bakery, takesOnDebt: "no" })).not.toContain("loan");
    expect(funding({ ...bakery, takesOnDebt: "no" })).not.toContain("credit");
  });

  it("never asks for Social Security or tax id numbers", () => {
    for (const profile of [bakery, lawnCare]) expect(allText(questionsFor(profile))).not.toMatch(/social security|tax id|\bssn\b|\bein\b/i);
  });

  it("gives every question an Other hint and unique options", () => {
    for (const question of [...questionsFor(bakery), ...questionsFor(lawnCare)]) {
      expect(question.otherHint).not.toBe("");
      expect(new Set(question.options.map(([value]) => value)).size).toBe(question.options.length);
    }
  });
});

describe("cleanAnswer and answerText", () => {
  const question = questionsFor(bakery).find((each) => each.key === "funding")!;
  const single = questionsFor(bakery).find((each) => each.key === "prices")!;

  it("keeps known picks and the owner's own words", () => {
    const answer = cleanAnswer(question, { picks: ["savings", "made_up", "savings"], other: "  my  aunt " })!;
    expect(answer).toEqual({ picks: ["savings"], other: "my aunt" });
    expect(answerText(question, answer)).toBe("My own savings; my aunt");
  });

  it("keeps “Not sure yet” on its own and stores it as unsure", () => {
    expect(cleanAnswer(question, { picks: ["savings", "unsure"], other: null })).toEqual({ picks: ["unsure"], other: null });
  });

  it("takes one pick for a pick-one question, and nothing for an empty answer", () => {
    expect(cleanAnswer(single, { picks: ["under_10", "10_25"], other: null })).toEqual({ picks: ["under_10"], other: null });
    expect(cleanAnswer(single, { picks: [], other: "  " })).toBeNull();
    expect(cleanAnswer(single, { picks: [], other: "Loaves $9, cookies $3" })).toEqual({ picks: [], other: "Loaves $9, cookies $3" });
  });
});

describe("knownFacts", () => {
  it("fills in facts from saved answers, products and licenses and registrations, saying where each came from", () => {
    const facts = knownFacts(
      sources({ ...bakery, launchDate: "2027-01-15", startupBudget: "under_1k" }, {
        products: [{ name: "Sourdough loaf", priceCents: 900 }],
        fees: { confirmed: [{ title: "Food handler card", cents: 700 }], maybe: [{ title: "Form your LLC", cents: 30000 }], unconfirmed: ["Market permit"] },
        steps: [{ title: "Get an EIN", done: true, conditional: false }, { title: "Market permit", done: false, conditional: false }],
        progress: { done: 1, total: 2 },
      }),
    );
    const fact = (key: string) => facts.find((each) => each.key === key);
    expect(fact("name")?.value).toBe("Rise & Shine Bakery");
    expect(fact("place")?.value).toBe("Austin, Travis County, Texas");
    expect(fact("offering")?.value).toBe("Baked goods and sweets, including cookies, bread and rolls");
    // Intake saves the picked examples, then anything typed, in firstItems
    const typed = knownFacts(sources({ ...bakery, firstItems: "Cookies, Bread and rolls, kolaches" })).find((each) => each.key === "offering");
    expect(typed?.value).toBe("Baked goods and sweets, including cookies, bread and rolls. Kolaches");
    expect(fact("prices")).toMatchObject({ value: "Sourdough loaf, $9", source: "From your products", href: "/products" });
    expect(fact("fees")?.value).toBe("Confirmed: Food handler card ($7). Only if they apply: Form your LLC ($300). Fee not confirmed yet: Market permit");
    expect(fact("launch")?.value).toBe("January 15, 2027");
    expect(fact("budget")?.value).toBe("Under $1,000");
    expect(fact("progress")?.value).toBe("1 of 2 steps done");
    expect(fact("structure")).toMatchObject({ value: "Not decided yet", href: "/structure" });
  });

  it("uses the owner's plan-only edits and marks them", () => {
    const facts = knownFacts(sources(bakery));
    const edited = withOverrides(facts, { name: "Rise and Shine Bakehouse", place: "Austin, Travis County, Texas" });
    expect(edited.find((fact) => fact.key === "name")).toMatchObject({ value: "Rise and Shine Bakehouse", edited: true });
    // An edit back to the saved answer isn't an edit
    expect(edited.find((fact) => fact.key === "place")?.edited).toBe(false);
  });
});

describe("restoreAnswers", () => {
  const facts = knownFacts(sources(bakery));
  const basis = { profile: bakery, known: facts.map((fact) => fact.key) };
  const costs = questionsFor(bakery).find((question) => question.key === "costs")!;
  const saved = { picks: { costs: { picks: ["equipment"], other: null } }, overrides: { premises: "Home kitchen" }, was: {} };

  it("brings back picks whose wording hasn't changed", () => {
    expect(restoreAnswers(basis, facts, saved, { costs: answerText(costs, { picks: ["equipment"], other: null }) }).picks).toEqual({ costs: { picks: ["equipment"], other: null } });
  });

  it("drops a pick that now means something else, such as after a bakery becomes a lawn service", () => {
    const lawnFacts = knownFacts(sources(lawnCare));
    const restored = restoreAnswers({ profile: lawnCare, known: lawnFacts.map((fact) => fact.key) }, lawnFacts, saved, { costs: "Baking equipment and pans" });
    expect(restored.picks).toEqual({});
  });

  it("keeps a plan-only edit until its fact changes at the source", () => {
    const withWorkspace = knownFacts(sources({ ...bakery, premises: "online_only" }));
    const kept = { ...saved, overrides: { premises: "Home kitchen" }, was: { premises: "No dedicated workspace yet" } };
    expect(restoreAnswers(basis, withWorkspace, kept, {}).overrides).toEqual({ premises: "Home kitchen" });
    const moved = knownFacts(sources({ ...bakery, premises: "rented_space" }));
    expect(restoreAnswers(basis, moved, kept, {}).overrides).toEqual({});
  });
});
