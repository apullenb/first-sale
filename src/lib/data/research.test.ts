import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { requirements, sources, users } from "@/db/schema";
import type { BusinessProfile } from "@/lib/domain";
import type { ResearchResult } from "@/lib/research/requirements";
import { createTestDb } from "@/test/db";
import { createBusinessForOwner } from "./businesses";
import { getResearchForOwner, saveResearchForOwner } from "./research";

const profile: BusinessProfile = {
  name: null,
  description: "",
  location: { state: "OH", county: "", city: "" },
  owners: { count: 1 },
  offeringKinds: ["food"],
  firstItems: "",
  channels: ["markets"],
  premises: null,
  startupBudget: null,
  hiringPlans: null,
};

function research(title: string, checkedAt = new Date("2026-10-26T15:00:00Z")): ResearchResult {
  return {
    checkedAt,
    model: "Mock",
    pages: [
      { id: "irs-ein", title: "IRS: EIN", url: "https://www.irs.gov/ein", level: "federal", text: "…", retrievedAt: checkedAt.toISOString() },
    ],
    unread: [{ id: "sba-x", title: "SBA: X", url: "https://www.sba.gov/x", reason: "The site answered with error 503" }],
    requirements: [
      {
        title,
        whyItApplies: "Why",
        level: "federal",
        sourceIds: ["irs-ein"],
        evidence: "Quote",
        feeUsd: 12.5,
        deadline: null,
        needsProfessional: false,
        whoToCall: "the IRS",
        whatToAsk: ["Q?"],
        verification: "sourced",
        problems: [],
      },
    ],
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
      unreadSources: [{ key: "sba-x", reason: "The site answered with error 503" }],
      sources: [{ key: "irs-ein", url: "https://www.irs.gov/ein", level: "federal" }],
      requirements: [{ title: "Get an EIN", feeCents: 1250, sourceIds: ["irs-ein"], whatToAsk: ["Q?"], position: 0 }],
    });
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
  });
});
