import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { checklistTasks, researchSnapshots, users } from "@/db/schema";
import type { ResearchedRequirement, ResearchResult } from "@/lib/research/requirements";
import type { VerifiedRequirement } from "@/lib/research/verify";
import { buildPlan } from "@/lib/rules/plan";
import { createTestDb } from "@/test/db";
import { researchedRequirement, retrievedPage, seedOwners, testProfile, verifiedRequirement } from "@/test/fixtures";
import {
  getPlanForOwner,
  getStepForOwner,
  orderSteps,
  type PlanStep,
  replanForOwner,
  setStepStatusForOwner,
} from "./plan";
import { saveResearchForOwner } from "./research";

const FIRST = new Date("2026-10-26T15:00:00Z");
const SECOND = new Date("2026-10-27T15:00:00Z");

function research(verified: VerifiedRequirement[], checkedAt: Date): ResearchResult {
  const requirements: ResearchedRequirement[] = verified.map((requirement) => researchedRequirement(requirement));
  const pages = [retrievedPage({ retrievedAt: checkedAt.toISOString() })];
  return {
    checkedAt,
    model: "Mock",
    simulated: true,
    searched: false,
    pages,
    unread: [],
    requirements,
    assumptions: [],
    openQuestions: [],
    plan: buildPlan(requirements, pages),
    coverage: [],
    conflicts: [],
    profile: testProfile(),
    structure: null,
  };
}

const firstPlan = [
  verifiedRequirement({ key: "structure", title: "Choose a structure" }),
  verifiedRequirement({ key: "ein", title: "Get an EIN", dependsOn: ["structure"], feeUsd: 0, sourceIds: ["irs-ein"], verification: "sourced" }),
  verifiedRequirement({ key: "license", title: "Business license" }),
  verifiedRequirement({ key: "vendor", title: "Vendor permit" }),
];
const secondPlan = [
  verifiedRequirement({ key: "structure", title: "Pick a business structure" }),
  verifiedRequirement({ key: "ein", title: "Get an EIN", dependsOn: ["structure"], feeUsd: 10, sourceIds: ["irs-ein"], verification: "sourced" }),
  verifiedRequirement({ key: "sales-tax", title: "Sales tax permit", dependsOn: ["ein"] }),
];

let db: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  db = await createTestDb();
  await seedOwners(db);
});

async function stepId(ownerId: string, key: string): Promise<string> {
  const plan = await getPlanForOwner(db, ownerId);
  const step = [...(plan?.steps ?? []), ...(plan?.retired ?? [])].find((candidate) => candidate.key === key);
  if (!step) throw new Error(`No step ${key}`);
  return step.id;
}

