import "server-only";
import { and, count, eq, gt, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { aiRequests } from "@/db/schema";

// Caps what one owner's AI requests can cost
export const AI_LIMITS = { perHour: 10, perDay: 50 } as const;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Advisory lock namespace (first key) for AI usage, shared by every request
const AI_LOCK = sql`pg_advisory_xact_lock(2, 0)`;

// Across all owners, since anyone can sign up. Set AI_DAILY_LIMIT to change it.
export function globalDailyLimit(env: Record<string, string | undefined> = process.env): number {
  const value = Number(env.AI_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : 500;
}

export type AiQuotaResult = "ok" | "owner_limit" | "global_limit";

// Records the request if it's within every limit. Locked, so parallel requests can't slip past.
export async function takeAiRequest(
  db: Db,
  userId: string,
  now = new Date(),
  globalLimit = globalDailyLimit(),
): Promise<AiQuotaResult> {
  const hourAgo = new Date(now.getTime() - HOUR);
  const dayAgo = new Date(now.getTime() - DAY);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select ${AI_LOCK}`);
    await tx.delete(aiRequests).where(lt(aiRequests.createdAt, new Date(now.getTime() - 2 * DAY)));

    const [all] = await tx.select({ n: count() }).from(aiRequests).where(gt(aiRequests.createdAt, dayAgo));
    if (all.n >= globalLimit) return "global_limit";

    const [mine] = await tx
      .select({
        day: count(),
        // gt() maps the Date through the column; postgres-js rejects a bare Date param
        hour: sql<number>`count(*) filter (where ${gt(aiRequests.createdAt, hourAgo)})`.mapWith(Number),
      })
      .from(aiRequests)
      .where(and(eq(aiRequests.userId, userId), gt(aiRequests.createdAt, dayAgo)));
    if (mine.hour >= AI_LIMITS.perHour || mine.day >= AI_LIMITS.perDay) return "owner_limit";

    await tx.insert(aiRequests).values({ userId, createdAt: now });
    return "ok";
  });
}
