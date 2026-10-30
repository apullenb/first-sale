import { describe, expect, it } from "vitest";
import { PLAN_TOPICS } from "@/lib/domain";
import { placeOf, type StructureDecision } from "@/lib/research/applicability";
import { testProfile } from "@/test/fixtures";
import {
  answerFor,
  groupKeyOf,
  nextTaskAfter,
  type PaperStep,
  type PaperworkContext,
  paperwork,
  type SavedAnswer,
  splitByTime,
  standingOf,
  stepLinks,
  stillToSettle,
  summaryOf,
} from "./paperwork";
import { MAX_SITTING_MINUTES, stepMinutes } from "./progress";

const profile = testProfile({ location: { state: "TX", county: "Travis", city: "Austin", insideCityLimits: "yes" } });
const undecided: StructureDecision = { structure: null, from: null };

const context = (overrides: Partial<PaperworkContext> = {}): PaperworkContext => ({
  profile,
  place: placeOf(profile),
  decision: undecided,
  answers: [],
  ...overrides,
});

const step = (key: string, overrides: Partial<PaperStep> = {}): PaperStep => ({
  id: `id-${key}`,
  key,
  title: `Step ${key}`,
  topic: "license_permit",
  level: "state",
  status: "todo",
  requirementStatus: "verified",
  conditions: [],
  verification: "sourced",
  forStructures: [],
  timing: "before_selling",
  prerequisites: [],
  feeCents: null,
  question: "",
  ...overrides,
});

const TAXED = "Only if you sell anything Texas taxes.";
const conditional = (key: string, overrides: Partial<PaperStep> = {}) =>
  step(key, { requirementStatus: "conditional", conditions: [TAXED], question: TAXED, ...overrides });
const said = (key: string, answer: SavedAnswer["answer"], condition = TAXED): SavedAnswer => ({ stepKey: key, condition, answer });

const inclusion = (each: PaperStep, overrides: Partial<PaperworkContext> = {}) => standingOf(each, context(overrides)).inclusion;

describe("what counts as a task", () => {
  it("lists a requirement an official page confirms, and one First Sale decided applies", () => {
    expect(inclusion(step("a"))).toBe("task");
    expect(standingOf(step("b", { requirementStatus: "needs_confirmation", verification: "needs_verification" }), context())).toMatchObject({ inclusion: "task", requirementStatus: "needs_confirmation" });
  });

  it("makes a rule even the deeper look couldn't settle a step to find out for sure", () => {
    const unsettled = step("c", { requirementStatus: "to_find_out", verification: "needs_verification" });
    expect(standingOf(unsettled, context())).toMatchObject({ inclusion: "confirm", requirementStatus: "to_find_out" });
  });

  it("leaves out optional rules and rules outside what First Sale checks", () => {
    expect(inclusion(step("a", { requirementStatus: "optional" }))).toBe("optional");
    expect(inclusion(step("b", { requirementStatus: "outside_coverage" }))).toBe("outside");
  });

  it("asks before listing a requirement that depends on something, and follows the owner's answer", () => {
    const permit = conditional("permit");
    expect(inclusion(permit)).toBe("question");
    expect(inclusion(permit, { answers: [said("permit", "yes")] })).toBe("task");
    expect(inclusion({ ...permit, verification: "needs_verification" }, { answers: [said("permit", "yes")] })).toBe("task");
    expect(inclusion(permit, { answers: [said("permit", "no")] })).toBe("no");
    // "Not decided yet" is never a no: the step stays in, so the owner is covered
    const unsure = standingOf(permit, context({ answers: [said("permit", "unsure")] }));
    expect(unsure).toMatchObject({ inclusion: "task", conditions: [TAXED], answer: "unsure" });
  });

  it("asks again when the condition is reworded, and never matches another step's answer", () => {
    expect(inclusion(conditional("permit"), { answers: [said("permit", "yes", "Only if you sell taxable food.")] })).toBe("question");
    expect(inclusion(conditional("permit"), { answers: [said("other", "yes")] })).toBe("question");
    expect(answerFor([said("permit", "no", "Only if  you sell anything Texas taxes. ")], "permit", TAXED)).toBe("no");
  });

  it("holds structure-specific steps until the owner chooses, then keeps or rules them out", () => {
    const llc = step("llc", { topic: "structure", forStructures: ["llc"], feeCents: 30_000 });
    expect(inclusion(llc)).toBe("structure");
    expect(inclusion(llc, { decision: { structure: "llc", from: "decision" } })).toBe("task");
    expect(inclusion(llc, { decision: { structure: "sole_proprietorship", from: "decision" } })).toBe("other_structure");
  });

  it("sends the step that chooses a structure to Business structure", () => {
    expect(inclusion(step("structure", { topic: "structure" }))).toBe("structure_choice");
  });

  it("turns a rule for an unknown place into a step to find out, never a dead end", () => {
    const city = step("city", { level: "city", requirementStatus: "needs_confirmation", verification: "needs_verification" });
    const unknown = placeOf(testProfile({ location: { state: "TX", county: "Travis", city: "Austin", insideCityLimits: "unsure" } }));
    expect(standingOf(city, context({ place: unknown }))).toMatchObject({ inclusion: "check_place", requirementStatus: "conditional" });
    expect(standingOf(city, context({ place: unknown })).conditions[0]).toMatch(/inside Austin city limits/);
    expect(inclusion(city)).toBe("task");
    const noCounty = placeOf(testProfile({ location: { state: "TX", county: "", city: "Austin", insideCityLimits: "unsure" } }));
    const view = paperwork([city, step("county", { level: "county" })], context({ place: noCounty }));
    expect(view.tasks.map((task) => [task.step.key, task.kind, task.state])).toEqual([
      ["city", "check_place", "ready"],
      ["county", "check_place", "ready"],
    ]);
    expect(view.open).toEqual([]);
    expect(view.first?.kind).toBe("check_place");
  });

  it("never asks the owner about a government's rules: those are First Sale's to decide", () => {
    const rule = "Whether Denton County requires any permit for home storage, customer visits, or market sales";
    const saved = step("county-permit", { level: "county", requirementStatus: "conditional", verification: "needs_verification", conditions: [rule], question: rule });
    expect(standingOf(saved, context())).toMatchObject({ inclusion: "task", question: null });
    const legacy = { ...saved, question: "" };
    expect(standingOf(legacy, context()).inclusion).toBe("task");
    const approval = "You do work that needs county approval or you file a county DBA.";
    expect(standingOf(step("county", { requirementStatus: "conditional", conditions: [approval], question: approval }), context()).inclusion).toBe("task");
  });

  it("reads plans saved before questions were kept", () => {
    const legacy = step("permit", { requirementStatus: "conditional", conditions: [TAXED, "Only if you set up as an LLC. Decide your business structure first."], question: "" });
    expect(standingOf(legacy, context()).question).toBe(TAXED);
    const rulesOnly = step("llc", { requirementStatus: "conditional", conditions: ["Only if you set up as an LLC. Decide your business structure first."], forStructures: ["llc"], question: "" });
    expect(standingOf(rulesOnly, context({ decision: { structure: "llc", from: "decision" } })).inclusion).toBe("task");
  });
});

