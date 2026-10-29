import { describe, expect, it } from "vitest";
import { type BusinessProfile, businessProfileSchema } from "@/lib/domain";
import { applyWhatIf, suggestPath } from "@/lib/structure/suggest";
import { answersToProfile, EMPTY_ANSWERS, groupRows, type IntakeAnswers, type Marks, stepsFor, summarize, withDefaults } from "./answers";
import { profileImpact } from "./impact";
import { placeOptions } from "./places";
import { questionPath, questionsFor } from "./questions";

// The three beginners from the spec, answering only by clicking and picking (places are real; the businesses are test fixtures).

type Click = Partial<IntakeAnswers>;

// Each click goes through the same defaults the wizard applies, then continuing confirms them
function answer(clicks: Click[]): { answers: IntakeAnswers; marks: Marks; asked: string[] } {
  let state = { answers: EMPTY_ANSWERS, marks: {} as Marks };
  const asked = new Set<string>();
  for (const click of clicks) {
    state = withDefaults({ ...state.answers, ...click }, state.marks, state.answers);
    for (const field of questionPath(state.answers, stepsFor(state.answers))) asked.add(field);
  }
  return { ...state, asked: questionPath(state.answers, stepsFor(state.answers)).filter((field) => asked.has(field)) };
}

const baker = answer([
  { category: "baked_goods" },
  { productTags: ["cookies", "breads", "cakes"] },
  { state: "OH", county: "Franklin", city: "Columbus" },
  { insideCityLimits: "unsure" },
  { owners: "me" },
  { mayAddOwners: "no" },
  { name: "Rise Bakery" },
  { nameIsLegalName: "no" },
  { stage: "idea" },
  { channels: ["markets", "social_media"] },
  { handoff: ["in_person_sale", "pickup_home"] },
  { foodNeedsCold: "no" },
  { premises: "home" },
  { startupBudget: "under_1k", firstYearSales: "under_5k", takesOnDebt: "no" },
  { hiringPlans: "not_now" },
  { launchTiming: "1_3_months", experience: "first_business", goals: ["test_idea", "side_income"] },
]);

const siblings = answer([
  { category: "woodworking" },
  { productTags: ["cutting_boards", "bowls_utensils", "home_decor"] },
  { state: "NC", county: "Buncombe", city: "Asheville" },
  { insideCityLimits: "no" },
  { owners: "others", ownerCount: 2 },
  { ownerRelation: "family" },
  { noName: true },
  { stage: "selling_informally" },
  { alreadyHave: ["none"] },
  { channels: ["markets", "marketplace"] },
  { handoff: ["in_person_sale", "ship_in_state", "ship_out_of_state"] },
  { makesForKids: "no" },
  { premises: "home" },
  { startupBudget: "1k_5k", firstYearSales: "5k_25k", takesOnDebt: "unsure" },
  { hiringPlans: "not_now" },
  { goals: ["side_income", "grow"] },
]);

const boutique = answer([
  { category: "clothing_boutique" },
  { productTags: ["womens", "accessories", "vintage"] },
  { state: "TX", county: "Travis", city: "Austin" },
  { insideCityLimits: "yes" },
  { owners: "me" },
  { mayAddOwners: "unsure" },
  { name: "Thread & Thrift" },
  { nameIsLegalName: "no" },
  { stage: "idea" },
  { channels: ["own_website", "social_media"] },
  { handoff: ["pickup_home", "ship_in_state"] },
  { premises: "home" },
  { startupBudget: "1k_5k", takesOnDebt: "unsure" },
  { hiringPlans: "not_now" },
  { goals: ["full_time"] },
]);

const profileOf = (a: IntakeAnswers): BusinessProfile => businessProfileSchema.parse(answersToProfile(a));

