import { beforeEach, describe, expect, it } from "vitest";
import type { SavedInsights } from "@/lib/insights/types";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { getInsightsForOwner, markInsightForOwner, saveInsightsForOwner } from "./insights";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

const insights = (titles: string[], generatedAt = "2026-10-28T15:00:00.000Z"): SavedInsights => ({
  opening: "Rise Bakery is off to a lovely start.",
  items: titles.map((title) => ({ key: `tips:${title.toLowerCase()}`, section: "tips", title, detail: "Detail.", action: null, link: null })),
  generatedAt,
  simulated: false,
  basis: { answers: "abc" },
  removed: 0,
});

describe("business insights data access", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await createTestDb();
    await seedOwners(db);
  });

  it("saves the latest set and reads it back", async () => {
    expect(await getInsightsForOwner(db, "owner-a")).toBeNull();
    expect(await saveInsightsForOwner(db, "owner-a", insights(["Tell neighbors"]))).toBe(true);
    expect(await getInsightsForOwner(db, "owner-a")).toEqual({ insights: insights(["Tell neighbors"]), feedback: {} });
    await saveInsightsForOwner(db, "owner-a", insights(["Bake samples"], "2026-10-29T15:00:00.000Z"));
    expect((await getInsightsForOwner(db, "owner-a"))?.insights?.items.map((item) => item.title)).toEqual(["Bake samples"]);
  });

  it("keeps the owner's marks, with titles, across a refresh", async () => {
    await saveInsightsForOwner(db, "owner-a", insights(["Tell neighbors", "Bake samples"]));
    const now = new Date("2026-10-28T16:00:00Z");
    expect(await markInsightForOwner(db, "owner-a", "tips:tell neighbors", "useful", now)).toBe("saved");
    expect(await markInsightForOwner(db, "owner-a", "tips:bake samples", "dismissed", now)).toBe("saved");
    await saveInsightsForOwner(db, "owner-a", insights(["Tell neighbors"]));
    expect((await getInsightsForOwner(db, "owner-a"))?.feedback).toEqual({
      "tips:tell neighbors": { mark: "useful", title: "Tell neighbors", at: now.toISOString() },
      "tips:bake samples": { mark: "dismissed", title: "Bake samples", at: now.toISOString() },
    });
  });

  it("clears a mark, and refuses keys that aren't in the current set", async () => {
    await saveInsightsForOwner(db, "owner-a", insights(["Tell neighbors"]));
    await markInsightForOwner(db, "owner-a", "tips:tell neighbors", "useful");
    expect(await markInsightForOwner(db, "owner-a", "tips:tell neighbors", null)).toBe("saved");
    expect((await getInsightsForOwner(db, "owner-a"))?.feedback).toEqual({});
    expect(await markInsightForOwner(db, "owner-a", "tips:made up", "useful")).toBe("not_found");
  });

  it("keeps the newest 100 marks", async () => {
    const titles = Array.from({ length: 101 }, (_, index) => `Tip ${index}`);
    await saveInsightsForOwner(db, "owner-a", insights(titles));
    for (const [index, title] of titles.entries()) {
      await markInsightForOwner(db, "owner-a", `tips:${title.toLowerCase()}`, "useful", new Date(Date.UTC(2026, 9, 28, 0, index)));
    }
    const feedback = (await getInsightsForOwner(db, "owner-a"))!.feedback;
    expect(Object.keys(feedback)).toHaveLength(100);
    expect(feedback["tips:tip 0"]).toBeUndefined();
    expect(feedback["tips:tip 100"]).toMatchObject({ mark: "useful", title: "Tip 100" });
  });

  it("keeps each owner's insights to themselves", async () => {
    await saveInsightsForOwner(db, "owner-a", insights(["Tell neighbors"]));
    expect(await getInsightsForOwner(db, "owner-b")).toBeNull();
    expect(await markInsightForOwner(db, "owner-b", "tips:tell neighbors", "useful")).toBe("not_found");
    expect(await markInsightForOwner(db, "nobody", "tips:tell neighbors", "useful")).toBe("no_business");
    expect(await saveInsightsForOwner(db, "nobody", insights(["Tell neighbors"]))).toBe(false);
  });

  it("reads stored insights from an older shape as none, rather than failing", async () => {
    await saveInsightsForOwner(db, "owner-a", { opening: "Old" } as unknown as SavedInsights);
    expect((await getInsightsForOwner(db, "owner-a"))?.insights).toBeNull();
  });
});
