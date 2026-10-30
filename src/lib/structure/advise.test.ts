import { describe, expect, it } from "vitest";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { testProfile } from "@/test/fixtures";
import { adviseStructure, checkAdvice } from "./advise";
import { suggestPath } from "./suggest";

const NOW = new Date("2026-10-30T12:00:00Z");
const reason = (text: string, fact: string | null = null) => ({ text, fact, caveat: false });
const reply = (overrides: Partial<Parameters<typeof checkAdvice>[0]> = {}): Parameters<typeof checkAdvice>[0] => ({
  structure: "llc",
  headline: "An LLC keeps your home separate from the business.",
  reasons: [reason("Customers come to your home, so a claim could reach your savings.", "llc_liability")],
  namePlan: "register_dba",
  nameReasons: [reason("You sell as Sweet Crumbs, not your LLC's legal name.")],
  taxPlan: "default",
  taxReasons: [reason("Your first-year sales are small, so the default is simplest.")],
  askAProfessional: ["Should my LLC carry its own insurance?"],
  ...overrides,
});

describe("checkAdvice", () => {
  it("keeps the AI's recommendation when it fits, with its reasons and citations", () => {
    const advice = checkAdvice(reply(), testProfile(), "key-1", false, NOW);
    expect(advice).toMatchObject({ profileKey: "key-1", structure: "llc", name: { plan: "register_dba" }, tax: { plan: "default" } });
    expect(advice.reasons).toEqual([{ text: "Customers come to your home, so a claim could reach your savings.", fact: "llc_liability" }]);
  });

  it("falls back to the rules when the structure doesn't fit the owners", () => {
    const profile = testProfile({ owners: { count: 2 } });
    const advice = checkAdvice(reply({ structure: "sole_proprietorship" }), profile, "key-1", false, NOW);
    expect(advice.structure).toBe(suggestPath(profile).option);
    expect(advice.reasons.length).toBeGreaterThan(0);
  });

  it("drops unknown citations and anything that names an amount", () => {
    const advice = checkAdvice(
      reply({ reasons: [reason("It costs $300 to form.", "llc_liability"), reason("It protects your savings.", "made_up_fact")], askAProfessional: ["Is the $50 fee worth it?"] }),
      testProfile(),
      "key-1",
      false,
      NOW,
    );
    expect(advice.reasons).toEqual([{ text: "It protects your savings." }]);
    expect(advice.askAProfessional).toEqual([]);
  });

  it("never recommends S corporation status for a sole proprietorship", () => {
    const advice = checkAdvice(reply({ structure: "sole_proprietorship", taxPlan: "s_corp" }), testProfile(), "key-1", false, NOW);
    expect(advice.tax.plan).toBe("default");
  });
});

describe("adviseStructure", () => {
  it("runs offline in practice mode with the rules' own recommendation", async () => {
    const profile = testProfile();
    const advice = await adviseStructure(createMockProvider(), profile, "key-1", { now: NOW });
    expect(advice).toMatchObject({ structure: suggestPath(profile).option, simulated: true, createdAt: NOW.toISOString() });
  });
});
