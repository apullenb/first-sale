import "server-only";
import { createHash } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { searchCache } from "@/db/schema";
import type { SearchCache } from "@/lib/research/discover";

// Official pages rarely move within a week; the pages themselves are still read fresh on every check
export const SEARCH_CACHE_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

type Request = Parameters<SearchCache["get"]>[0];

export function searchKey(request: Request): string {
  return createHash("sha256")
    .update(JSON.stringify([request.question, request.location?.region ?? "", request.location?.city ?? ""]))
    .digest("hex");
}

export function dbSearchCache(db: Db, now: () => Date = () => new Date()): SearchCache {
  return {
    async get(request) {
      const [row] = await db.select().from(searchCache).where(eq(searchCache.key, searchKey(request)));
      return row && now().getTime() - row.createdAt.getTime() < SEARCH_CACHE_DAYS * DAY ? row.hits : null;
    },
    async put(request, hits) {
      const at = now();
      await db
        .insert(searchCache)
        .values({ key: searchKey(request), hits, createdAt: at })
        .onConflictDoUpdate({ target: searchCache.key, set: { hits, createdAt: at } });
      await db.delete(searchCache).where(lt(searchCache.createdAt, new Date(at.getTime() - SEARCH_CACHE_DAYS * DAY)));
    },
  };
}
