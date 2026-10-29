import { describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import { dbSearchCache, SEARCH_CACHE_DAYS } from "./search-cache";

const request = { question: "Find the Ohio trade name page", location: { region: "Ohio", city: "Columbus" } };
const hits = [{ title: "Trade names", url: "https://www.ohiosos.gov/trade-names", snippet: "", cited: true }];
const DAY = 24 * 60 * 60 * 1000;

describe("dbSearchCache", () => {
  it("returns saved results for the same question and place, and nothing for another place", async () => {
    const db = await createTestDb();
    const cache = dbSearchCache(db, () => new Date("2026-10-28T12:00:00Z"));
    await cache.put(request, hits);
    expect(await cache.get(request)).toEqual(hits);
    expect(await cache.get({ ...request, location: { region: "Ohio", city: "Dayton" } })).toBeNull();
  });

  it("forgets results after a week", async () => {
    const db = await createTestDb();
    let now = new Date("2026-10-01T12:00:00Z");
    const cache = dbSearchCache(db, () => now);
    await cache.put(request, hits);
    now = new Date(now.getTime() + SEARCH_CACHE_DAYS * DAY + 1);
    expect(await cache.get(request)).toBeNull();
  });
});
