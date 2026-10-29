import { describe, expect, it } from "vitest";
import { STRUCTURE_EXAMPLES } from "@/data/structure-examples";
import { testProfile } from "@/test/fixtures";
import { guideFor, nameExamples, ownershipExamples, taxExamples } from "./guide";
import { compareRows, recordedStructure, relevantLines, startingStructure, structureOption, taxPoints } from "./options";
import { nameNeed, recommendedNamePlan, recommendedTaxPlan, suggestPath, whyRecommended } from "./suggest";

// The demo owner: one baker at markets in Austin, testing the idea
const baker = testProfile({ location: { state: "TX" }, category: "baked_goods", goals: ["test_idea"], mayAddOwners: "no", nameIsLegalName: "no" });
const partners = testProfile({ owners: { count: 2 }, offeringKinds: ["services"], category: "home_services", ownerRelation: "friends" });

describe("what the guide shows and folds away", () => {
  it("shows the options that fit the owners side by side, and folds the corporation away", () => {
    expect(guideFor(baker)).toMatchObject({ main: ["sole_proprietorship", "llc"], more: ["corporation"] });
    expect(guideFor(partners)).toMatchObject({ main: ["partnership", "llc"], more: ["corporation"] });
    expect(guideFor(testProfile({ owners: { count: 2 }, takesOnDebt: "yes" })).main).toEqual(["llc", "partnership"]);
  });

  it("keeps a registered corporation open, since the path builds on it", () => {
    expect(guideFor(testProfile({ stage: "registered", registeredAs: "corporation" }))).toMatchObject({ main: ["corporation", "sole_proprietorship", "llc"], more: [] });
  });

  it("follows the structure the owner recorded, not just the suggestion", () => {
    const legal = testProfile({ name: "Dana Reyes", nameIsLegalName: "yes" });
    expect(guideFor(legal).nameFolded).toMatch(/legal name/);
    // A company's own name is a separate question, so the details stay open
    expect(guideFor(legal, suggestPath(legal), "llc").nameFolded).toBeNull();
    expect(guideFor(baker, suggestPath(baker), "corporation")).toMatchObject({ main: ["sole_proprietorship", "llc", "corporation"], more: [], otherTaxOpen: true });
  });

  it("folds the name details away when the owner uses their legal name or already registered one", () => {
    expect(guideFor(baker).nameFolded).toBeNull();
    expect(guideFor(testProfile({ name: "Dana Reyes", nameIsLegalName: "yes" })).nameFolded).toMatch(/legal name/);
    expect(guideFor(testProfile({ alreadyHave: ["business_name"] })).nameFolded).toMatch(/already registered/);
    expect(guideFor(testProfile({ nameIsLegalName: "unsure" })).nameFolded).toBeNull();
  });

  it("doesn't treat a registered name as covering a company's own name", () => {
    const named = testProfile({ alreadyHave: ["business_name"] });
    expect(nameNeed(named, "sole_proprietorship").status).toBe("done");
    expect(nameNeed(named, "llc")).toMatchObject({ status: "maybe", fact: "names_independent" });
    expect(guideFor(named, suggestPath(named), "llc").nameFolded).toBeNull();
  });

  it("opens other tax choices only when worth asking about now", () => {
    expect(guideFor(baker).otherTaxOpen).toBe(false);
    expect(guideFor(testProfile({ goals: ["grow"], firstYearSales: "over_100k" })).otherTaxOpen).toBe(true);
  });

  it("notes the married couples' choice only for married co-owners", () => {
    expect(guideFor(testProfile({ owners: { count: 2 }, ownerRelation: "spouse" })).spouseNote).toBe(true);
    expect(guideFor(partners).spouseNote).toBe(false);
    // "Spouse or partner" in intake doesn't mean married, so the note says when it applies
    expect(taxPoints(["partnership", "llc"], true).find((line) => line.fact === "married_couples")?.text).toMatch(/^If you’re married to your co-owner/);
    expect(taxPoints(["sole_proprietorship", "llc"], false).map((line) => line.fact)).toEqual(["sp_schedule_se", "llc_self_employment"]);
  });

  it("leaves out co-owner lines for a solo owner with no co-owners planned, but not for an unsure one", () => {
    const cons = structureOption("llc").cons;
    const facts = (p: Parameters<typeof relevantLines>[1]) => relevantLines(cons, p).map((line) => line.fact);
    expect(facts(baker)).not.toContain("llc_membership_change");
    expect(facts(testProfile({ mayAddOwners: "unsure" }))).toContain("llc_membership_change");
    expect(facts(partners)).toContain("llc_membership_change");
  });

  it("only mentions items for young children to makers and shops, who are asked about them", () => {
    expect(suggestPath(baker).wouldChange).not.toContain("Making items for young children");
    expect(suggestPath(testProfile({ offeringKinds: ["handmade"], category: "crafts" })).wouldChange).toContain("Making items for young children");
  });

  it("backs every comparison cell after who owns it with a fact, and never states a fee", () => {
    for (const owners of [1, 2]) {
      for (const row of compareRows(owners).slice(1)) {
        for (const [option, line] of Object.entries(row.cells)) expect(Boolean(line.fact), `${row.label}: ${option}`).toBe(true);
      }
      expect(compareRows(owners).flatMap((row) => Object.values(row.cells).map((line) => line.text)).join(" ")).not.toMatch(/\$\d/);
    }
  });
});

