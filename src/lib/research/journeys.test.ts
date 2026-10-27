import { describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import type { BusinessProfile } from "@/lib/domain";
import { nextActions, planCosts } from "@/lib/rules/next-action";
import { testProfile } from "@/test/fixtures";
import { texasPage } from "@/test/texas-pages";
import { answerChanges } from "./changes";
import { type ResearchResult, researchRequirements } from "./requirements";

// The three demo journeys, start to finish in practice mode, against the real Texas, Travis County and Austin page text

const NOW = new Date("2026-10-27T15:00:00Z");
const html = (body: string) => new Response(`<html><body>${body}</body></html>`, { headers: { "Content-Type": "text/html" } });

const FEDERAL: Record<string, string> = {
  "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number":
    "<main><h1>Get an EIN</h1><p>Use this tool to get an EIN directly from the IRS in minutes for free.</p></main>",
  "https://www.irs.gov/businesses/small-businesses-self-employed/business-structures":
    "<main><h1>Business structures</h1><p>Before you register your business, choose a business structure that fits your goals.</p></main>",
  "https://www.sba.gov/counseling/launch-your-business/": `<main>${[
    ["business-structure", "Choose a business structure", "Your structure affects how much you pay in taxes."],
    ["business-name", "Choose your business name", "There are four different ways to register your business name."],
    ["register-business", "Register your business", "Most small businesses register with their state."],
    ["business-location", "Pick your business location", "Check zoning laws before you sign a lease."],
    ["licenses-permits", "Apply for licenses and permits", "Find out if you need a federal license or permit for what you do."],
    ["tax-ids", "Get federal and state tax ID numbers", "Your EIN is your federal tax ID."],
  ]
    .map(([id, heading, text]) => `<h2 id="${id}">${heading}</h2><p>${text}</p>`)
    .join("")}</main>`,
  "https://www.sba.gov/counseling/manage-your-business/": `<main><h2 id="hire-and-manage">Hire and manage employees</h2><p>Set up payroll before you hire.</p></main>`,
};

function sites(options: { texasDown?: boolean } = {}) {
  return vi.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (FEDERAL[address]) return html(FEDERAL[address]);
    return (options.texasDown ? undefined : await texasPage(address)) ?? new Response("Forbidden", { status: 403 });
  });
}

const austin = { state: "TX" as const, county: "Travis", city: "Austin", insideCityLimits: "yes" as const };

const baker = testProfile({
  name: "Rise Bakery",
  nameIsLegalName: "no",
  category: "baked_goods",
  productTags: ["cookies", "breads"],
  firstItems: "Cookies and bread",
  location: austin,
  offeringKinds: ["food"],
  foodNeedsCold: "unsure",
  channels: ["in_person", "social_media"],
  handoff: ["pickup_home"],
  premises: "home",
  hiringPlans: "not_now",
});

const woodworkers = testProfile({
  name: "Two Brothers Woodshop",
  nameIsLegalName: "no",
  category: "woodworking",
  firstItems: "Cutting boards and bowls",
  location: austin,
  owners: { count: 2 },
  ownerRelation: "family",
  offeringKinds: ["handmade"],
  foodContact: "yes",
  makesForKids: "no",
  channels: ["markets", "marketplace"],
  handoff: ["in_person_sale", "ship_in_state", "ship_out_of_state"],
  premises: "home",
  hiringPlans: "not_now",
});

const boutique = testProfile({
  name: "Thread & Co",
  nameIsLegalName: "no",
  category: "clothing_boutique",
  firstItems: "Women’s clothing",
  location: austin,
  offeringKinds: ["resale"],
  inventorySources: ["new_wholesale", "secondhand"],
  channels: ["own_website", "social_media"],
  handoff: ["pickup_home", "ship_in_state"],
  premises: "home",
  hiringPlans: "not_now",
  alreadyHave: ["ein"],
});

const LLC = [{ key: "structure_choice", value: "llc" }];

