import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { testProfile } from "@/test/fixtures";
import { draftBusinessPlan, knownNumbers, numberFlags, SECTION_KEYS } from "./business-plan";

describe("knownNumbers and numberFlags", () => {
  it("reads money with commas as the same number given without them", () => {
    const known = knownNumbers('{"costs": "about 1200 for an oven"}');
    expect(known.has("1200")).toBe(true);
    expect(numberFlags("The oven costs $1,200.", known)).toEqual([]);
  });

  it("matches numbers given with commas or decimals", () => {
    const known = knownNumbers("We charge $3.50 a loaf and hope for $2,500 a month.");
    expect(numberFlags("Loaves are $3.5 each; our goal is 2500 a month.", known)).toEqual([]);
  });

  it("checks percentages by their number", () => {
    const known = knownNumbers("Margin around 40");
    expect(numberFlags("We keep 40% of each sale.", known)).toEqual([]);
    expect(numberFlags("We keep 45% of each sale.", known)).toEqual(["Check “45%”: it isn’t in your answers."]);
  });

  it("flags each number the owner didn't give, once", () => {
    const known = knownNumbers("We sell at 2 markets.");
    expect(numberFlags("Sales of $5,000 at 2 markets, or $5,000 a month.", known)).toEqual([
      "Check “$5,000”: it isn’t in your answers.",
    ]);
  });
});

describe("draftBusinessPlan", () => {
  it("drafts every section in practice mode, with placeholders and no made-up numbers", async () => {
    const sections = await draftBusinessPlan(createMockProvider(), {
      profile: testProfile({ name: "Rise Bakery", location: { city: "Columbus" } }),
      answers: { customers: "Families at the Saturday market", prices: "Sourdough loaves for $9" },
      steps: [
        { title: "Get an EIN", done: true },
        { title: "Register your business name", done: false },
      ],
      structure: "LLC",
    });

    expect(sections.map((section) => section.key)).toEqual([...SECTION_KEYS]);
    const body = (key: string) => sections.find((section) => section.key === key)!.body;
    expect(body("summary")).toContain("Rise Bakery is a new business in Columbus, Ohio.");
    expect(body("offering")).toContain("Sourdough loaves for $9");
    expect(body("customers")).toBe("Families at the Saturday market");
    expect(body("money")).toContain("[Add your starting costs]");
    expect(body("money")).toContain("[Add your monthly sales goal]");
    expect(body("legal")).toContain("Business structure: LLC.");
    expect(body("legal")).toContain("Get an EIN (done); Register your business name");
    expect(sections.flatMap((section) => section.flags)).toEqual([]);
  });

  it("keeps placeholders when nothing is known yet", async () => {
    const sections = await draftBusinessPlan(createMockProvider(), {
      profile: testProfile({ name: null, description: "" }),
      answers: {},
      steps: [],
      structure: null,
    });
    const text = sections.map((section) => section.body).join("\n");
    expect(text).toContain("[Add your business name]");
    expect(text).toContain("[Describe the business in a sentence]");
    expect(text).toContain("[Run Find my requirements to list them]");
    expect(text).toContain("Business structure: not decided yet.");
  });

  it("flags a number in a model's draft that the owner never gave", async () => {
    const model = createMockProvider(() =>
      JSON.stringify({ sections: [{ key: "money", heading: "Money", body: "We expect $40,000 in sales and a 30% margin." }] }),
    );
    const [money] = await draftBusinessPlan(model, { profile: testProfile(), answers: {}, steps: [], structure: null });
    expect(money.flags).toEqual(["Check “$40,000”: it isn’t in your answers.", "Check “30%”: it isn’t in your answers."]);
  });
});