describe("recommendations", () => {
  it("explains a one-owner suggestion in the owner's terms", () => {
    const reasons = whyRecommended(baker);
    expect(reasons[0].text).toMatch(/only owner/);
    expect(reasons.map((reason) => reason.fact)).toContain("sp_fit");
    // Something that cuts the other way is marked, not counted as support
    expect(reasons.find((reason) => /Customers eat/.test(reason.text))?.caveat).toBe(true);
  });

  it("explains a several-owner suggestion differently", () => {
    const quiet = whyRecommended(partners);
    expect(suggestPath(partners).option).toBe("partnership");
    expect(quiet[0].text).toMatch(/2 owners/);
    expect(quiet.map((reason) => reason.fact)).toContain("partnership_definition");

    const risky = testProfile({ owners: { count: 3 }, takesOnDebt: "yes" });
    expect(suggestPath(risky).option).toBe("llc");
    expect(whyRecommended(risky).map((reason) => reason.text)).toContain("You expect to sign a lease, take a loan or buy on credit.");
    expect(whyRecommended(risky).map((reason) => reason.fact)).toEqual(expect.arrayContaining(["llc_fit", "llc_liability"]));
  });

  it("marks an unanswered lease or loan question as a caveat", () => {
    expect(whyRecommended(testProfile({ takesOnDebt: null })).at(-1)).toMatchObject({ caveat: true });
    expect(whyRecommended(testProfile({ takesOnDebt: "no" })).some((reason) => /lease or take a loan/.test(reason.text))).toBe(false);
  });

  it("recommends a name answer only when the answers make it clear", () => {
    expect(recommendedNamePlan(baker, "sole_proprietorship")?.value).toBe("register_dba");
    expect(recommendedNamePlan(testProfile({ name: "Dana Reyes", nameIsLegalName: "yes" }), "sole_proprietorship")?.value).toBe("legal_name");
    expect(recommendedNamePlan(testProfile({ nameIsLegalName: "unsure" }), "sole_proprietorship")).toBeNull();
    expect(recommendedNamePlan(baker, "llc")).toBeNull();
    expect(recommendedNamePlan(partners, "partnership")).toBeNull();
  });

  it("recommends the default tax treatment unless another is worth asking about", () => {
    expect(recommendedTaxPlan(baker, "sole_proprietorship").value).toBe("default");
    expect(recommendedTaxPlan(partners, "llc")).toMatchObject({ value: "default", reasons: [{ fact: "llc_multi_tax" }, {}, {}] });
    expect(recommendedTaxPlan(testProfile({ goals: ["grow"], firstYearSales: "over_100k" }), "llc").value).toBe("ask_professional");
    expect(recommendedTaxPlan(baker, "corporation").value).toBe("ask_professional");
  });

  it("never sends a sole proprietor to ask about S corporation status, which takes forming a company first", () => {
    const big = testProfile({ goals: ["grow"], firstYearSales: "over_100k" });
    expect(recommendedTaxPlan(big, "sole_proprietorship").value).toBe("default");
    expect(recommendedTaxPlan(big, "sole_proprietorship").reasons.map((reason) => reason.fact)).toContain("tax_status");
    expect(taxExamples(big, "sole_proprietorship").map((example) => example.id)).toEqual(["tax-sp"]);
    // Growing with high sales but no added risk still suggests a sole proprietorship
    const quiet = testProfile({ offeringKinds: ["services"], category: "creative_services", goals: ["grow"], firstYearSales: "over_100k", takesOnDebt: "no" });
    expect(suggestPath(quiet).option).toBe("sole_proprietorship");
    expect(suggestPath(quiet).askAProfessional.join(" ")).not.toMatch(/S corporation/);
  });

  it("doesn't call high expected sales a reason to keep the default", () => {
    const reasons = recommendedTaxPlan(testProfile({ firstYearSales: "over_100k" }), "llc").reasons;
    expect(reasons.some((reason) => /Nothing in your answers/.test(reason.text))).toBe(false);
    expect(reasons.at(-1)).toMatchObject({ caveat: true });
  });
});

