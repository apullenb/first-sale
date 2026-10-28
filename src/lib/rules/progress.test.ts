import { describe, expect, it } from "vitest";
import type { ActionStep } from "./next-action";
import { budgetCapCents, daysUntil, formatMinutes, nextStepAfter, remainingWork, spentCents } from "./progress";

const step = (key: string, overrides: Partial<ActionStep> = {}): ActionStep => ({
  key,
  title: key,
  topic: "other",
  status: "todo",
  requirementStatus: "verified",
  timing: "before_selling",
  prerequisites: [],
  feeCents: null,
  renewal: null,
  ...overrides,
});

describe("remainingWork", () => {
  it("counts the owner's time on required steps not started, and keeps submitted ones apart", () => {
    const work = remainingWork([
      step("structure", { topic: "structure" }),
      step("name", { topic: "name_registration" }),
      step("permit", { topic: "license_permit", status: "submitted" }),
      step("ein", { status: "done" }),
      step("optional", { requirementStatus: "optional" }),
      step("renewal", { timing: "later" }),
    ]);
    expect(work.left.map((each) => each.key)).toEqual(["structure", "name"]);
    expect(work.minutes).toBe(50);
    expect(work.waiting.map((each) => each.key)).toEqual(["permit"]);
  });
});

describe("formatMinutes", () => {
  it("shows minutes under an hour and half hours above", () => {
    expect(formatMinutes(20)).toBe("20 min");
    expect(formatMinutes(60)).toBe("1 hr");
    expect(formatMinutes(95)).toBe("1½ hr");
    expect(formatMinutes(250)).toBe("4 hr");
  });
});

describe("spentCents", () => {
  it("adds fees on finished steps once per form, optional ones included", () => {
    expect(
      spentCents([
        step("dba", { status: "done", feeCents: 2_300, formKey: "dba-form" }),
        step("dba-again", { status: "done", feeCents: 2_300, formKey: "dba-form" }),
        step("permit", { status: "done", feeCents: 5_000, requirementStatus: "optional" }),
        step("llc", { feeCents: 30_000 }),
      ]),
    ).toBe(7_300);
  });
});

describe("budgetCapCents", () => {
  it("uses the top of a closed range only", () => {
    expect(budgetCapCents("under_1k")).toBe(100_000);
    expect(budgetCapCents("over_25k")).toBeNull();
    expect(budgetCapCents("unsure")).toBeNull();
    expect(budgetCapCents(null)).toBeNull();
  });
});

describe("daysUntil", () => {
  it("counts calendar days from today, whatever the time of day", () => {
    expect(daysUntil("2026-12-01", new Date(2026, 10, 1, 23, 30))).toBe(30);
    expect(daysUntil("2026-11-01", new Date(2026, 10, 1, 0, 5))).toBe(0);
    expect(daysUntil("2026-10-30", new Date(2026, 10, 1))).toBe(-2);
  });
});

describe("nextStepAfter", () => {
  const plan = [
    step("structure", { status: "done" }),
    step("name", { prerequisites: ["structure"] }),
    step("cottage", { status: "done" }),
    step("tax"),
    step("license", { prerequisites: ["tax"] }),
    step("renewal", { timing: "later" }),
  ];

  it("moves forward to the next ready step and skips finished and blocked ones", () => {
    expect(nextStepAfter(plan, "name")?.key).toBe("tax");
  });

  it("goes back to an earlier ready step only when none after this one is ready, never to a finished one", () => {
    expect(nextStepAfter(plan, "cottage")?.key).toBe("tax");
    expect(nextStepAfter(plan, "tax")?.key).toBe("name");
  });

  it("offers later steps only once nothing needed before selling is ready", () => {
    const done = plan.map((each) => (each.key === "renewal" ? each : { ...each, status: "done" as const }));
    expect(nextStepAfter(done, "tax")?.key).toBe("renewal");
    expect(nextStepAfter(done, "renewal")).toBeNull();
  });
});
