import { describe, expect, it } from "vitest";
import { placeOf } from "@/lib/research/applicability";
import { testProfile, verifiedRequirement } from "@/test/fixtures";
import {
  applyPlan,
  buildPlan,
  choosesStructure,
  type CurrentTask,
  diffPlan,
  followingSteps,
  type PlanTaskDraft,
  type ReadSource,
  settleStructureChoice,
  slugKey,
} from "./plan";

const sources: ReadSource[] = [
  { id: "irs-ein", title: "IRS: EIN", url: "https://www.irs.gov/ein", government: "Internal Revenue Service", retrievedAt: "2026-10-26T15:00:00.000Z" },
  { id: "sba", title: "SBA", url: "https://www.sba.gov/x", government: "Small Business Administration", retrievedAt: "2026-10-27T09:00:00.000Z" },
];

describe("slugKey", () => {
  it("makes short lowercase ids", () => {
    expect(slugKey("Sales Tax Permit!")).toBe("sales-tax-permit");
    expect(slugKey("  --Café licence--  ")).toBe("cafe-licence");
    expect(slugKey("a".repeat(30) + " " + "b".repeat(30))).toBe("a".repeat(30) + "-" + "b".repeat(9));
    expect(slugKey("!!!")).toBe("step");
  });
});

describe("rules SnapStart decided", () => {
  const place = placeOf(testProfile({ location: { state: "TX", county: "Denton County", city: "Aubrey", insideCityLimits: "yes" } }));
  const decided = (key: string, { background = "", ...overrides }: Parameters<typeof verifiedRequirement>[0] & { background?: string } = {}) => ({
    ...verifiedRequirement({ key, title: `Rule ${key}`, level: "city", agency: "City clerk", ...overrides }),
    status: "needs_confirmation" as const,
    background,
  });
  const aubrey = {
    key: "city:city-of-aubrey",
    name: "City of Aubrey",
    level: "city" as const,
    contacts: { emails: [{ value: "permits@aubreytx.gov", url: "https://www.aubreytx.gov/contact" }], phones: [] },
    site: { title: "Contact us", url: "https://www.aubreytx.gov/contact" },
  };

  it("makes each one its own step, with SnapStart's reason and the office's contacts, never a step to ask the office", () => {
    const plan = buildPlan(
      [decided("license", { background: "Aubrey licenses businesses that sell from home." }), decided("home"), verifiedRequirement({ key: "ein", level: "federal", verification: "sourced" })],
      sources,
      false,
      { place, offices: [aubrey] },
    );
    expect(plan.map((step) => step.key)).toEqual(["license", "home", "ein"]);
    expect(plan[0]).toMatchObject({ notes: [{ title: "Rule license", background: "Aubrey licenses businesses that sell from home." }], contacts: aubrey.contacts, uncertainty: [] });
    expect(plan[2].contacts).toBeNull();
  });

  it("sends rules even the deeper look couldn't settle to their office: one step and one message for each", () => {
    const plan = buildPlan(
      [{ ...decided("license"), status: "to_find_out" as const }, { ...decided("home"), status: "to_find_out" as const }, decided("sign")],
      sources,
      false,
      { place, offices: [aubrey] },
    );
    expect(plan.map((step) => step.key)).toEqual(["ask-city-of-aubrey", "sign"]);
    expect(plan[0]).toMatchObject({ title: "Ask the City of Aubrey about 2 requirements", requirementStatus: "to_find_out", contacts: aubrey.contacts });
  });

  it("leaves out rules SnapStart decided aren't needed", () => {
    const plan = buildPlan([{ ...decided("sign"), status: "not_needed" as const }, decided("license")], sources, false, { place, offices: [aubrey] });
    expect(plan.map((step) => step.key)).toEqual(["license"]);
  });
});