describe("examples", () => {
  const ids = (list: { id: string }[]) => list.map((example) => example.id);

  it("show a business like the owner's first", () => {
    expect(ids(ownershipExamples(baker, "sole_proprietorship"))).toEqual(["sp-baker", "sp-dog-walker"]);
    expect(ids(ownershipExamples(baker, "llc"))[0]).toBe("llc-caterer");
    expect(ids(ownershipExamples(testProfile({ offeringKinds: ["services"] }), "sole_proprietorship"))[0]).toBe("sp-dog-walker");
    expect(ids(ownershipExamples(testProfile({ offeringKinds: ["handmade"] }), "llc"))[0]).toBe("llc-woodworker");
  });

  it("match the number of owners", () => {
    expect(ids(ownershipExamples(partners, "partnership"))).toEqual(["partnership-lawn-care"]);
    expect(ids(ownershipExamples(partners, "llc"))).toEqual(["llc-cleaning", "llc-food-truck"]);
    expect(ownershipExamples(baker, "llc").every((example) => example.owners === "one")).toBe(true);
    expect(ownershipExamples(partners, "llc").every((example) => example.owners === "several")).toBe(true);
    expect(ids(ownershipExamples(baker, "corporation"))).toEqual(["corp-solo"]);
    expect(ids(ownershipExamples(partners, "corporation"))).toEqual(["corp-investors"]);
  });

  it("put the owner's own name situation first, told by owners like them", () => {
    expect(ids(nameExamples(baker, "sole_proprietorship"))).toEqual(["name-dba-candles", "name-legal"]);
    expect(ids(nameExamples(testProfile({ name: "Dana Reyes", nameIsLegalName: "yes" }), "sole_proprietorship"))).toEqual(["name-legal", "name-dba-candles"]);
    expect(ids(nameExamples(baker, "llc"))).toEqual(["name-entity-dba", "name-dba-candles"]);
    expect(ids(nameExamples(partners, "partnership"))).toEqual(["name-dba-partners"]);
  });

  it("show S corporation status only to owners who should ask about it", () => {
    expect(ids(taxExamples(baker, "sole_proprietorship"))).toEqual(["tax-sp"]);
    expect(ids(taxExamples(partners, "partnership"))).toEqual(["tax-partners"]);
    expect(ids(taxExamples(testProfile({ goals: ["grow"], firstYearSales: "over_100k" }), "llc"))).toEqual(["tax-llc-one", "tax-s-corp"]);
  });

  it("are made up, short, sourced, and state no fees or deadlines", () => {
    expect(new Set(ids([...STRUCTURE_EXAMPLES])).size).toBe(STRUCTURE_EXAMPLES.length);
    for (const example of STRUCTURE_EXAMPLES) {
      const text = [example.title, ...example.story, example.takeaway].join(" ");
      expect(example.facts.length, example.id).toBeGreaterThan(0);
      expect(new Set(example.facts).size, example.id).toBe(example.facts.length);
      // First names only, each named in the title and the story
      for (const person of example.people) {
        expect(person, example.id).toMatch(/^[A-Z][a-z]+$/);
        expect(example.title, example.id).toContain(person);
        expect(example.story.join(" "), example.id).toContain(person);
      }
      expect(example.story.length, example.id).toBeLessThanOrEqual(4);
      expect(text, example.id).not.toMatch(/\$\d|\bdeadline|\bwithin \d|\d+ days/i);
    }
  });
});