describe("three beginner journeys", () => {
  it("are completed with clicks and short fields only, without describing the business", () => {
    for (const journey of [baker, siblings, boutique]) {
      expect(journey.answers.description).toBe("");
      expect(journey.answers.firstItems).toBe("");
      expect(() => profileOf(journey.answers)).not.toThrow();
    }
  });

  it("ask meaningfully different follow-ups", () => {
    expect(baker.asked).toEqual(expect.arrayContaining(["foodNeedsCold", "handoff", "mayAddOwners", "nameIsLegalName", "customersVisit"]));
    expect(baker.asked).not.toEqual(expect.arrayContaining(["makesForKids"]));
    expect(baker.asked).not.toContain("foodContact");
    expect(baker.asked).not.toContain("inventorySources");

    expect(siblings.asked).toEqual(expect.arrayContaining(["ownerRelation", "makesForKids", "foodContact", "alreadyHave"]));
    expect(siblings.asked).not.toContain("foodNeedsCold");
    expect(siblings.asked).not.toContain("mayAddOwners");
    expect(siblings.asked).not.toContain("nameIsLegalName");

    expect(boutique.asked).toEqual(expect.arrayContaining(["inventorySources", "makesForKids", "handoff"]));
    expect(boutique.asked).not.toContain("foodNeedsCold");
    expect(boutique.asked).not.toContain("foodContact");

    const paths = [baker, siblings, boutique].map((journey) => journey.asked.join(","));
    expect(new Set(paths).size).toBe(3);
  });

  it("title the details step for each kind of business", () => {
    expect(questionsFor("details", baker.answers).map((q) => q.field)).toEqual(["foodNeedsCold"]);
    expect(questionsFor("details", siblings.answers).map((q) => q.field)).toEqual(["makesForKids", "foodContact"]);
    expect(questionsFor("details", boutique.answers).map((q) => q.field)).toEqual(["makesForKids", "inventorySources"]);
  });

  it("fill in what picked examples clearly imply, for the owner to confirm", () => {
    // Cutting boards touch food; vintage clothing is secondhand stock
    expect(siblings.answers.foodContact).toBe("yes");
    expect(siblings.marks.foodContact).toBe("default");
    expect(boutique.answers.inventorySources).toEqual(["secondhand"]);
    // Pickup at home implies customers visit, even though the question is answered nowhere else
    expect(boutique.answers.customersVisit).toBe("yes");
    expect(groupRows(summarize(boutique.answers, { followUps: true }), boutique.marks).check.map((row) => row.label)).toEqual(
      expect.arrayContaining(["Where your stock comes from", "Customers at your home"]),
    );
  });

  it("keep “not sure” as an open question, never a no", () => {
    const profile = profileOf(baker.answers);
    expect(profile.location.insideCityLimits).toBe("unsure");
    const open = groupRows(summarize(baker.answers, { followUps: true }), baker.marks).open.map((row) => row.label);
    expect(open).toContain("Inside city limits");
    expect(suggestPath(profileOf(siblings.answers)).assumptions.join(" ")).toMatch(/lease or loan/);
  });

  it("keep “none yet” and existing registrations apart from unknown ones", () => {
    expect(profileOf(siblings.answers).alreadyHave).toEqual(["none"]);
    const registered = profileOf({ ...siblings.answers, stage: "registered", registeredAs: "partnership", alreadyHave: ["business_name", "ein"] });
    const path = suggestPath(registered);
    expect(path.keepExisting).toBe(true);
    expect(path.option).toBe("partnership");
    expect(path.name.status).toBe("done");
  });

  it("suggest different starting points, with what each rests on", () => {
    const bakerPath = suggestPath(profileOf(baker.answers));
    expect(bakerPath.option).toBe("sole_proprietorship");
    expect(bakerPath.name.status).toBe("likely");
    expect(bakerPath.alternatives.map((a) => a.option)).toContain("llc");
    expect(bakerPath.basedOn).toContain("You’re the only owner");

    const siblingsPath = suggestPath(profileOf(siblings.answers));
    expect(siblingsPath.option).toBe("llc");
    expect(siblingsPath.alternatives.map((a) => a.option)).toContain("partnership");
    expect(siblingsPath.askAProfessional.join(" ")).toMatch(/one of us leaves/);
    expect(siblingsPath.signals).toContain("Some items touch food");

    const boutiquePath = suggestPath(profileOf(boutique.answers));
    expect(boutiquePath.wouldChange).toEqual(expect.arrayContaining(["Signing a lease, taking a loan or buying on credit", "Adding a co-owner"]));
    for (const path of [bakerPath, siblingsPath, boutiquePath]) {
      expect(path.alternatives.length).toBeGreaterThan(0);
      expect(path.assumptions.join(" ")).toMatch(/official state pages/);
    }
  });

  it("compare what-ifs without changing the saved answers", () => {
    const profile = profileOf(baker.answers);
    const before = structuredClone(profile);
    const withPartner = suggestPath(applyWhatIf(profile, { owners: 2 }));
    expect(["partnership", "llc"]).toContain(withPartner.option);
    expect(suggestPath(applyWhatIf(profile, { takesOnDebt: "yes" })).option).toBe("llc");
    expect(profile).toEqual(before);
  });

  it("show what a changed location affects before it's saved", () => {
    const before = profileOf(baker.answers);
    const after = profileOf({ ...baker.answers, city: "Westerville", insideCityLimits: "" });
    const impact = profileImpact(before, after, {
      researchCheckedAt: "2026-10-27T12:00:00.000Z",
      planSteps: 6,
      structureDecision: null,
      documents: [
        { id: "doc-1", title: "Vendor license application", facts: ["profile.city", "profile.name"] },
        { id: "doc-2", title: "EIN answer sheet", facts: ["profile.name"] },
      ],
    });
    expect(impact.changes.map((change) => change.label)).toEqual(expect.arrayContaining(["Where", "Inside city limits"]));
    const effects = impact.effects.map((effect) => effect.title);
    expect(effects).toEqual(expect.arrayContaining(["Regulations", "Licenses and registrations", "Vendor license application"]));
    expect(effects).not.toContain("EIN answer sheet");
  });

  it("flag a recorded decision made with older answers", () => {
    const before = profileOf(baker.answers);
    const after = profileOf({ ...baker.answers, owners: "others", ownerCount: 2, ownerRelation: "spouse" });
    const impact = profileImpact(before, after, { researchCheckedAt: null, planSteps: 0, structureDecision: "sole_proprietorship", documents: [] });
    expect(impact.effects.map((effect) => effect.title)).toEqual(expect.arrayContaining(["Suggested structure", "Your structure decision"]));
  });
});

describe("place suggestions", () => {
  it("cover every county, fill the county from a city, and say which places have no city government", () => {
    const oh = placeOptions("OH");
    expect(oh.counties).toHaveLength(88);
    expect(oh.counties).toContain("Franklin");
    const byName = (name: string) => oh.cities.filter((city) => city.name === name);
    expect(byName("Westerville")[0]).toMatchObject({ counties: ["Delaware", "Franklin"], noCityGovernment: false });
    expect(byName("Blacklick Estates")[0]).toMatchObject({ counties: ["Franklin"], noCityGovernment: true });
    expect(placeOptions("TX").cities.find((city) => city.name === "Austin")?.counties).toContain("Travis");
    expect(placeOptions("LA").counties).toContain("Orleans Parish");
  });

  it("strip the Census type words from names and say how old the list is", () => {
    const tn = placeOptions("TN").cities.map((city) => city.name);
    expect(tn).toContain("Nashville-Davidson");
    expect(tn.some((name) => / (city|town|CDP)$/.test(name))).toBe(false);
    expect(placeOptions("OH").source).toMatch(/Census Bureau’s 2020 Census lists .*updated Feb 2023/);
  });
});