describe("buildPlan", () => {
  it("keys steps by the model's keys, made unique", () => {
    const plan = buildPlan(
      [
        verifiedRequirement({ key: "EIN", title: "Get an EIN" }),
        verifiedRequirement({ key: "ein", title: "Another EIN" }),
        verifiedRequirement({ key: "ein", title: "And another" }),
        verifiedRequirement({ key: "", title: "Home Business Permit" }),
      ],
      sources,
    );
    expect(plan.map((step) => step.key)).toEqual(["ein", "ein-2", "ein-3", "home-business-permit"]);
  });

  it("gives the same keys for the same requirements every time", () => {
    const requirements = [verifiedRequirement({ key: "sales-tax" }), verifiedRequirement({ key: "ein" })];
    expect(buildPlan(requirements, sources).map((step) => step.key)).toEqual(
      buildPlan(requirements, sources).map((step) => step.key),
    );
  });

  it("maps prerequisites by key and drops unknown, self and repeated ones", () => {
    const plan = buildPlan(
      [
        verifiedRequirement({ key: "structure" }),
        verifiedRequirement({ key: "ein", dependsOn: ["Structure", "made-up", "ein", "structure"] }),
      ],
      sources,
    );
    expect(plan.find((step) => step.key === "ein")?.prerequisites).toEqual(["structure"]);
  });

  it("points a prerequisite at the first step with that key", () => {
    const plan = buildPlan(
      [
        verifiedRequirement({ key: "ein", title: "First" }),
        verifiedRequirement({ key: "ein", title: "Second" }),
        verifiedRequirement({ key: "payroll", dependsOn: ["ein"] }),
      ],
      sources,
    );
    expect(plan.find((step) => step.key === "payroll")?.prerequisites).toEqual(["ein"]);
  });

  it("drops the edge that would close a loop instead of throwing", () => {
    const plan = buildPlan(
      [
        verifiedRequirement({ key: "a", dependsOn: ["b"] }),
        verifiedRequirement({ key: "b", dependsOn: ["c"] }),
        verifiedRequirement({ key: "c", dependsOn: ["a"] }),
      ],
      sources,
    );
    const prerequisites = Object.fromEntries(plan.map((step) => [step.key, step.prerequisites]));
    expect(prerequisites).toEqual({ a: ["b"], b: ["c"], c: [] });
    expect(plan.map((step) => step.key)).toEqual(["c", "b", "a"]);
  });

  it("puts prerequisites first and otherwise keeps the model's order", () => {
    const plan = buildPlan(
      [
        verifiedRequirement({ key: "payroll", dependsOn: ["ein"] }),
        verifiedRequirement({ key: "license" }),
        verifiedRequirement({ key: "ein", dependsOn: ["structure"] }),
        verifiedRequirement({ key: "structure" }),
      ],
      sources,
    );
    expect(plan.map((step) => step.key)).toEqual(["license", "structure", "ein", "payroll"]);
  });

  it("keeps a fee, in cents, only when there is one, with when its page was read", () => {
    const [paid, free, none, unsourced] = buildPlan(
      [
        verifiedRequirement({ key: "paid", feeUsd: 19.999, sourceIds: ["irs-ein", "sba"], verification: "sourced" }),
        verifiedRequirement({ key: "free", feeUsd: 0, sourceIds: ["irs-ein"], verification: "sourced" }),
        verifiedRequirement({ key: "none", feeUsd: null, sourceIds: ["irs-ein"], verification: "sourced" }),
        verifiedRequirement({ key: "unsourced", feeUsd: 5, sourceIds: [] }),
      ],
      sources,
    );
    expect(paid).toMatchObject({ feeCents: 2000, feeCheckedAt: "2026-10-27T09:00:00.000Z" });
    expect(free).toMatchObject({ feeCents: 0, feeCheckedAt: "2026-10-26T15:00:00.000Z" });
    expect(none).toMatchObject({ feeCents: null, feeCheckedAt: null });
    expect(unsourced).toMatchObject({ feeCents: 500, feeCheckedAt: null });
  });

  it("never passes doubt on to the owner as a step's uncertainty", () => {
    const plan = buildPlan(
      [
        verifiedRequirement({ key: "cited", sourceIds: ["irs-ein"], verification: "needs_verification" }),
        verifiedRequirement({ key: "uncited", sourceIds: [], verification: "needs_verification", needsProfessional: true }),
      ],
      sources,
    );
    expect(plan.map((step) => step.uncertainty)).toEqual([[], []]);
  });

  it("links each cited page, marking it as confirming only when the step is sourced", () => {
    const [sourced, unchecked] = buildPlan(
      [
        verifiedRequirement({ key: "sourced", sourceIds: ["irs-ein", "not-read"], verification: "sourced" }),
        verifiedRequirement({ key: "unchecked", sourceIds: ["sba"], verification: "needs_verification" }),
      ],
      sources,
    );
    expect(sourced.links).toEqual([
      { title: "IRS: EIN", url: "https://www.irs.gov/ein", government: "Internal Revenue Service", confirms: true },
    ]);
    expect(unchecked.links).toEqual([
      { title: "SBA", url: "https://www.sba.gov/x", government: "Small Business Administration", confirms: false },
    ]);
  });

  it("carries the requirement's details into the step", () => {
    const [step] = buildPlan(
      [
        verifiedRequirement({
          key: "ein",
          title: "Get an EIN",
          topic: "tax_registration",
          level: "federal",
          whyItApplies: "Banks ask for one.",
          agency: "IRS",
          gather: ["Your SSN"],
          deadline: "before you hire",
          whoToCall: "the IRS",
          whatToAsk: ["Do I need one?"],
          doneWhen: "You have your EIN.",
        }),
      ],
      sources,
    );
    expect(step).toMatchObject({
      title: "Get an EIN",
      topic: "tax_registration",
      level: "federal",
      why: "Banks ask for one.",
      agency: "IRS",
      prepare: ["Your SSN"],
      deadline: "before you hire",
      whoToCall: "the IRS",
      whatToAsk: ["Do I need one?"],
      doneWhen: "You have your EIN.",
    });
    expect(step).not.toHaveProperty("id");
  });
});