describe("paperwork groups", () => {
  it("groups tasks by topic in a fixed order, with later steps last and only groups that have tasks", () => {
    const steps = [
      step("license", { topic: "license_permit" }),
      step("ein", { topic: "tax_registration" }),
      step("franchise", { topic: "tax_registration", timing: "later" }),
      step("name", { topic: "name_registration" }),
      step("extra", { requirementStatus: "optional", topic: "other" }),
    ];
    const view = paperwork(steps, context());
    expect(view.groups.map((group) => [group.key, group.tasks.map((task) => task.step.key)])).toEqual([
      ["register", ["name"]],
      ["tax-ids", ["ein"]],
      ["licenses", ["license"]],
      ["after-you-open", ["franchise"]],
    ]);
    expect(groupKeyOf({ topic: "employer", timing: "before_selling" })).toBe("hiring");
  });

  it("splits a group over 90 minutes into parts, in plan order, and keeps the parts as tasks get done", () => {
    const steps = ["a", "b", "c", "d"].map((key) => step(key, { topic: "license_permit" }));
    const view = paperwork(steps, context());
    expect(view.groups.map((group) => [group.name, group.minutes, group.tasks.map((task) => task.step.key)])).toEqual([
      ["Licenses and permits, part 1 of 2", 90, ["a", "b"]],
      ["Licenses and permits, part 2 of 2", 90, ["c", "d"]],
    ]);
    expect(view.groups.map((group) => group.href)).toEqual(["/start/licenses-1", "/start/licenses-2"]);
    const later = paperwork([{ ...steps[0], status: "done" as const }, ...steps.slice(1)], context());
    expect(later.groups.map((group) => [group.key, group.minutesLeft])).toEqual([
      ["licenses-1", 45],
      ["licenses-2", 90],
    ]);
  });

  it("splits into as few parts as fit, as evenly as it can", () => {
    expect(splitByTime([30, 30, 30, 30, 30], (n) => n)).toEqual([[30, 30, 30], [30, 30]]);
    expect(splitByTime([20, 30, 30, 30], (n) => n)).toEqual([[20, 30], [30, 30]]);
    expect(splitByTime([60, 45, 60, 45], (n) => n)).toHaveLength(4);
    expect(splitByTime([], (n: number) => n)).toEqual([]);
  });

  it("never estimates one task over 90 minutes", () => {
    for (const topic of PLAN_TOPICS) expect(stepMinutes({ topic })).toBeLessThanOrEqual(MAX_SITTING_MINUTES);
  });

  it("holds a place for filings that wait on a structure decision", () => {
    const steps = [step("llc", { topic: "structure", forStructures: ["llc"], feeCents: 30_000 }), step("license")];
    const view = paperwork(steps, context());
    expect(view.groups[0]).toMatchObject({ key: "register", tasks: [], state: "locked", waitsOn: ["Business structure"], left: 0 });
    expect(view.groups[0].waitingOnStructure.map((each) => each.step.key)).toEqual(["llc"]);
  });

  it("folds the smallest groups into Other steps when there are too many for the menu", () => {
    const topics = ["structure", "tax_registration", "location_zoning", "license_permit", "other"] as const;
    const steps = [...topics.map((topic) => step(topic, { topic, feeCents: topic === "structure" ? 100 : null })), step("later", { timing: "later" })];
    const view = paperwork(steps, context());
    expect(view.groups.map((group) => group.key)).toEqual(["register", "tax-ids", "licenses", "other", "after-you-open"]);
    expect(view.groups.find((group) => group.key === "other")?.tasks.map((task) => task.step.key)).toEqual(["location_zoning", "other"]);
    // Never more than five, however many kinds of steps there are
    const many = [...steps, step("zoning-2", { topic: "location_zoning" }), step("hire", { topic: "employer" }), step("hire-2", { topic: "employer" })];
    expect(new Set(paperwork(many, context()).groups.map((group) => group.base)).size).toBe(5);
    // Five or fewer stay as they are
    expect(paperwork(steps.slice(0, 4), context()).groups.map((group) => group.key)).toEqual(["register", "tax-ids", "where-you-work", "licenses"]);
  });

  it("writes each summary from the step's own words, kept short", () => {
    expect(summaryOf({ why: "Texas requires it. More detail here.", doneWhen: "Done." })).toBe("Texas requires it.");
    expect(summaryOf({ why: "", doneWhen: "You have your permit." })).toBe("You have your permit.");
    expect(summaryOf({ why: `${"word ".repeat(40)}end.` }).length).toBeLessThanOrEqual(141);
  });
});

