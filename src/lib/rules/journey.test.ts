import { describe, expect, it } from "vitest";
import { type JourneyInput, journeyStages, nextMove } from "./journey";

const base: JourneyInput = {
  business: "done",
  businessSummary: "Answers saved for Rise Bakery.",
  researched: true,
  answersChanged: false,
  structure: { structure: "llc", from: "decision" },
  plan: { steps: 6, proposal: false, beforeSelling: { total: 4, done: 1 }, first: { id: "s2", title: "Get an EIN", later: false, structure: false } },
  documents: { total: 2, waiting: 0 },
};

const states = (input: JourneyInput) => journeyStages(input).map((stage) => [stage.href, stage.state]);

describe("nextMove", () => {
  it("starts with the business when there isn't one", () => {
    const start: JourneyInput = { ...base, business: "none", businessSummary: null, researched: false, structure: { structure: null, from: null }, plan: { ...base.plan, steps: 0, first: null } };
    expect(nextMove(start)).toMatchObject({ href: "/business/new", action: "Start here", stepId: null });
  });

  it("asks for updated answers before anything else", () => {
    expect(nextMove({ ...base, business: "update", plan: { ...base.plan, proposal: true } }).href).toBe("/business/edit");
  });

  it("puts plan changes waiting for review ahead of the next step", () => {
    expect(nextMove({ ...base, plan: { ...base.plan, proposal: true } }).href).toBe("/checklist");
  });

  it("finds requirements before there's a plan", () => {
    expect(nextMove({ ...base, researched: false, plan: { ...base.plan, steps: 0, first: null } })).toMatchObject({ href: "/requirements", action: "Find my requirements" });
  });

  it("shows what changed answers mean before the next step", () => {
    expect(nextMove({ ...base, answersChanged: true }).action).toBe("See what changed");
  });

  it("opens the plan's next step", () => {
    expect(nextMove(base)).toEqual({
      title: "Get an EIN",
      why: "This is your next step before your first sale.",
      href: "/checklist/s2",
      action: "Open this step",
      stepId: "s2",
      stage: "/checklist",
    });
  });

  it("says a later step comes after the first sale once everything before it is done", () => {
    const later = { id: "s9", title: "File your franchise tax report", later: true, structure: false };
    expect(nextMove({ ...base, plan: { ...base.plan, beforeSelling: { total: 4, done: 4 }, first: later } }).why).toMatch(/is done. This one comes later/);
    // Steps before selling still waiting: never says they're done
    expect(nextMove({ ...base, plan: { ...base.plan, first: later } }).why).toMatch(/^Your other steps are waiting/);
  });

  it("says the owner is ready once every step before selling is done", () => {
    expect(nextMove({ ...base, plan: { ...base.plan, beforeSelling: { total: 4, done: 4 }, first: null } }).title).toBe("You’re ready for your first sale");
  });

  it("waits to hear back when only submitted steps are left", () => {
    expect(nextMove({ ...base, plan: { ...base.plan, first: null } }).title).toBe("Wait to hear back");
  });

  it("asks for a structure when the plan has nothing to start", () => {
    expect(nextMove({ ...base, structure: { structure: null, from: null }, plan: { ...base.plan, first: null } }).href).toBe("/structure");
  });

  it("checks again when research found no steps", () => {
    expect(nextMove({ ...base, plan: { ...base.plan, steps: 0, first: null } }).action).toBe("Check again");
  });
});

describe("journeyStages", () => {
  it("marks the first open stage as up next and later ones not started", () => {
    expect(states({ ...base, business: "none", researched: false, structure: { structure: null, from: null }, plan: { ...base.plan, steps: 0, first: null }, documents: { total: 0, waiting: 0 } })).toEqual([
      ["/business", "now"],
      ["/requirements", "todo"],
      ["/structure", "todo"],
      ["/checklist", "todo"],
      ["/documents", "anytime"],
    ]);
  });

  it("shows done stages and the plan's progress", () => {
    const stages = journeyStages(base);
    expect(stages.map((stage) => stage.state)).toEqual(["done", "done", "done", "now", "anytime"]);
    expect(stages[2].detail).toBe("You chose an LLC.");
    expect(stages[3].detail).toBe("1 of 4 steps done before your first sale.");
    expect(stages[4].detail).toMatch(/^2 documents/);
  });

  it("marks up next where the next move points, even before an earlier open stage", () => {
    const choose = { id: "s1", title: "Choose a business structure", later: false, structure: true };
    const other = { id: "s5", title: "Keep your home business within Austin’s limits", later: false, structure: false };
    const undecided: JourneyInput = { ...base, structure: { structure: null, from: null } };
    expect(journeyStages({ ...undecided, plan: { ...base.plan, first: choose } }).map((stage) => stage.state).slice(2, 4)).toEqual(["now", "todo"]);
    expect(journeyStages({ ...undecided, plan: { ...base.plan, first: other } }).map((stage) => stage.state).slice(2, 4)).toEqual(["todo", "now"]);
  });

  it("says when research found no steps", () => {
    expect(journeyStages({ ...base, plan: { ...base.plan, steps: 0, first: null } })[3].detail).toBe("Your last check didn’t turn up any steps.");
  });

  it("marks stages that wait on the owner, without moving up next past them", () => {
    expect(states({ ...base, answersChanged: true, plan: { ...base.plan, proposal: true }, documents: { total: 3, waiting: 1 } })).toEqual([
      ["/business", "done"],
      ["/requirements", "check"],
      ["/structure", "done"],
      ["/checklist", "check"],
      ["/documents", "check"],
    ]);
  });

  it("finishes the plan stage when every step before selling is done", () => {
    const plan = journeyStages({ ...base, plan: { ...base.plan, beforeSelling: { total: 4, done: 4 }, first: null } })[3];
    expect(plan).toMatchObject({ state: "done", detail: "All 4 steps before your first sale are done." });
  });

  it("finishes the plan stage when nothing has to come before selling", () => {
    expect(journeyStages({ ...base, plan: { ...base.plan, beforeSelling: { total: 0, done: 0 }, first: null } })[3].state).toBe("done");
  });

  it("names a structure the business already registered as", () => {
    expect(journeyStages({ ...base, structure: { structure: "sole_proprietorship", from: "registered" } })[2].detail).toBe("Already registered as a sole proprietorship.");
  });
});