describe("choosing a structure", () => {
  const choose = { topic: "structure", forStructures: [], feeCents: null, status: "todo" };
  const formLlc = { topic: "structure", forStructures: ["llc"], feeCents: 30000, status: "todo" };
  const unnamedFiling = { topic: "structure", forStructures: [], feeCents: 30000, status: "todo" };
  const ein = { topic: "tax_registration", forStructures: [], feeCents: 0, status: "todo" };

  it("is only the step with no structure named and no fee", () => {
    expect([choose, formLlc, unnamedFiling, ein].map(choosesStructure)).toEqual([true, false, false, false]);
  });

  it("is settled by a known structure, and stays open while undecided", () => {
    expect(settleStructureChoice([choose, formLlc, ein], true).map((step) => step.status)).toEqual(["done", "todo", "todo"]);
    expect(settleStructureChoice([choose, formLlc, ein], false).map((step) => step.status)).toEqual(["todo", "todo", "todo"]);
  });
});

describe("followingSteps", () => {
  it("lists the steps waiting on one", () => {
    const steps = [
      { key: "a", prerequisites: [] },
      { key: "b", prerequisites: ["a"] },
      { key: "c", prerequisites: ["b", "a"] },
    ];
    expect(followingSteps(steps, "a").map((step) => step.key)).toEqual(["b", "c"]);
  });
});

const step = (key: string, overrides: Partial<PlanTaskDraft> = {}): PlanTaskDraft => ({
  key,
  title: `Step ${key}`,
  topic: "other",
  level: "state",
  why: "Why",
  agency: "",
  links: [],
  prepare: [],
  feeCents: null,
  feeCheckedAt: null,
  deadline: null,
  needsProfessional: false,
  verification: "needs_verification",
  uncertainty: [],
  whoToCall: "",
  whatToAsk: [],
  doneWhen: "",
  prerequisites: [],
  requirementStatus: "needs_confirmation",
  conditions: [],
  timing: "before_selling",
  forStructures: [],
  renewal: null,
  jurisdiction: "",
  alreadyHave: null,
  question: "",
  ...overrides,
});

const current = (key: string, overrides: Partial<CurrentTask> = {}): CurrentTask => ({
  ...step(key),
  id: `id-${key}`,
  status: "todo",
  retired: false,
  ...overrides,
});

const link = (url: string) => ({ title: url, url, government: "", confirms: true });

