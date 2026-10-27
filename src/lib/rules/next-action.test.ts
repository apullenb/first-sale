import { describe, expect, it } from "vitest";
import { type ActionStep, nextActions, planCosts } from "./next-action";

const step = (key: string, overrides: Partial<ActionStep> = {}): ActionStep => ({
  key,
  title: key,
  status: "todo",
  requirementStatus: "verified",
  timing: "before_selling",
  prerequisites: [],
  feeCents: null,
  renewal: null,
  ...overrides,
});

describe("nextActions", () => {
  it("separates what can happen now from what waits, what's later and what's optional", () => {
    const actions = nextActions([
      step("structure", { status: "done" }),
      step("name", { prerequisites: ["structure"] }),
      step("vendor"),
      step("ein", { prerequisites: ["llc"] }),
      step("llc", { status: "submitted" }),
      step("bakery", { requirementStatus: "conditional" }),
      step("renewal-reminder", { timing: "later" }),
      step("kids-rules", { requirementStatus: "outside_coverage" }),
      step("ein-optional", { requirementStatus: "optional" }),
    ]);
    expect(actions.now.map((each) => each.key)).toEqual(["name", "vendor"]);
    expect(actions.decide.map((each) => each.key)).toEqual(["bakery"]);
    expect(actions.submitted.map((each) => each.key)).toEqual(["llc"]);
    // Submitted isn't approved, so the EIN still waits
    expect(actions.waiting.map((each) => [each.step.key, each.on.map((on) => on.key)])).toEqual([["ein", ["llc"]]]);
    expect(actions.later.map((each) => each.key)).toEqual(["renewal-reminder"]);
    expect(actions.optional.map((each) => each.key)).toEqual(["kids-rules", "ein-optional"]);
    expect(actions.first?.key).toBe("name");
  });
});

describe("planCosts", () => {
  it("counts each form's fee once, keeps renewals for later years, and lists unknown fees", () => {
    const costs = planCosts([
      step("vendor", { feeCents: 5000, formKey: "state-permit" }),
      step("vendor-again", { feeCents: 5000, formKey: "state-permit" }),
      step("bakery", { feeCents: 1000, renewal: { text: "Each year", feeCents: 1000 } }),
      step("transient", { feeCents: 5000, requirementStatus: "conditional" }),
      step("ein", { feeCents: 0 }),
      step("city-license"),
      step("maybe-license", { requirementStatus: "conditional" }),
      step("optional", { feeCents: 9900, requirementStatus: "optional" }),
      step("paid", { feeCents: 3900, status: "done" }),
    ]);
    expect(costs.startupCents).toBe(6000);
    expect(costs.yearlyCents).toBe(1000);
    expect(costs.maybe).toEqual([{ title: "transient", cents: 5000 }]);
    expect(costs.unknown).toEqual(["city-license"]);
  });
});

describe("planCosts: one form, several steps", () => {
  it("keeps the strongest fee for a form, whatever order the steps come in", () => {
    const costs = planCosts([
      step("maybe-first", { feeCents: null, requirementStatus: "conditional", formKey: "state-permit" }),
      step("vendor", { feeCents: 5000, formKey: "state-permit" }),
    ]);
    expect(costs.startup).toEqual([{ title: "vendor", cents: 5000 }]);
    expect(costs.maybe).toEqual([]);
  });
});