describe("locks", () => {
  it("locks a task until the step before it is done, and an office's wait still locks it", () => {
    const steps = [step("ein", { topic: "tax_registration" }), step("permit", { topic: "license_permit", prerequisites: ["ein"] })];
    const view = paperwork(steps, context());
    const permit = view.tasks.find((task) => task.step.key === "permit")!;
    expect(permit).toMatchObject({ state: "locked", blockers: [{ title: "Step ein", where: "Get your tax IDs", office: false }] });
    expect(view.groups.find((group) => group.key === "licenses")).toMatchObject({ state: "locked", waitsOn: ["Get your tax IDs"] });

    const sent = paperwork([{ ...steps[0], status: "submitted" as const }, steps[1]], context());
    expect(sent.tasks.map((task) => task.state)).toEqual(["waiting", "locked"]);
    expect(sent.groups.map((group) => group.state)).toEqual(["waiting", "waiting"]);

    const approved = paperwork([{ ...steps[0], status: "done" as const }, steps[1]], context());
    expect(approved.tasks.map((task) => task.state)).toEqual(["done", "ready"]);
    expect(approved.groups.map((group) => group.state)).toEqual(["done", "todo"]);
  });

  it("waits on Business structure and on an answer, but never on a step that doesn't apply", () => {
    const steps = [
      step("structure", { topic: "structure" }),
      step("extra", { requirementStatus: "optional", topic: "tax_registration" }),
      conditional("food"),
      step("a", { prerequisites: ["structure"] }),
      step("b", { prerequisites: ["extra"] }),
      step("c", { prerequisites: ["food"] }),
    ];
    const view = paperwork(steps, context());
    const byKey = new Map(view.tasks.map((task) => [task.step.key, task]));
    expect(byKey.get("a")?.blockers).toEqual([{ title: "Choose your business structure", href: "/structure", where: "Business structure", office: false, taskKey: null }]);
    expect(byKey.get("b")?.state).toBe("ready");
    expect(byKey.get("c")?.blockers[0]).toMatchObject({ where: "What applies to you", href: "/requirements#questions" });
    const no = paperwork(steps, context({ answers: [said("food", "no")] }));
    expect(no.tasks.find((task) => task.step.key === "c")?.state).toBe("ready");
  });

  it("keeps a step the owner hasn't decided on, waiting on its prerequisites like any other", () => {
    const steps = [step("structure", { topic: "structure" }), conditional("permit", { prerequisites: ["structure"] })];
    expect(paperwork(steps, context({ answers: [said("permit", "unsure")] })).tasks[0]).toMatchObject({ kind: "task", state: "locked" });
    expect(paperwork(steps, context({ answers: [said("permit", "yes")] })).tasks[0]).toMatchObject({ kind: "task", state: "locked" });
  });

  it("calls a group ready while any task in it can start, and picks the next task to do", () => {
    const steps = [step("a"), step("b", { prerequisites: ["a"] }), step("later", { timing: "later" })];
    const view = paperwork(steps, context());
    expect(view.groups[0]).toMatchObject({ state: "todo", left: 2, minutesLeft: 90 });
    expect(view.groups[0].next?.step.key).toBe("a");
    expect(view.first?.step.key).toBe("a");
    const done = paperwork([{ ...steps[0], status: "done" as const }, { ...steps[1], status: "done" as const }, steps[2]], context());
    expect(done.first?.step.key).toBe("later");
  });

  it("never asks about a city rule once the owner says they're outside city limits", () => {
    const outside = placeOf(testProfile({ location: { state: "TX", county: "Travis", city: "Austin", insideCityLimits: "no" } }));
    const home = conditional("home-permit", { level: "city" });
    const view = paperwork([home], context({ place: outside }));
    expect(view.standings[0].inclusion).toBe("place");
    expect(view.open).toEqual([]);
    expect(view.tasks).toEqual([]);
  });

  it("lists only the quick questions as open; places become steps or, outside city limits, maybes", () => {
    const outside = placeOf(testProfile({ location: { state: "TX", county: "Travis", city: "Austin", insideCityLimits: "no" } }));
    const steps = [conditional("food"), step("city", { level: "city" }), step("county", { level: "county" })];
    expect(paperwork(steps, context()).open.map((each) => each.step.key)).toEqual(["food"]);
    expect(paperwork(steps, context({ place: outside })).open.map((each) => each.step.key)).toEqual(["food"]);
    expect(stillToSettle(paperwork(steps, context({ place: outside }))).map((each) => each.step.key)).toEqual(["food", "city"]);
    const unknown = placeOf(testProfile({ location: { state: "TX", county: "", city: "Austin", insideCityLimits: "unsure" } }));
    expect(paperwork(steps, context({ place: unknown })).open.map((each) => each.step.key)).toEqual(["food"]);
  });

  it("says what's missing about the place when a step waits on it, and sends the owner to their answers", () => {
    const noCounty = placeOf(testProfile({ location: { state: "TX", county: "", city: "Austin", insideCityLimits: "yes" } }));
    const steps = [step("county-permit", { level: "county" }), step("after", { prerequisites: ["county-permit"] })];
    const after = paperwork(steps, context({ place: noCounty })).tasks.find((task) => task.step.key === "after")!;
    expect(after).toMatchObject({ state: "locked", blockers: [{ title: "Add your county to your answers", href: "/business/edit", where: "Your business", taskKey: null }] });
  });
});