describe("diffPlan", () => {
  it("lists added and removed steps, saying whether a removed one was done", () => {
    const changes = diffPlan(
      [current("kept"), current("gone"), current("done-gone", { status: "done" })],
      [step("kept"), step("new")],
    );
    expect(changes).toEqual([
      { kind: "added", key: "new", title: "Step new" },
      { kind: "removed", key: "gone", title: "Step gone", done: false },
      { kind: "removed", key: "done-gone", title: "Step done-gone", done: true },
    ]);
  });

  it("names each consequential change", () => {
    const before = current("x", {
      feeCents: 100,
      deadline: "within 30 days",
      verification: "needs_verification",
      links: [link("https://a.gov/1")],
      prerequisites: ["a"],
      level: "state",
    });
    const after = step("x", {
      feeCents: 200,
      deadline: "within 60 days",
      verification: "sourced",
      links: [link("https://a.gov/2")],
      prerequisites: ["b"],
      level: "county",
    });
    expect(diffPlan([before], [after])).toEqual([
      {
        kind: "changed",
        key: "x",
        title: "Step x",
        what: ["Fee", "Deadline", "Whether an official page confirms it", "Official links", "Steps to finish first", "Which government it comes from"],
      },
    ]);
    expect(diffPlan([current("x", { topic: "other" })], [step("x", { topic: "license_permit" })])[0]).toMatchObject({
      what: ["Which government it comes from"],
    });
  });

  it("doesn't count rewording, or the same links in another order, as a change", () => {
    const before = current("x", { links: [link("https://a.gov/1"), link("https://a.gov/2")], prerequisites: ["a", "b"] });
    const after = step("x", {
      title: "Reworded title",
      why: "Reworded why",
      agency: "Another name for the office",
      whatToAsk: ["New question?"],
      prepare: ["Something"],
      doneWhen: "Reworded",
      uncertainty: ["Reworded"],
      links: [link("https://a.gov/2"), { ...link("https://a.gov/1"), title: "Renamed" }],
      prerequisites: ["b", "a"],
    });
    expect(diffPlan([before], [after])).toEqual([]);
  });

  it("ignores retired steps, so bringing one back counts as added", () => {
    expect(diffPlan([current("x", { status: "done", retired: true })], [step("x")])).toEqual([
      { kind: "added", key: "x", title: "Step x" },
    ]);
    expect(diffPlan([current("x", { status: "done", retired: true })], [])).toEqual([]);
  });
});

describe("applyPlan", () => {
  it("keeps the old step when its change isn't accepted, and takes it when it is", () => {
    const before = current("fee", { feeCents: 100, title: "Old title" });
    const after = step("fee", { feeCents: 200, title: "New title" });

    const kept = applyPlan([before], [after], new Set());
    expect(kept).toEqual({ upserts: [{ ...step("fee", { feeCents: 100, title: "Old title" }), id: "id-fee", position: 0, retired: false }], deleteIds: [] });

    const taken = applyPlan([before], [after], new Set(["fee"]));
    expect(taken.upserts).toEqual([{ ...after, id: "id-fee", position: 0, retired: false }]);
  });

  it("takes rewording without asking", () => {
    const { upserts } = applyPlan([current("x")], [step("x", { title: "Clearer title" })], new Set());
    expect(upserts).toEqual([{ ...step("x", { title: "Clearer title" }), id: "id-x", position: 0, retired: false }]);
  });

  it("deletes a removed todo step but retires a removed done one, only when accepted", () => {
    const tasks = [current("todo"), current("done", { status: "done" })];

    const accepted = applyPlan(tasks, [], new Set(["todo", "done"]));
    expect(accepted.deleteIds).toEqual(["id-todo"]);
    expect(accepted.upserts).toEqual([{ ...step("done"), id: "id-done", position: 0, retired: true }]);

    const declined = applyPlan(tasks, [], new Set());
    expect(declined.deleteIds).toEqual([]);
    expect(declined.upserts.map(({ key, retired }) => ({ key, retired }))).toEqual([
      { key: "todo", retired: false },
      { key: "done", retired: false },
    ]);
  });

  it("inserts added steps only when accepted", () => {
    expect(applyPlan([current("a")], [step("a"), step("b")], new Set()).upserts.map((row) => row.key)).toEqual(["a"]);
    const { upserts } = applyPlan([current("a")], [step("a"), step("b")], new Set(["b"]));
    expect(upserts.map(({ key, id, position }) => ({ key, id, position }))).toEqual([
      { key: "a", id: "id-a", position: 0 },
      { key: "b", id: null, position: 1 },
    ]);
  });

  it("reuses a retired step's row when it's brought back", () => {
    const { upserts } = applyPlan([current("x", { status: "done", retired: true })], [step("x")], new Set(["x"]));
    expect(upserts).toEqual([{ ...step("x"), id: "id-x", position: 0, retired: false }]);
    const declined = applyPlan([current("x", { status: "done", retired: true })], [step("x")], new Set());
    expect(declined.upserts).toEqual([{ ...step("x"), id: "id-x", position: 0, retired: true }]);
  });

  it("never writes a step's status", () => {
    const tasks = [current("a", { status: "done" }), current("b", { status: "done" }), current("c")];
    const { upserts } = applyPlan(tasks, [step("a", { feeCents: 5 }), step("d")], new Set(["a", "b", "d"]));
    expect(upserts.length).toBeGreaterThan(0);
    for (const row of upserts) expect(row).not.toHaveProperty("status");
  });

  it("orders rows by the new plan, then the steps it kept", () => {
    const { upserts } = applyPlan([current("old"), current("b")], [step("b"), step("new")], new Set(["new"]));
    expect(upserts.map(({ key, position }) => [key, position])).toEqual([
      ["b", 0],
      ["new", 1],
      ["old", 2],
    ]);
  });
});

