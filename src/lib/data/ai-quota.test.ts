import { beforeEach, describe, expect, it } from "vitest";
import { aiRequests, users } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { AI_LIMITS, globalDailyLimit, takeAiRequest } from "./ai-quota";

let db: Awaited<ReturnType<typeof createTestDb>>;
const NOW = new Date("2026-10-26T12:00:00Z");

beforeEach(async () => {
  db = await createTestDb();
  await db.insert(users).values([
    { id: "owner-a", name: "Owner A", email: "a@example.test" },
    { id: "owner-b", name: "Owner B", email: "b@example.test" },
  ]);
});

describe("takeAiRequest", () => {
  it("allows up to the hourly limit, then refuses", async () => {
    for (let i = 0; i < AI_LIMITS.perHour; i++) expect(await takeAiRequest(db, "owner-a", NOW)).toBe("ok");
    expect(await takeAiRequest(db, "owner-a", NOW)).toBe("owner_limit");
  });

  it("holds the limit when requests arrive at the same time", async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () => takeAiRequest(db, "owner-a", NOW)));
    expect(results.filter((r) => r === "ok")).toHaveLength(AI_LIMITS.perHour);
    expect(await db.select().from(aiRequests)).toHaveLength(AI_LIMITS.perHour);
  });

  it("counts each owner separately", async () => {
    for (let i = 0; i < AI_LIMITS.perHour; i++) await takeAiRequest(db, "owner-a", NOW);
    expect(await takeAiRequest(db, "owner-b", NOW)).toBe("ok");
  });

  it("frees up after an hour, until the daily limit", async () => {
    const start = new Date("2026-10-26T00:00:00Z").getTime();
    let allowed = 0;
    // One every 7 minutes stays under the hourly limit, so only the daily limit can stop it
    for (let i = 0; i < AI_LIMITS.perDay + 5; i++) {
      if ((await takeAiRequest(db, "owner-a", new Date(start + i * 7 * 60 * 1000))) === "ok") allowed++;
    }
    expect(allowed).toBe(AI_LIMITS.perDay);
  });

  it("stops everyone at the overall daily limit", async () => {
    expect(await takeAiRequest(db, "owner-a", NOW, 2)).toBe("ok");
    expect(await takeAiRequest(db, "owner-b", NOW, 2)).toBe("ok");
    expect(await takeAiRequest(db, "owner-b", NOW, 2)).toBe("global_limit");
  });

  it("prunes rows older than two days", async () => {
    await takeAiRequest(db, "owner-a", new Date("2026-10-20T12:00:00Z"));
    await takeAiRequest(db, "owner-a", NOW);
    expect(await db.select().from(aiRequests)).toHaveLength(1);
  });
});

describe("globalDailyLimit", () => {
  it("reads AI_DAILY_LIMIT, defaulting to 500", () => {
    expect(globalDailyLimit({})).toBe(500);
    expect(globalDailyLimit({ AI_DAILY_LIMIT: "40" })).toBe(40);
    expect(globalDailyLimit({ AI_DAILY_LIMIT: "lots" })).toBe(500);
  });
});