describe("plan data access", () => {
  it("applies the first plan straight away, prerequisites first", async () => {
    await saveResearchForOwner(db, "owner-a", research(firstPlan, FIRST), "key-1");

    const plan = await getPlanForOwner(db, "owner-a");
    expect(plan?.retired).toEqual([]);
    expect(plan?.steps.map((step) => [step.key, step.status, step.position])).toEqual([
      ["structure", "todo", 0],
      ["ein", "todo", 1],
      ["license", "todo", 2],
      ["vendor", "todo", 3],
    ]);
    expect(plan?.steps[1]).toMatchObject({ feeCents: 0, feeCheckedAt: FIRST.toISOString(), prerequisites: ["structure"] });
    const [row] = await db.select().from(checklistTasks).where(eq(checklistTasks.key, "ein"));
    expect(row.destinationUrl).toBe("https://www.irs.gov/ein");
  });

  it("applies a re-check that only rewords steps without asking", async () => {
    await saveResearchForOwner(db, "owner-a", research(firstPlan, FIRST), "key-1");
    const reworded = firstPlan.map((requirement) => ({ ...requirement, title: `${requirement.title}, reworded` }));
    await saveResearchForOwner(db, "owner-a", research(reworded, SECOND), "key-2");

    const plan = await getPlanForOwner(db, "owner-a");
    expect(plan?.steps[0].title).toBe("Choose a structure, reworded");
  });

  it("applies a re-check's changes straight away, keeping started steps as a record", async () => {
    await saveResearchForOwner(db, "owner-a", research(firstPlan, FIRST), "key-1");
    const done = new Date("2026-10-26T18:00:00Z");
    await setStepStatusForOwner(db, "owner-a", { stepId: await stepId("owner-a", "ein"), status: "done", note: "Got it" }, done);
    await setStepStatusForOwner(db, "owner-a", { stepId: await stepId("owner-a", "vendor"), status: "done", note: null }, done);
    await saveResearchForOwner(db, "owner-a", research(secondPlan, SECOND), "key-2");

    const plan = await getPlanForOwner(db, "owner-a");
    expect(plan?.steps.map((step) => ({ key: step.key, title: step.title, status: step.status, feeCents: step.feeCents }))).toEqual([
      { key: "structure", title: "Pick a business structure", status: "todo", feeCents: null },
      { key: "ein", title: "Get an EIN", status: "done", feeCents: 1000 },
      { key: "sales-tax", title: "Sales tax permit", status: "todo", feeCents: null },
    ]);
    expect(plan?.steps[1]).toMatchObject({ evidenceNote: "Got it", completedAt: done });
    // A removed step that was done is kept as a record; the todo one is gone
    expect(plan?.retired.map((step) => [step.key, step.status])).toEqual([["vendor", "done"]]);
    expect(await db.select().from(checklistTasks).where(eq(checklistTasks.key, "license"))).toEqual([]);
  });

  it("lets owners change only their own steps", async () => {
    await saveResearchForOwner(db, "owner-a", research(firstPlan, FIRST), "key-1");
    await saveResearchForOwner(db, "owner-b", research(firstPlan, FIRST), "key-1");
    const id = await stepId("owner-a", "ein");
    const now = new Date("2026-10-27T10:00:00Z");

    expect(await setStepStatusForOwner(db, "owner-b", { stepId: id, status: "done", note: "Not mine" }, now)).toBe(false);
    expect((await getStepForOwner(db, "owner-a", id))?.step.status).toBe("todo");
    expect(await getStepForOwner(db, "owner-b", id)).toBeNull();

    expect(await setStepStatusForOwner(db, "owner-a", { stepId: id, status: "done", note: "EIN letter saved" }, now)).toBe(true);
    expect((await getStepForOwner(db, "owner-a", id))?.step).toMatchObject({ status: "done", evidenceNote: "EIN letter saved", completedAt: now });
    expect((await getPlanForOwner(db, "owner-b"))?.steps.every((step) => step.status === "todo")).toBe(true);

    // Back to todo keeps the owner's note
    await setStepStatusForOwner(db, "owner-a", { stepId: id, status: "todo", note: "ignored" }, now);
    expect((await getStepForOwner(db, "owner-a", id))?.step).toMatchObject({ status: "todo", evidenceNote: "EIN letter saved", completedAt: null });
  });

  it("has no plan for an owner without a business", async () => {
    await db.insert(users).values({ id: "owner-c", name: "C", email: "c@example.test" });
    expect(await getPlanForOwner(db, "owner-c")).toBeNull();
    expect(await setStepStatusForOwner(db, "owner-c", { stepId: "x", status: "done", note: null })).toBe(false);
  });
});

describe("orderSteps", () => {
  const step = (key: string, position: number, prerequisites: string[] = []) => ({ key, position, prerequisites }) as PlanStep;

  it("puts prerequisites first, then plan order", () => {
    const ordered = orderSteps([step("payroll", 0, ["ein"]), step("license", 1), step("ein", 2, ["structure"]), step("structure", 3)]);
    expect(ordered.map((s) => s.key)).toEqual(["license", "structure", "ein", "payroll"]);
  });

  it("sorts by position before ordering", () => {
    expect(orderSteps([step("b", 1), step("a", 0)]).map((s) => s.key)).toEqual(["a", "b"]);
  });

  it("ignores prerequisites that no longer exist", () => {
    expect(orderSteps([step("ein", 0, ["gone"]), step("b", 1)]).map((s) => s.key)).toEqual(["ein", "b"]);
  });

  it("falls back to plan order on a loop instead of throwing", () => {
    expect(orderSteps([step("b", 1, ["a"]), step("a", 0, ["b"])]).map((s) => s.key)).toEqual(["a", "b"]);
  });
});

