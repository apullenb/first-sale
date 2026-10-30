import { describe, expect, it } from "vitest";
import { type JourneyInput, journeyStages, nextMove, readyForFirstSale } from "./journey";

const licenses = { name: "Licenses and permits, part 1 of 2", href: "/start/licenses-1" };

const base: JourneyInput = {
  business: "done",
  businessSummary: "Answers saved for Rise Bakery.",
  researched: true,
  answersChanged: false,
  structure: { structure: "llc", from: "decision", recorded: true },
  questions: 0,
  plan: {
    steps: 6,
    beforeSelling: { total: 4, done: 1 },
    first: { id: "s2", title: "Get an EIN", later: false, group: licenses },
    waitsOnStructure: false,
  },
  documents: { total: 2, waiting: 0 },
};

const undecided = { structure: null, from: null, recorded: true } as const;
const states = (input: JourneyInput) => journeyStages(input).map((stage) => [stage.href, stage.state]);

describe("nextMove", () => {
  it("starts with the business when there isn't one", () => {
    const start: JourneyInput = { ...base, business: "none", businessSummary: null, researched: false, structure: { structure: null, from: null, recorded: false }, plan: { ...base.plan, steps: 0, first: null } };
    expect(nextMove(start)).toMatchObject({ href: "/business/new", action: "Start here", stepId: null });
  });

  it("asks for updated answers before anything else", () => {
    expect(nextMove({ ...base, business: "update", }).href).toBe("/business/edit");
  });

  it("goes to Business structure after the business answers, and moves on once “Not sure yet” is recorded", () => {
    const fresh: JourneyInput = { ...base, researched: false, structure: { structure: null, from: null, recorded: false }, plan: { ...base.plan, steps: 0, first: null } };
    expect(nextMove(fresh)).toMatchObject({ href: "/structure", stage: "/structure" });
    expect(nextMove({ ...fresh, structure: undecided })).toMatchObject({ href: "/requirements", action: "Find what applies to me" });
    expect(nextMove({ ...fresh, structure: { structure: "sole_proprietorship", from: "registered", recorded: false } }).href).toBe("/requirements");
  });

  it("updates the steps for changed answers, then asks the questions about the owner's plans", () => {
    expect(nextMove({ ...base, answersChanged: true, questions: 2 }).action).toBe("Update my steps");
    expect(nextMove({ ...base, questions: 2 })).toMatchObject({ title: "Answer 2 quick questions", href: "/requirements#questions", stage: "/requirements" });
    expect(nextMove({ ...base, questions: 1 }).title).toBe("Answer a quick question");
  });

  it("then opens the next task in the first paperwork group", () => {
    expect(nextMove(base)).toEqual({
      title: "Get an EIN",
      why: "Next in Licenses and permits, part 1 of 2.",
      href: "/checklist/s2",
      action: "Open this step",
      stepId: "s2",
      stage: "/start",
    });
  });

  it("says a later step comes after the first sale once everything before it is done", () => {
    const later = { id: "s9", title: "File your franchise tax report", later: true, group: { name: "After you open", href: "/start/after-you-open" } };
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

  it("asks for a structure when the filings left wait on it", () => {
    expect(nextMove({ ...base, structure: undecided, plan: { ...base.plan, first: null, waitsOnStructure: true } }).href).toBe("/structure");
  });

  it("checks again when research found nothing to file", () => {
    expect(nextMove({ ...base, plan: { ...base.plan, steps: 0, first: null } }).action).toBe("Check again");
  });
});

describe("readyForFirstSale", () => {
  const allDone = { ...base, plan: { ...base.plan, beforeSelling: { total: 4, done: 4 }, first: null } };

  it("is ready only when nothing is left, including filings that wait on a structure", () => {
    expect(readyForFirstSale(allDone)).toBe(true);
    const waiting: JourneyInput = { ...allDone, structure: undecided, plan: { ...allDone.plan, waitsOnStructure: true } };
    expect(readyForFirstSale(waiting)).toBe(false);
    // Every view agrees: the stage stays open and the next move is the structure
    expect(journeyStages(waiting)[3]).toMatchObject({ state: "todo", detail: "Some filings wait on your business structure." });
    expect(nextMove(waiting)).toMatchObject({ href: "/structure", title: "Choose your business structure" });
  });

  it("isn't ready with questions or changed answers waiting", () => {
    expect(readyForFirstSale({ ...allDone, questions: 1 })).toBe(false);
    expect(readyForFirstSale({ ...allDone, answersChanged: true })).toBe(false);
    expect(readyForFirstSale({ ...allDone, plan: { ...allDone.plan, steps: 0 } })).toBe(false);
  });
});

describe("journeyStages", () => {
  it("puts Business structure before the check, and marks the first open stage up next", () => {
    const start: JourneyInput = { ...base, business: "none", researched: false, structure: { structure: null, from: null, recorded: false }, plan: { ...base.plan, steps: 0, first: null }, documents: { total: 0, waiting: 0 } };
    expect(states(start)).toEqual([
      ["/business", "now"],
      ["/structure", "todo"],
      ["/requirements", "todo"],
      ["/start", "todo"],
      ["/documents", "anytime"],
    ]);
    expect(journeyStages(start).map((stage) => stage.title)).toEqual(["Your business", "Business structure", "What applies to you", "Licenses and registrations", "Documents"]);
  });

  it("shows done stages and the paperwork's progress", () => {
    const stages = journeyStages(base);
    expect(stages.map((stage) => stage.state)).toEqual(["done", "done", "done", "now", "anytime"]);
    expect(stages[1].detail).toBe("You chose an LLC.");
    expect(stages[3].detail).toBe("1 of 4 steps done before your first sale.");
    expect(stages[4].detail).toMatch(/^2 documents/);
  });

  it("keeps What applies to you open while questions are left", () => {
    const stages = journeyStages({ ...base, questions: 3 });
    expect(stages[2]).toMatchObject({ state: "now", detail: "3 quick questions left to answer." });
  });

  it("says when the owner isn't sure of a structure yet, without holding up the check", () => {
    const stages = journeyStages({ ...base, structure: undecided, researched: false, plan: { ...base.plan, steps: 0, first: null } });
    expect(stages[1]).toMatchObject({ state: "todo", detail: expect.stringMatching(/not sure yet/) });
    expect(stages[2].state).toBe("now");
  });

  it("marks stages that wait on the owner, without moving up next past them", () => {
    expect(states({ ...base, answersChanged: true, documents: { total: 3, waiting: 1 } })).toEqual([
      ["/business", "done"],
      ["/structure", "done"],
      ["/requirements", "check"],
      ["/start", "todo"],
      ["/documents", "check"],
    ]);
  });

  it("finishes the paperwork stage when every step before selling is done, or none has to be", () => {
    expect(journeyStages({ ...base, plan: { ...base.plan, beforeSelling: { total: 4, done: 4 }, first: null } })[3]).toMatchObject({
      state: "done",
      detail: "All 4 steps before your first sale are done.",
    });
    expect(journeyStages({ ...base, plan: { ...base.plan, beforeSelling: { total: 0, done: 0 }, first: null } })[3].state).toBe("done");
  });

  it("names a structure the business already registered as", () => {
    expect(journeyStages({ ...base, structure: { structure: "sole_proprietorship", from: "registered", recorded: false } })[1].detail).toBe("Already registered as a sole proprietorship.");
  });
});
