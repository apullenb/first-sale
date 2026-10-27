import { describe, expect, it } from "vitest";
import { testProfile } from "@/test/fixtures";
import { AREAS, optionsFor, STRUCTURE_OPTIONS } from "./options";
import { applyWhatIf, basisLines, suggestPath, taxFor } from "./suggest";

describe("structure options", () => {
  it("back every setup and ongoing obligation with an official fact, or mark it as a state rule or a tip", () => {
    for (const option of STRUCTURE_OPTIONS) {
      for (const line of [...option.setup, ...option.ongoing(1), ...option.ongoing(2), ...option.cons]) {
        expect(Boolean(line.fact || line.stateRule || line.tip), `${option.id}: ${line.text}`).toBe(true);
      }
    }
  });

  it("never state a fee: fees come only from the owner's own research", () => {
    const text = STRUCTURE_OPTIONS.flatMap((option) => [option.meaning, ...option.why, ...option.setup, ...option.ongoing(1), ...option.pros, ...option.cons])
      .map((line) => line.text)
      .join(" ");
    expect(text).not.toMatch(/\$\d/);
  });

  it("keep ownership, name registration, tax treatment and licenses as four separate decisions", () => {
    expect(AREAS.map((area) => area.id)).toEqual(["ownership", "name", "tax", "licenses"]);
    expect(AREAS.find((area) => area.id === "name")?.what).toMatch(/not a structure/);
  });

  it("offer only structures that fit the number of owners", () => {
    expect(optionsFor(1).map((option) => option.id)).toEqual(["sole_proprietorship", "llc", "corporation"]);
    expect(optionsFor(3).map((option) => option.id)).toEqual(["partnership", "llc", "corporation"]);
  });
});

describe("suggestPath", () => {
  it("doesn't assume an LLC for a low-risk owner testing an idea", () => {
    const path = suggestPath(testProfile({ offeringKinds: ["services"], category: "creative_services", goals: ["test_idea"], takesOnDebt: "no" }));
    expect(path.option).toBe("sole_proprietorship");
    expect(path.alternatives.map((alternative) => alternative.option)).toContain("llc");
  });

  it("explains the name question apart from the structure", () => {
    expect(suggestPath(testProfile({ name: "Maria Lopez", nameIsLegalName: "yes" })).name.status).toBe("not_needed");
    expect(suggestPath(testProfile({ name: null })).name.status).toBe("unknown");
    expect(suggestPath(testProfile({ nameIsLegalName: "unsure" })).name.status).toBe("maybe");
  });

  it("lists only answered facts as its basis, and treats unknowns as assumptions", () => {
    const path = suggestPath(testProfile({ takesOnDebt: null }));
    expect(path.basedOn.join(" ")).not.toMatch(/lease/);
    expect(path.assumptions.join(" ")).toMatch(/lease or loan/);
    expect(basisLines(testProfile({ takesOnDebt: "no" }))).toContain("No lease, loan or credit planned");
  });

  it("asks married co-owners' tax question for a professional, not as an answer", () => {
    const path = suggestPath(testProfile({ owners: { count: 2 }, ownerRelation: "spouse" }));
    expect(path.askAProfessional.join(" ")).toMatch(/married couple/);
  });

  it("counts employees only when the owner picked them", () => {
    expect(suggestPath(testProfile({ hiringPlans: "right_away", helpKinds: ["contractors"] })).signals).not.toContain("You plan to have employees");
    expect(suggestPath(testProfile({ helpKinds: ["employees"] })).signals).toContain("You plan to have employees");
  });

  it("describes taxes for whichever structure is named", () => {
    expect(taxFor("corporation", 1).fact).toBe("corp_tax");
    expect(taxFor("llc", 2).fact).toBe("llc_multi_tax");
  });

  it("tries what-ifs on a copy", () => {
    const profile = testProfile();
    const changed = applyWhatIf(profile, { owners: 3, employees: true });
    expect(changed.owners.count).toBe(3);
    expect(changed.helpKinds).toContain("employees");
    expect(profile.owners.count).toBe(1);
    expect(profile.helpKinds).toEqual([]);
  });
});