describe("applyPlan prerequisites", () => {
  const current = (draft: PlanTaskDraft, id: string, prerequisites: string[]): CurrentTask => ({ ...draft, id, prerequisites, status: "todo", retired: false });

  it("never leaves a loop when some changes are taken and others aren't", () => {
    // Now: a waits on b. Proposed: b waits on a. Taking only b's change would pair both.
    const proposed = buildPlan(
      [verifiedRequirement({ key: "a", title: "A" }), verifiedRequirement({ key: "b", title: "B", dependsOn: ["a"] })],
      sources,
    );
    const [a, b] = proposed;
    const { upserts } = applyPlan([current(a, "1", ["b"]), current(b, "2", [])], proposed, new Set(["b"]));
    const byKey = new Map(upserts.map((task) => [task.key, task]));
    expect(byKey.get("a")!.prerequisites).toEqual(["b"]);
    expect(byKey.get("b")!.prerequisites).toEqual([]);
  });
});

describe("diffPlan practice mode", () => {
  it("counts a switch between practice and real results as a change", () => {
    const [practice] = buildPlan([verifiedRequirement({ key: "ein", title: "EIN" })], sources, true);
    const changes = diffPlan([{ ...practice, id: "1", status: "todo", retired: false }], [{ ...practice, simulated: false }]);
    expect(changes).toEqual([{ kind: "changed", key: "ein", title: "EIN", what: ["Checked for real, not in practice mode"] }]);
  });
});

describe("review fixes", () => {
  it("puts the EIN after forming the LLC even when the model said the opposite", () => {
    const plan = buildPlan(
      [
        verifiedRequirement({ key: "ein", title: "Get an EIN" }),
        verifiedRequirement({ key: "llc-articles", title: "File articles of organization", forStructures: ["llc"], dependsOn: ["ein"] }),
      ],
      sources,
    );
    expect(plan.find((each) => each.key === "ein")?.prerequisites).toEqual(["llc-articles"]);
    expect(plan.find((each) => each.key === "llc-articles")?.prerequisites).toEqual([]);
    expect(plan.map((each) => each.key)).toEqual(["llc-articles", "ein"]);
  });

  it("keeps a submitted step that a later plan drops, as a record", () => {
    const current = [{ ...step("llc"), id: "id-llc", status: "submitted" as const, retired: false }];
    expect(diffPlan(current, [])).toEqual([{ kind: "removed", key: "llc", title: "Step llc", done: true }]);
    const write = applyPlan(current, [], new Set(["llc"]));
    expect(write.deleteIds).toEqual([]);
    expect(write.upserts[0]).toMatchObject({ key: "llc", retired: true });
  });
});