describe("owner count", () => {
  it("doesn't build on a registered structure that can't fit the number of owners", () => {
    const solo = suggestPath(testProfile({ stage: "registered", registeredAs: "partnership" }));
    expect(solo).toMatchObject({ option: "sole_proprietorship", keepExisting: false, mismatch: "partnership" });
    expect(solo.headline).not.toMatch(/Keep your/);
    expect(whyRecommended(testProfile({ stage: "registered", registeredAs: "partnership" })).map((reason) => reason.text).join(" ")).not.toMatch(/partner reports|already registered/);

    const pair = suggestPath(testProfile({ owners: { count: 2 }, stage: "registered", registeredAs: "sole_proprietorship" }));
    expect(pair.mismatch).toBe("sole_proprietorship");
    expect(["partnership", "llc"]).toContain(pair.option);

    expect(suggestPath(testProfile({ stage: "registered", registeredAs: "llc" }))).toMatchObject({ option: "llc", keepExisting: true, mismatch: null });
  });

  it("reads a recorded structure against the number of owners", () => {
    expect(recordedStructure("", 1)).toEqual({ status: "none", structure: null });
    expect(recordedStructure("undecided", 1)).toEqual({ status: "unsure", structure: null });
    expect(recordedStructure("llc", 3)).toEqual({ status: "chosen", structure: "llc" });
    expect(recordedStructure("partnership", 1)).toEqual({ status: "no_longer_fits", structure: null, was: "partnership" });
    expect(recordedStructure("sole_proprietorship", 2)).toMatchObject({ status: "no_longer_fits", was: "sole_proprietorship" });
    expect(recordedStructure("something_else", 1).status).toBe("none");
  });

  it("starts the form on a recorded Not sure yet, but clears a structure that no longer fits", () => {
    expect(startingStructure("undecided", 1)).toBe("undecided");
    expect(startingStructure("llc", 1)).toBe("llc");
    expect(startingStructure("partnership", 1)).toBe("");
    expect(startingStructure("sole_proprietorship", 2)).toBe("");
    expect(startingStructure("", 2)).toBe("");
  });

  it("bases the guidance on the suggestion when the recorded answer is Not sure yet or no longer fits", () => {
    for (const decided of ["undecided", "partnership"]) {
      const recorded = recordedStructure(decided, 1);
      const path = suggestPath(baker);
      expect(guideFor(baker, path, recorded.structure ?? path.option)).toEqual(guideFor(baker));
    }
  });
});

describe("tax caveats and S corporation examples", () => {
  it("marks an unanswered sales question as a caveat", () => {
    const reasons = recommendedTaxPlan(testProfile({ firstYearSales: "unsure" }), "sole_proprietorship").reasons;
    expect(reasons.at(-1)).toMatchObject({ caveat: true });
    expect(reasons.at(-1)?.text).toMatch(/haven’t said how much you expect to sell/);
  });

  it("shows an S corporation example only for the same structure and number of owners", () => {
    const growing = { goals: ["grow" as const], firstYearSales: "over_100k" as const };
    expect(taxExamples(testProfile(growing), "llc").map((example) => example.id)).toEqual(["tax-llc-one", "tax-s-corp"]);
    expect(taxExamples(testProfile({ ...growing, owners: { count: 2 } }), "llc").map((example) => example.id)).toEqual(["tax-llc-several", "tax-s-corp-partners"]);
    expect(taxExamples(testProfile(growing), "corporation")).toEqual([]);
  });
});
