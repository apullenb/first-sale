import { beforeEach, describe, expect, it } from "vitest";
import { placeOf } from "@/lib/research/applicability";
import type { ResearchedRequirement, ResearchResult } from "@/lib/research/requirements";
import type { VerifiedRequirement } from "@/lib/research/verify";
import { paperwork } from "@/lib/rules/paperwork";
import { buildPlan } from "@/lib/rules/plan";
import { createTestDb } from "@/test/db";
import { researchedRequirement, retrievedPage, seedOwners, testProfile, verifiedRequirement } from "@/test/fixtures";
import { listConditionAnswersForOwner, setConditionAnswerForOwner } from "./condition-answers";
import { getPlanForOwner } from "./plan";
import { saveResearchForOwner } from "./research";

const TAXED = "Only if you sell anything your state taxes.";

function research(verified: VerifiedRequirement[], checkedAt: Date): ResearchResult {
  const requirements: ResearchedRequirement[] = verified.map((requirement) =>
    researchedRequirement({ ...requirement, status: requirement.applicability === "conditional" ? "conditional" : "verified", conditions: requirement.condition ? [requirement.condition] : [] }),
  );
  const pages = [retrievedPage({ retrievedAt: checkedAt.toISOString() })];
  return {
    checkedAt,
    model: "Mock",
    simulated: true,
    searched: false,
    claimsChecked: true,
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

const permit = (condition: string) =>
  verifiedRequirement({ key: "sales-tax", title: "Sales tax permit", applicability: "conditional", condition, sourceIds: ["irs-ein"], verification: "sourced" });
const license = verifiedRequirement({ key: "license", title: "Business license", sourceIds: ["irs-ein"], verification: "sourced" });

let db: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  db = await createTestDb();
  await seedOwners(db);
});

async function inclusionOf(ownerId: string, key: string) {
  const [plan, answers] = await Promise.all([getPlanForOwner(db, ownerId), listConditionAnswersForOwner(db, ownerId)]);
  const profile = testProfile();
  const view = paperwork(plan!.steps, { profile, place: placeOf(profile), decision: { structure: null, from: null }, answers });
  return view.standings.find((standing) => standing.step.key === key)?.inclusion;
}

describe("condition answers", () => {
  it("keeps the owner's answer through a re-check, and asks again when the condition is reworded", async () => {
    await saveResearchForOwner(db, "owner-a", research([permit(TAXED), license], new Date("2026-10-26T15:00:00Z")), "key-1");
    expect(await inclusionOf("owner-a", "sales-tax")).toBe("question");

    expect(await setConditionAnswerForOwner(db, "owner-a", { stepKey: "sales-tax", condition: TAXED, answer: "yes" })).toBe("saved");
    expect(await inclusionOf("owner-a", "sales-tax")).toBe("task");

    await saveResearchForOwner(db, "owner-a", research([permit(TAXED), license], new Date("2026-10-27T15:00:00Z")), "key-1");
    expect(await inclusionOf("owner-a", "sales-tax")).toBe("task");

    await saveResearchForOwner(db, "owner-a", research([permit("Only if you sell taxable food."), license], new Date("2026-10-28T15:00:00Z")), "key-1");
    expect(await inclusionOf("owner-a", "sales-tax")).toBe("question");
  });

  it("saves only questions the plan asks, and an answer can be taken back", async () => {
    await saveResearchForOwner(db, "owner-a", research([permit(TAXED), license], new Date("2026-10-26T15:00:00Z")), "key-1");
    expect(await setConditionAnswerForOwner(db, "owner-a", { stepKey: "sales-tax", condition: "Something else", answer: "no" })).toBe("not_asked");
    expect(await setConditionAnswerForOwner(db, "owner-a", { stepKey: "license", condition: TAXED, answer: "no" })).toBe("not_asked");

    await setConditionAnswerForOwner(db, "owner-a", { stepKey: "sales-tax", condition: TAXED, answer: "no" });
    expect(await inclusionOf("owner-a", "sales-tax")).toBe("no");
    await setConditionAnswerForOwner(db, "owner-a", { stepKey: "sales-tax", condition: TAXED, answer: "unsure" });
    expect(await inclusionOf("owner-a", "sales-tax")).toBe("task");
    await setConditionAnswerForOwner(db, "owner-a", { stepKey: "sales-tax", condition: TAXED, answer: null });
    expect(await listConditionAnswersForOwner(db, "owner-a")).toEqual([]);
  });

  it("keeps each owner's answers to themselves", async () => {
    await saveResearchForOwner(db, "owner-a", research([permit(TAXED)], new Date("2026-10-26T15:00:00Z")), "key-1");
    await setConditionAnswerForOwner(db, "owner-a", { stepKey: "sales-tax", condition: TAXED, answer: "yes" });
    expect(await listConditionAnswersForOwner(db, "owner-b")).toEqual([]);
    // Owner B's plan doesn't ask it
    expect(await setConditionAnswerForOwner(db, "owner-b", { stepKey: "sales-tax", condition: TAXED, answer: "yes" })).toBe("not_asked");
    expect(await setConditionAnswerForOwner(db, "nobody", { stepKey: "sales-tax", condition: TAXED, answer: "yes" })).toBe("no_business");
  });
});
