import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { testProfile } from "@/test/fixtures";
import { businessPlanPdf, draftBusinessPlan, knownNumbers, numberFlags, planVersion, SECTION_KEYS } from "./business-plan";
import { knownFacts } from "./plan-facts";

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
    expect(numberFlags("Sales of $5,000 at 2 markets, or $5,000 a month.", known)).toEqual(["Check “$5,000”: it isn’t in your answers."]);
  });
});

const profile = testProfile({
  name: "Rise & Shine Bakery",
  location: { state: "TX", county: "Travis", city: "Austin" },
  category: "baked_goods",
  productTags: ["cookies"],
  channels: ["markets"],
  launchDate: "2027-01-15",
});
const facts = knownFacts({ profile, structure: null, products: [], brand: null, marketing: null, fees: null, steps: [], progress: null, purpose: null }).map(({ key, label, value }) => ({ key, label, value }));

describe("draftBusinessPlan", () => {
  it("drafts every section in practice mode, with formal headings from code and no made-up numbers", async () => {
    const sections = await draftBusinessPlan(createMockProvider(), {
      facts,
      answers: [
        { key: "customers", question: "Who are your main customers?", answer: ["Neighbors and local families", "office parties"] },
        { key: "prices", question: "What will most of your items sell for?", answer: ["Under $10"] },
        { key: "funding", question: "Where will the starting money come from?", answer: ["Not sure yet"] },
      ],
      steps: [
        { title: "Get an EIN", done: true, conditional: false },
        { title: "Register your business name", done: false, conditional: true },
      ],
      sells: "products",
    });

    expect(sections.map((section) => section.key)).toEqual([...SECTION_KEYS]);
    expect(sections.map((section) => section.heading)).toEqual([
      "Executive Summary",
      "Company Description",
      "Products",
      "Market and Customers",
      "Marketing and Sales",
      "Operations",
      "Management and Staffing",
      "Legal Structure and Permits",
      "Financial Plan",
      "Milestones",
    ]);
    const body = (key: string) => sections.find((section) => section.key === key)!.body;
    expect(body("summary")).toContain("Rise & Shine Bakery is a new small business based in Austin, Travis County, Texas.");
    expect(body("summary")).toContain("neighbors and local families, as well as office parties");
    expect(body("summary")).toContain("first sale by January 15, 2027");
    expect(body("offering")).toContain("under $10");
    expect(body("legal")).toContain("Completed: Get an EIN. Still to do: Register your business name (if it applies).");
    // "Not sure yet" stays an open question
    expect(body("money")).toContain("[Say where the starting money will come from]");
    expect(sections.flatMap((section) => section.flags)).toEqual([]);
  });

  it("names services in the heading for a service business", async () => {
    const sections = await draftBusinessPlan(createMockProvider(), { facts, answers: [], steps: [], sells: "services" });
    expect(sections.find((section) => section.key === "offering")?.heading).toBe("Services");
  });

  it("keeps notes in brackets when nothing is known yet", async () => {
    const sections = await draftBusinessPlan(createMockProvider(), { facts: [], answers: [], steps: [], sells: null });
    const text = sections.map((section) => section.body).join("\n");
    expect(text).toContain("[Add your town and state]");
    expect(text).toContain("[Describe your main customers]");
    expect(text).toContain("[List the licenses and registrations the business needs. Find what applies to you to list them.]");
    expect(sections.find((section) => section.key === "offering")?.heading).toBe("Products");
  });

  it("flags a number in a model's draft that the owner never gave", async () => {
    const model = createMockProvider(() => JSON.stringify({ sections: [{ key: "money", body: "We expect $40,000 in sales and a 30% margin." }] }));
    const [money] = await draftBusinessPlan(model, { facts, answers: [], steps: [], sells: "products" });
    expect(money.heading).toBe("Financial Plan");
    expect(money.flags).toEqual(["Check “$40,000”: it isn’t in your answers.", "Check “30%”: it isn’t in your answers."]);
  });
});

describe("planVersion and businessPlanPdf", () => {
  const sections = [
    { key: "summary", heading: "Executive Summary", body: "First paragraph.\n\nSecond paragraph.", flags: [] },
    { key: "money", heading: "Financial Plan", body: "Budget under $1,000.", flags: [] },
  ];

  it("changes the version whenever the text does", () => {
    expect(planVersion(sections)).toBe(planVersion(sections.map((section) => ({ ...section }))));
    expect(planVersion(sections)).not.toBe(planVersion([{ ...sections[0], body: "Changed." }, sections[1]]));
    expect(planVersion(sections)).not.toBe(planVersion([{ ...sections[0], heading: "Summary" }, sections[1]]));
  });

  it("numbers the sections and keeps paragraphs apart", () => {
    const spec = businessPlanPdf("Business plan for Rise & Shine Bakery", sections, new Date("2026-10-29T12:00:00Z"), true);
    expect(spec.title).toBe("Rise & Shine Bakery: Business Plan");
    expect(spec.subtitle).toBe("Prepared October 29, 2026");
    expect(spec.notice).toMatch(/Practice draft/);
    expect(spec.blocks).toEqual([
      { heading: "1. Executive Summary", paragraphs: ["First paragraph.", "Second paragraph."] },
      { heading: "2. Financial Plan", paragraphs: ["Budget under $1,000."] },
    ]);
  });
});
