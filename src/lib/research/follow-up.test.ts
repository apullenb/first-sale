import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { requirementDraft, testProfile } from "@/test/fixtures";
import { placeOf } from "./applicability";
import { followUpCandidates, followUpRequirements, safeBackground } from "./follow-up";
import { officeOf } from "./office";

const profile = testProfile({ location: { state: "TX", county: "Denton County", city: "Aubrey", insideCityLimits: "yes" } });
const place = placeOf(profile);

describe("followUpCandidates", () => {
  const row = (overrides: Partial<{ verification: string; status: string; applicability: string; condition: string; fitsStructure: boolean }>) => ({
    verification: "needs_verification",
    status: "needs_confirmation",
    applicability: "applies",
    condition: "",
    fitsStructure: true,
    ...overrides,
  });

  it("takes what no page confirmed, and old questions about what a government requires, never the owner's own questions", () => {
    expect(followUpCandidates([row({})])).toHaveLength(1);
    expect(followUpCandidates([row({ status: "conditional", applicability: "conditional", condition: "Whether Aubrey requires a home-based permit" })])).toHaveLength(1);
    expect(followUpCandidates([row({ status: "conditional", applicability: "conditional", condition: "Will customers come to your home?" })])).toHaveLength(0);
    expect(followUpCandidates([row({ verification: "sourced", status: "verified" })])).toHaveLength(0);
    expect(followUpCandidates([row({ fitsStructure: false })])).toHaveLength(0);
  });
});

describe("safeBackground", () => {
  it("keeps general background and drops anything that reads like a specific fact", () => {
    expect(safeBackground("  Most small Texas cities  don’t license home sellers.  ")).toBe("Most small Texas cities don’t license home sellers.");
    for (const text of ["The fee is $50.", "Apply within 30 days.", "Email clerk@aubreytx.gov.", "See https://x.gov.", "Too short."]) {
      expect(safeBackground(text)).toBe("");
    }
  });
});

describe("officeOf", () => {
  it("sends a city's rules to city hall, and others to the office named, in the owner's own place names", () => {
    expect(officeOf({ level: "city", agency: "Planning department" }, place)).toMatchObject({ key: "city:city-of-aubrey", name: "City of Aubrey" });
    expect(officeOf({ level: "county", agency: "Your county health department" }, place).name).toBe("Denton County health department");
    expect(officeOf({ level: "state", agency: "Your state’s department of revenue" }, place).name).toBe("Texas department of revenue");
    expect(officeOf({ level: "county", agency: "" }, place).name).toBe("Denton County");
  });
});

describe("followUpRequirements", () => {
  it("runs offline in practice mode: no search, a decision and reason for each rule and open question, no made-up contacts", async () => {
    const unconfirmed = [
      { ...requirementDraft({ key: "license", title: "City business license", level: "city", agency: "City clerk" }), verification: "needs_verification" },
      { ...requirementDraft({ key: "home", title: "Home business permit", level: "city", agency: "Planning" }), verification: "needs_verification" },
    ];
    const fetchImpl = async () => {
      throw new Error("nothing is fetched without search");
    };
    const result = await followUpRequirements(createMockProvider(), profile, place, unconfirmed, { fetchImpl, open: [{ question: "Do markets need their own permit?" }] });
    expect(result.pages).toEqual([]);
    expect(result.confirmed).toEqual([]);
    expect(result.notes.map((note) => note.key)).toEqual(["license", "home"]);
    expect(result.notes[0]).toMatchObject({ verdict: "applies", evidence: null });
    expect(result.notes[0].background).toMatch(/^Practice reason/);
    expect(result.answers).toEqual([{ question: "Do markets need their own permit?", answer: expect.stringMatching(/^Practice answer/) }]);
    expect(result.offices).toEqual([{ key: "city:city-of-aubrey", name: "City of Aubrey", level: "city", contacts: { emails: [], phones: [] }, site: null }]);
  });
});
