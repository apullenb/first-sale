import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { checklistTasks, requirements, sources, users } from "@/db/schema";
import type { ResearchedRequirement, ResearchResult } from "@/lib/research/requirements";
import { buildPlan } from "@/lib/rules/plan";
import { createTestDb } from "@/test/db";
import { researchedRequirement, retrievedPage, testProfile } from "@/test/fixtures";
import { createBusinessForOwner } from "./businesses";
import { getResearchForOwner, saveResearchForOwner } from "./research";

const profile = testProfile({ name: null });

function research(title: string, checkedAt = new Date("2026-10-26T15:00:00Z")): ResearchResult {
  const pages = [retrievedPage({ text: "…", retrievedAt: checkedAt.toISOString() })];
  const reqs: ResearchedRequirement[] = [
    researchedRequirement({
      key: "ein",
      title,
      sourceIds: ["irs-ein"],
      evidence: "Quote",
      feeUsd: 12.5,
      whatToAsk: ["Q?"],
      gather: ["Your address"],
      doneWhen: "You have it",
      verification: "sourced",
    }),
  ];
  return {
    checkedAt,
    model: "Mock",
    simulated: true,
    searched: false,
    pages,
    unread: [{ id: "sba-x", title: "SBA: X", url: "https://www.sba.gov/x", reason: "The site answered with error 503" }],
    requirements: reqs,
    assumptions: ["You bake at home"],
    openQuestions: [{ question: "Which county?", whoToCall: "the county" }],
    plan: buildPlan(reqs, pages),
    coverage: [],
    conflicts: [],
    profile,
    structure: null,
  };
}

let db: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "owner-a", name: "Owner A", email: "a@example.test" },
    { id: "owner-b", name: "Owner B", email: "b@example.test" },
  ]);
  await createBusinessForOwner(db, "owner-a", { profile });
});

describe("research data access", () => {
  it("saves and reads back the owner's research", async () => {
    expect(await saveResearchForOwner(db, "owner-a", research("Get an EIN"), "key-1")).toBe(true);

    const saved = await getResearchForOwner(db, "owner-a");
    expect(saved).toMatchObject({
      profileKey: "key-1",
      model: "Mock",
      simulated: true,
      searched: false,
      assumptions: ["You bake at home"],
      openQuestions: [{ question: "Which county?", whoToCall: "the county" }],
      unreadSources: [{ key: "sba-x", reason: "The site answered with error 503" }],
      sources: [
        {
          key: "irs-ein",
          url: "https://www.irs.gov/ein",
          level: "federal",
          government: "Internal Revenue Service (Department of the Treasury)",
          discovered: false,
        },
      ],
      requirements: [
        {
          key: "ein",
          title: "Get an EIN",
          topic: "tax_registration",
          agency: "Internal Revenue Service",
          feeCents: 1250,
          sourceIds: ["irs-ein"],
          whatToAsk: ["Q?"],
          gather: ["Your address"],
          doneWhen: "You have it",
          position: 0,
        },
      ],
    });
  });

  it("stores the plan proposal and applies the first plan straight away", async () => {
    await saveResearchForOwner(db, "owner-a", research("Get an EIN"), "key-1");

    const saved = await getResearchForOwner(db, "owner-a");
    expect(saved?.planProposal?.map((step) => step.key)).toEqual(["ein"]);
    expect(saved?.planReviewedAt?.toISOString()).toBe("2026-10-26T15:00:00.000Z");
    const steps = await db.select().from(checklistTasks);
    expect(steps).toMatchObject([{ key: "ein", title: "Get an EIN", feeCents: 1250, status: "todo" }]);
  });

  it("replaces the last results instead of adding to them", async () => {
    await saveResearchForOwner(db, "owner-a", research("Old"), "key-1");
    await saveResearchForOwner(db, "owner-a", research("New", new Date("2026-10-27T15:00:00Z")), "key-2");

    const saved = await getResearchForOwner(db, "owner-a");
    expect(saved?.requirements.map((r) => r.title)).toEqual(["New"]);
    expect(saved?.sources).toHaveLength(1);
    expect(saved?.checkedAt.toISOString()).toBe("2026-10-27T15:00:00.000Z");
    expect(saved?.profileKey).toBe("key-2");
  });

  it("keeps newer results when an older run finishes last", async () => {
    await saveResearchForOwner(db, "owner-a", research("Newer", new Date("2026-10-27T15:00:00Z")), "key-2");
    await saveResearchForOwner(db, "owner-a", research("Older", new Date("2026-10-26T15:00:00Z")), "key-1");
    expect((await getResearchForOwner(db, "owner-a"))?.requirements.map((r) => r.title)).toEqual(["Newer"]);
  });

  it("keeps each owner's research to themselves", async () => {
    await saveResearchForOwner(db, "owner-a", research("Mine"), "key-1");
    expect(await getResearchForOwner(db, "owner-b")).toBeNull();
    expect(await saveResearchForOwner(db, "owner-b", research("Theirs"), "key-1")).toBe(false);
    expect((await getResearchForOwner(db, "owner-a"))?.requirements.map((r) => r.title)).toEqual(["Mine"]);
  });

  it("deletes research with the owner's account", async () => {
    await saveResearchForOwner(db, "owner-a", research("Mine"), "key-1");
    await db.delete(users).where(eq(users.id, "owner-a"));
    expect(await db.select().from(requirements)).toHaveLength(0);
    expect(await db.select().from(sources)).toHaveLength(0);
    expect(await db.select().from(checklistTasks)).toHaveLength(0);
  });
});

describe("research kept for returning owners", () => {
  it("keeps the answers, decision, coverage, conflicts and each requirement's status it ran on", async () => {
    const result = research("Get an EIN");
    await saveResearchForOwner(
      db,
      "owner-a",
      {
        ...result,
        structure: "partnership",
        coverage: [{ category: "tax", level: "federal", state: "confirmed", pagesRead: 1 }],
        conflicts: [{ about: "The fee", explanation: "Two pages differ.", sourceIds: ["irs-ein"] }],
        requirements: result.requirements.map((requirement) => ({ ...requirement, status: "optional" as const, conditions: ["Only if"], timing: "later" as const, renewal: "every year", renewalFeeUsd: 5 })),
      },
      "key-1",
    );
    const saved = await getResearchForOwner(db, "owner-a");
    expect(saved).toMatchObject({
      profile,
      structure: "partnership",
      proposedAt: new Date("2026-10-26T15:00:00Z"),
      coverage: [{ category: "tax", level: "federal", state: "confirmed", pagesRead: 1 }],
      conflicts: [{ about: "The fee", sourceIds: ["irs-ein"] }],
    });
    expect(saved?.requirements[0]).toMatchObject({ status: "optional", conditions: ["Only if"], timing: "later", renewal: "every year", renewalFeeCents: 500 });
    expect(await getResearchForOwner(db, "owner-b")).toBeNull();
  });
});