async function run(profile: BusinessProfile, options: { details?: { key: string; value: string }[]; texasDown?: boolean } = {}): Promise<ResearchResult> {
  return researchRequirements(createMockProvider(), profile, { fetchImpl: sites(options), now: NOW, details: options.details });
}

const byKey = (result: ResearchResult) => new Map(result.requirements.map((requirement) => [requirement.key, requirement]));

describe("demo journeys", () => {
  it("gives the home baker Texas cottage food rules and a food-tax condition, all sourced from official pages", async () => {
    const result = await run(baker);
    const found = byKey(result);

    // What Texas doesn't require of a home kitchen, and what it does
    expect(found.get("cottage-food")).toMatchObject({ verification: "sourced", status: "verified", level: "state" });
    expect(found.get("cottage-food")!.evidence).toContain("Health departments do not have regulatory authority");
    expect(found.get("cottage-labels")).toMatchObject({ verification: "sourced", status: "verified" });
    expect(found.get("cottage-labels")!.evidence).toContain("THIS PRODUCT WAS PRODUCED IN A PRIVATE RESIDENCE");
    expect(found.get("food-handler")).toMatchObject({ verification: "sourced", status: "verified" });
    // Not sure whether the food needs refrigeration: registering is only "if"
    expect(found.get("cottage-registration")).toMatchObject({ verification: "sourced", status: "conditional" });
    // Bakery items aren't always taxed, so the permit depends on what's sold
    expect(found.get("sales-tax-permit")).toMatchObject({ verification: "sourced", status: "conditional", feeUsd: 0 });
    expect(found.get("sales-tax-permit")!.sourceIds).toContain("tx-cpa-bakery");
    // Undecided structure: the county or the Secretary of State, depending on it
    expect(found.get("assumed-name-county")).toMatchObject({ verification: "sourced", status: "conditional", level: "county", feeUsd: 23 });
    expect(found.get("assumed-name-county")!.conditions[0]).toMatch(/sole proprietorship or a partnership/);
    expect(found.get("assumed-name-state")).toMatchObject({ verification: "sourced", status: "conditional", feeUsd: 25 });
    // One owner, not hiring: an EIN is a choice, not a requirement
    expect(found.get("ein")).toMatchObject({ status: "optional", feeUsd: 0 });
    expect(found.get("llc-formation")).toMatchObject({ verification: "sourced", status: "conditional", fitsStructure: true, feeUsd: 300 });
    expect(found.get("llc-formation")!.conditions[0]).toMatch(/Only if you set up as an LLC/);
    expect(found.get("home-business")).toMatchObject({ verification: "sourced", status: "verified", level: "city" });
    expect(found.get("home-business")!.evidence).toContain("The City of Austin cannot prohibit or require permits");
    expect(result.coverage).toContainEqual(expect.objectContaining({ category: "food", level: "state", state: "confirmed" }));
  });

  it("gives the sibling woodworkers an EIN, a sales tax permit and rules outside coverage, and no food rules", async () => {
    const result = await run(woodworkers);
    const found = byKey(result);

    expect(found.get("ein")).toMatchObject({ status: "verified", verification: "sourced" });
    expect(found.get("ein")!.whyItApplies).toMatch(/more than one owner/);
    expect(found.get("sales-tax-permit")).toMatchObject({ status: "verified", verification: "sourced", feeUsd: 0 });
    expect(found.get("assumed-name-county")!.whyItApplies).toMatch(/50 cents for each other owner/);
    expect(found.get("food-contact")).toMatchObject({ status: "outside_coverage" });
    expect(found.get("other-states-tax")).toMatchObject({ status: "outside_coverage", timing: "later" });
    expect(found.get("vendor-permit")).toMatchObject({ verification: "needs_verification" });
    expect(found.get("structure")).toMatchObject({ needsProfessional: true });
    expect(found.has("cottage-food")).toBe(false);
    expect(found.has("cottage-labels")).toBe(false);
    expect(result.coverage.some((cell) => cell.category === "food")).toBe(false);
  });

  it("gives the boutique owner who chose an LLC a formation step first, and notes the EIN they have", async () => {
    const result = await run(boutique, { details: LLC });
    const found = byKey(result);

    expect(result.structure).toBe("llc");
    expect(found.get("llc-formation")).toMatchObject({ status: "verified", verification: "sourced", feeUsd: 300 });
    expect(found.get("assumed-name-state")).toMatchObject({ status: "verified", verification: "sourced", feeUsd: 25 });
    expect(found.get("assumed-name-county")).toMatchObject({ fitsStructure: false });
    expect(found.get("franchise-tax")).toMatchObject({ status: "verified", verification: "sourced", deadline: "due May 15", timing: "later" });
    expect(found.get("ein")).toMatchObject({ status: "verified" });
    expect(found.get("ein")!.alreadyHave).toMatch(/already have an EIN/);
    expect(found.get("sales-tax-permit")).toMatchObject({ status: "verified" });
    // The IRS says to form the LLC before applying for an EIN; Texas filings name the LLC
    const plan = new Map(result.plan.map((step, index) => [step.key, { ...step, index }]));
    expect(plan.get("ein")!.prerequisites).toContain("llc-formation");
    expect(plan.get("sales-tax-permit")!.prerequisites).toContain("llc-formation");
    expect(plan.get("llc-formation")!.index).toBeLessThan(plan.get("ein")!.index);
    expect(plan.has("assumed-name-county")).toBe(false);
  });

  it("produces different requirements and plans for the three businesses", async () => {
    const [a, b, c] = await Promise.all([run(baker), run(woodworkers), run(boutique, { details: LLC })]);
    const keys = (result: ResearchResult) => result.requirements.map((requirement) => requirement.key).sort().join(",");
    expect(new Set([keys(a), keys(b), keys(c)]).size).toBe(3);
    const statuses = (result: ResearchResult) => result.plan.map((step) => `${step.key}:${step.requirementStatus}`).join(",");
    expect(new Set([statuses(a), statuses(b), statuses(c)]).size).toBe(3);
  });

  it("leaves out formation steps for a structure the owner ruled out, but keeps them on record", async () => {
    const result = await run(baker, { details: [{ key: "structure_choice", value: "sole_proprietorship" }] });
    const found = byKey(result);
    expect(found.get("llc-formation")).toMatchObject({ fitsStructure: false });
    expect(found.get("assumed-name-county")).toMatchObject({ status: "verified", fitsStructure: true });
    expect(result.plan.some((step) => step.key === "llc-formation" || step.key === "assumed-name-state" || step.key === "franchise-tax")).toBe(false);
  });
});

