import { describe, expect, it } from "vitest";
import { requirementDraft, testProfile } from "@/test/fixtures";
import { classify, placeConditions, placeGap, placeOf, structureOf } from "./applicability";

const profile = testProfile({ location: { state: "OH", county: "Franklin County", city: " Columbus ", insideCityLimits: "yes" } });
const place = placeOf(profile);
const undecided = { structure: null, from: null } as const;
const checked = (overrides: Parameters<typeof requirementDraft>[0] = {}, verification: "sourced" | "needs_verification" = "sourced") => ({
  ...requirementDraft(overrides),
  verification,
});

describe("placeOf", () => {
  it("takes the place from the owner's answers, without the word County", () => {
    expect(place).toEqual({ state: "OH", stateName: "Ohio", county: "Franklin", city: "Columbus", insideCity: "yes" });
  });

  it("treats 'unsure' and unanswered city limits as unknown, never as no", () => {
    for (const insideCityLimits of ["unsure", null] as const) {
      expect(placeOf(testProfile({ location: { city: "Columbus", insideCityLimits } })).insideCity).toBe("unknown");
    }
  });
});

describe("structureOf", () => {
  it("uses the owner's saved choice, then an existing registration, and nothing else", () => {
    const registered = testProfile({ stage: "registered", registeredAs: "llc" });
    expect(structureOf(registered, [{ key: "structure_choice", value: "partnership" }])).toEqual({ structure: "partnership", from: "decision" });
    expect(structureOf(registered, [{ key: "structure_choice", value: "undecided" }])).toEqual({ structure: "llc", from: "registered" });
    expect(structureOf(testProfile({ stage: "registered", registeredAs: "unsure" }), [])).toEqual({ structure: null, from: null });
    expect(structureOf(testProfile({ owners: { count: 1 } }), [])).toEqual({ structure: null, from: null });
  });
});

describe("classify", () => {
  it("calls a sourced requirement that fits the answers verified, and an unsourced one to confirm", () => {
    expect(classify(checked(), profile, place, undecided).status).toBe("verified");
    expect(classify(checked({}, "needs_verification"), profile, place, undecided).status).toBe("needs_confirmation");
  });

  it("keeps optional and outside-coverage apart from what's required", () => {
    expect(classify(checked({ applicability: "optional" }), profile, place, undecided).status).toBe("optional");
    expect(classify(checked({ applicability: "outside_coverage" }), profile, place, undecided).status).toBe("outside_coverage");
  });

  it("makes structure-specific steps conditional until the owner decides, then fits or rules them out", () => {
    const llc = checked({ forStructures: ["llc"], topic: "structure", level: "state" });
    const open = classify(llc, profile, place, undecided);
    expect(open).toMatchObject({ status: "conditional", fitsStructure: true });
    expect(open.conditions).toEqual(["Only if you set up as an LLC. Decide your business structure first."]);
    expect(classify(llc, profile, place, { structure: "llc", from: "decision" })).toMatchObject({ status: "verified", fitsStructure: true, conditions: [] });
    expect(classify(llc, profile, place, { structure: "sole_proprietorship", from: "decision" }).fitsStructure).toBe(false);
  });

  it("keeps the model's own condition alongside the rules'", () => {
    const result = classify(checked({ applicability: "conditional", condition: "Only if you sell taxable goods.", level: "city" }), profile, { ...place, insideCity: "unknown" }, undecided);
    expect(result.status).toBe("conditional");
    expect(result.conditions).toHaveLength(2);
    expect(result.conditions[0]).toBe("Only if you sell taxable goods.");
  });

  it("settles the model's condition with a yes, and keeps it open for no and not sure", () => {
    const taxed = checked({ applicability: "conditional", condition: "Only if you sell taxable goods." });
    expect(classify(taxed, profile, place, undecided)).toMatchObject({ status: "conditional", question: "Only if you sell taxable goods.", answer: null });
    expect(classify(taxed, profile, place, undecided, "yes")).toMatchObject({ status: "verified", conditions: [], answer: "yes" });
    expect(classify({ ...taxed, verification: "needs_verification" }, profile, place, undecided, "yes").status).toBe("needs_confirmation");
    for (const answer of ["no", "unsure"] as const) {
      expect(classify(taxed, profile, place, undecided, answer)).toMatchObject({ status: "conditional", conditions: ["Only if you sell taxable goods."], answer });
    }
    // A yes never settles the rules' own conditions, and an answer to nothing is ignored
    const city = checked({ applicability: "conditional", condition: "Only if you sell taxable goods.", level: "city" });
    expect(classify(city, profile, { ...place, insideCity: "unknown" }, undecided, "yes").status).toBe("conditional");
    expect(classify(checked(), profile, place, undecided, "no")).toMatchObject({ status: "verified", answer: null });
    expect(classify(checked({ applicability: "conditional" }), profile, place, undecided).question).toMatch(/couldn’t tell/);
  });

  it("never asks the owner what a government requires: that's for First Sale to confirm", () => {
    const rule = checked({ applicability: "conditional", condition: "Whether Aubrey requires a general business license or home-based permit for this shop", level: "city" }, "needs_verification");
    expect(classify(rule, profile, place, undecided)).toMatchObject({ status: "needs_confirmation", question: null, conditions: [] });
    const market = checked({ applicability: "conditional", condition: "Whether each market or city where you sell requires a vendor permit" });
    expect(classify(market, profile, place, undecided).question).toBeNull();
    // A fact about the owner's own business is still theirs to answer
    expect(classify(checked({ applicability: "conditional", condition: "Will customers come to your home?" }), profile, place, undecided).question).toBe("Will customers come to your home?");
  });

  it("notes registrations the owner says they already have", () => {
    const owner = testProfile({ alreadyHave: ["ein", "sales_tax"] });
    expect(classify(checked({ key: "ein", title: "Get an EIN" }), owner, place, undecided).alreadyHave).toMatch(/already have an EIN/);
    expect(classify(checked({ key: "vendors-license", title: "Vendor’s license", topic: "tax_registration" }), owner, place, undecided).alreadyHave).toMatch(/sales tax permit/);
    expect(classify(checked({ key: "llc", title: "Form an LLC", topic: "structure" }), owner, place, undecided).alreadyHave).toBeNull();
  });
});

describe("placeConditions", () => {
  it("asks for the county and city before their rules can apply", () => {
    const nowhere = placeOf(testProfile({ location: { county: "", city: "" } }));
    expect(placeConditions("county", nowhere)[0]).toMatch(/Add your county/);
    expect(placeConditions("city", nowhere)[0]).toMatch(/Add your city/);
    expect(placeConditions("state", nowhere)).toEqual([]);
    expect(placeConditions("city", { ...place, insideCity: "no" })[0]).toMatch(/outside Columbus city limits/);
    expect(placeConditions("city", place)).toEqual([]);
  });
});

describe("placeGap", () => {
  it("says what's missing about the owner's place and how to fix it in their answers", () => {
    const unsure = placeOf(testProfile({ location: { county: "Franklin", city: "Columbus", insideCityLimits: "unsure" } }));
    const gap = placeGap("city", unsure)!;
    expect(gap.action).toBe("Confirm whether you’re inside Columbus city limits");
    expect(placeGap("county", placeOf(testProfile({ location: { county: "" } })))?.action).toBe("Add your county to your answers");
    expect(placeGap("state", unsure)).toBeNull();
    expect(placeGap("city", place)).toBeNull();
  });
});
