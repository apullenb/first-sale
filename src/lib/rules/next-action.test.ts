import { describe, expect, it } from "vitest";
import { type ActionStep, planCosts } from "./next-action";

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

  it("doesn't count a form again once a step filed with it is done", () => {
    const costs = planCosts([
      step("name-filed", { feeCents: 2300, formKey: "assumed-name", status: "done" }),
      step("name-again", { feeCents: 2300, formKey: "assumed-name" }),
    ]);
    expect(costs.startupCents).toBe(0);
  });
});