describe("uncertainty, changes and missing information", () => {
  it("treats 'not sure' as unknown and settles it once the owner answers", async () => {
    const cold = byKey(await run({ ...baker, foodNeedsCold: "yes" }));
    expect(cold.get("cottage-registration")).toMatchObject({ status: "verified", conditions: [] });
    expect(cold.get("cottage-registration")!.evidence).toMatch(/time and temperature control for safety \(TCS\) foods must register/);

    // Registering is a choice when nothing needs refrigeration
    const notCold = byKey(await run({ ...baker, foodNeedsCold: "no" }));
    expect(notCold.get("cottage-registration")).toMatchObject({ status: "optional", verification: "sourced" });
    expect(notCold.get("cottage-registration")!.evidence).toMatch(/instead of their home address/);
  });

  it("makes city rules conditional until the owner confirms they're inside city limits", async () => {
    const unsure = byKey(await run({ ...baker, location: { ...austin, insideCityLimits: "unsure" } }));
    expect(unsure.get("home-business")).toMatchObject({ status: "conditional" });
    expect(unsure.get("home-business")!.conditions.join(" ")).toMatch(/inside Austin city limits/);
  });

  it("asks a Texas owner outside Travis County to check with their own county clerk", async () => {
    const found = byKey(await run({ ...baker, location: { state: "TX", county: "Williamson", city: "Round Rock", insideCityLimits: "yes" } }));
    expect(found.get("assumed-name-county")).toMatchObject({ verification: "needs_verification", agency: "Your county clerk" });
    expect(found.get("assumed-name-state")).toMatchObject({ verification: "sourced" });
    expect(found.get("home-business")).toMatchObject({ verification: "needs_verification" });
  });

  it("drops Texas's rules when the business moves out of state, and flags the change for a re-check", async () => {
    const moved = { ...baker, location: { state: "MI" as const, county: "Wayne", city: "Detroit", insideCityLimits: "yes" as const } };
    const result = await run(moved);
    const found = byKey(result);
    expect(found.has("cottage-labels")).toBe(false);
    expect(found.has("assumed-name-county")).toBe(false);
    expect(found.get("sales-tax")).toMatchObject({ verification: "needs_verification", status: "needs_confirmation" });
    expect(result.pages.some((page) => /texas\.gov|traviscountytx\.gov|austintexas\.gov/.test(page.url))).toBe(false);

    const changes = answerChanges(baker, moved, null, null);
    expect(changes[0]).toMatchObject({ what: "Where your business is", recheck: true });
    expect(changes[0].now).toBe("Detroit, Wayne County, Michigan (inside city limits)");
  });

  it("never reads a site that couldn't be reached as 'no requirement'", async () => {
    const result = await run(baker, { texasDown: true });
    expect(result.unread.map((source) => source.id)).toContain("tx-dshs-cottage");
    expect(result.coverage).toContainEqual(expect.objectContaining({ category: "food", level: "state", state: "unreadable" }));
    expect(result.coverage).toContainEqual(expect.objectContaining({ category: "licenses", level: "city", state: "unreadable" }));
    expect(result.coverage).toContainEqual(expect.objectContaining({ category: "licenses", level: "county", state: "not_searched" }));
    // The food rules fall back to a gap for the owner to confirm, never to nothing
    expect(byKey(result).get("cottage-food")).toMatchObject({ verification: "needs_verification", status: "needs_confirmation" });
  });

  it("puts what's ready first, in parallel, and counts each fee once", async () => {
    const result = await run(boutique, { details: LLC });
    const steps = result.plan.map((step) => ({ ...step, status: "todo" as const }));
    const actions = nextActions(steps);
    expect(actions.waiting.map((each) => each.step.key)).toEqual(expect.arrayContaining(["ein", "sales-tax-permit", "assumed-name-state"]));
    expect(actions.now.map((step) => step.key)).toEqual(expect.arrayContaining(["structure", "home-business"]));
    const costs = planCosts(steps);
    // Formation, the assumed name, and a free permit and EIN
    expect(costs.startupCents).toBe(30000 + 2500);
    expect(costs.unknown).toContain("General business license");
  });
});

describe("review fixes", () => {
  it("keeps unsure answers as maybes: hiring and children's products show up, conditional", async () => {
    const result = await run({ ...woodworkers, makesForKids: "unsure", helpKinds: ["unsure"] });
    const found = byKey(result);
    expect(found.get("childrens-products")).toMatchObject({ status: "outside_coverage" });
    expect(found.get("childrens-products")!.whyItApplies).toMatch(/weren’t sure/);
    expect(found.get("payroll")).toMatchObject({ status: "conditional" });
    expect(result.coverage.some((cell) => cell.category === "activity")).toBe(true);
  });

  it("sends a newly registered business back for a re-check, not just a re-plan", () => {
    const changes = answerChanges(boutique, { ...boutique, stage: "registered", registeredAs: "llc" }, null, "llc");
    expect(changes.find((change) => change.what === "What you’ve already done")).toMatchObject({ recheck: true });
  });
});