describe("stepLinks", () => {
  it("lists a step's prerequisites by the same rules as the locks", () => {
    const steps = [
      conditional("permit", { topic: "tax_registration" }),
      step("extra", { requirementStatus: "optional" }),
      step("llc", { topic: "structure", forStructures: ["llc"], feeCents: 30_000 }),
      step("sent", { status: "submitted" }),
      step("finished", { status: "done" }),
      step("returns", { prerequisites: ["permit", "extra", "llc", "sent", "finished", "retired-step"] }),
    ];
    const sole = context({ answers: [said("permit", "no")], decision: { structure: "sole_proprietorship", from: "decision" } });
    const view = paperwork(steps, sole);
    const links = stepLinks(view, steps[5], sole.place);
    // A no, an optional rule, another structure and a step gone from the plan never hold it up
    expect(links.before.map((each) => [each.title, each.done, each.office])).toEqual([
      ["Step sent", false, true],
      ["Step finished", true, false],
    ]);
    expect(view.tasks.find((task) => task.step.key === "returns")?.blockers.map((each) => each.title)).toEqual(["Step sent"]);
    expect(stepLinks(view, steps[3], sole.place).after.map((task) => task.step.key)).toEqual(["returns"]);
  });
});

describe("nextTaskAfter", () => {
  it("sends the owner to the next ready task, then back to earlier ones, before anything for later", () => {
    const steps = [step("a"), step("b", { prerequisites: ["a"] }), step("c"), step("d", { timing: "later" })];
    const view = paperwork(steps, context());
    const key = (each: ReturnType<typeof nextTaskAfter>) => each?.step.key ?? null;
    expect(key(nextTaskAfter(view.tasks, "a"))).toBe("c");
    expect(key(nextTaskAfter(view.tasks, "c"))).toBe("a");
    expect(key(nextTaskAfter(view.tasks, null))).toBe("a");
    const done = paperwork(steps.map((each) => (each.key === "d" ? each : { ...each, status: "done" as const })), context());
    expect(key(nextTaskAfter(done.tasks, "c"))).toBe("d");
  });
});