describe("filing status", () => {
  it("records submitting and approval separately, and undoing clears both", async () => {
    await saveResearchForOwner(db, "owner-a", research(firstPlan, FIRST), "key-1");
    const id = await stepId("owner-a", "ein");
    const at = new Date("2026-10-28T10:00:00Z");
    await setStepStatusForOwner(db, "owner-a", { stepId: id, status: "submitted", note: "Faxed" }, at);
    let step = (await getStepForOwner(db, "owner-a", id))!.step;
    expect(step).toMatchObject({ status: "submitted", submissionNote: "Faxed", submittedAt: at, completedAt: null });

    const later = new Date("2026-11-02T10:00:00Z");
    await setStepStatusForOwner(db, "owner-a", { stepId: id, status: "done", note: "EIN letter came" }, later);
    step = (await getStepForOwner(db, "owner-a", id))!.step;
    expect(step).toMatchObject({ status: "done", submittedAt: at, completedAt: later, evidenceNote: "EIN letter came" });

    await setStepStatusForOwner(db, "owner-a", { stepId: id, status: "todo", note: null }, later);
    step = (await getStepForOwner(db, "owner-a", id))!.step;
    expect(step).toMatchObject({ status: "todo", submittedAt: null, completedAt: null, submissionNote: "Faxed" });
  });
});

describe("replanForOwner", () => {
  const llc = researchedRequirement({ key: "llc-articles", title: "File articles of organization", topic: "structure", level: "state", forStructures: ["llc"], conditions: ["Only if you set up as an LLC. Decide your business structure first."], status: "conditional" });
  const owner = testProfile();

  it("rebuilds the plan when the structure decision changes, straight away, without searching again", async () => {
    const result = research(firstPlan, FIRST);
    const withLlc = { ...result, requirements: [...result.requirements, llc], plan: buildPlan([...result.requirements, llc], result.pages, true) };
    await saveResearchForOwner(db, "owner-a", withLlc, "key-1");
    expect((await getPlanForOwner(db, "owner-a"))!.steps.find((step) => step.key === "llc-articles")).toMatchObject({ requirementStatus: "conditional" });

    // A sole proprietor doesn't form an LLC, so its step goes
    expect(await replanForOwner(db, "owner-a", owner, [{ key: "structure_choice", value: "sole_proprietorship" }], SECOND)).toBe("applied");
    expect((await getPlanForOwner(db, "owner-a"))!.steps.some((step) => step.key === "llc-articles")).toBe(false);
    const [snapshot] = await db.select().from(researchSnapshots);
    expect(snapshot).toMatchObject({ structure: "sole_proprietorship", checkedAt: FIRST });
  });

  it("settles the condition once the owner picks the structure the step is for", async () => {
    const result = research(firstPlan, FIRST);
    await saveResearchForOwner(db, "owner-a", { ...result, requirements: [...result.requirements, llc], plan: buildPlan([...result.requirements, llc], result.pages, true) }, "key-1");
    expect(await replanForOwner(db, "owner-a", owner, [{ key: "structure_choice", value: "llc" }], SECOND)).toBe("applied");
    const step = (await getPlanForOwner(db, "owner-a"))!.steps.find((each) => each.key === "llc-articles");
    expect(step?.requirementStatus).not.toBe("conditional");
  });

  it("says when there's nothing to plan from", async () => {
    expect(await replanForOwner(db, "owner-a", owner, [], SECOND)).toBe("no_research");
    expect(await replanForOwner(db, "nobody", owner, [], SECOND)).toBe("no_business");
  });
});

describe("replanForOwner keeps the confirming page", () => {
  it("credits the page the quote was found on, not just the first one cited", async () => {
    const pages = [
      retrievedPage({ id: "sba", url: "https://www.sba.gov/name", title: "SBA", level: "federal", text: "Register your name." }),
      retrievedPage({ id: "travis", url: "https://countyclerk.traviscountytx.gov/departments/recording/dbas/", title: "Travis County Clerk", level: "county", text: "Filing fee is $23.00 for business name and one owner." }),
    ];
    const name = researchedRequirement({
      key: "assumed-name-county",
      title: "File an assumed name certificate",
      topic: "name_registration",
      level: "county",
      sourceIds: ["sba", "travis"],
      verification: "sourced",
      confirmedBy: ["travis"],
      status: "verified",
    });
    await saveResearchForOwner(
      db,
      "owner-a",
      { ...research([], FIRST), pages, requirements: [name], plan: buildPlan([name], pages, true) },
      "key-1",
    );
    const linksBefore = (await getPlanForOwner(db, "owner-a"))!.steps[0].links;
    expect(linksBefore.map((link) => [link.title, link.confirms])).toEqual([["Travis County Clerk", true], ["SBA", false]]);

    await replanForOwner(db, "owner-a", testProfile(), [{ key: "structure_choice", value: "llc" }], SECOND);
    const [snapshot] = await db.select().from(researchSnapshots);
    expect(snapshot.planProposal?.[0].links.map((link) => [link.title, link.confirms])).toEqual([["Travis County Clerk", true], ["SBA", false]]);
  });
});
