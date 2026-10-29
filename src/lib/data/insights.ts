import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, businessInsights } from "@/db/schema";
import { type InsightFeedback, type InsightMark, readFeedback, readSavedInsights, type SavedInsights } from "@/lib/insights/types";

// Owner-scoped like businesses.ts: the business is always looked up by its owner.

export interface InsightsRecord {
  insights: SavedInsights | null;
  feedback: InsightFeedback;
}

// Oldest marks go first past this
const MAX_FEEDBACK = 100;

export async function getInsightsForOwner(db: Db, ownerId: string): Promise<InsightsRecord | null> {
  const [row] = await db
    .select({ insights: businessInsights.insights, feedback: businessInsights.feedback })
    .from(businessInsights)
    .innerJoin(businesses, eq(businesses.id, businessInsights.businessId))
    .where(eq(businesses.ownerId, ownerId));
  return row ? { insights: readSavedInsights(row.insights), feedback: readFeedback(row.feedback) } : null;
}

// Replaces the last set; marks stay. False when the owner has no business.
export async function saveInsightsForOwner(db: Db, ownerId: string, insights: SavedInsights, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!business) return false;
    await tx
      .insert(businessInsights)
      .values({ businessId: business.id, insights, updatedAt: now })
      .onConflictDoUpdate({ target: businessInsights.businessId, set: { insights, updatedAt: now } });
    return true;
  });
}

export type MarkOutcome = "saved" | "not_found" | "no_business";

// Marks one insight in the current set useful or dismissed; null clears the mark
export async function markInsightForOwner(db: Db, ownerId: string, key: string, mark: InsightMark | null, now = new Date()): Promise<MarkOutcome> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!business) return "no_business";
    const [row] = await tx.select().from(businessInsights).where(eq(businessInsights.businessId, business.id));
    const item = readSavedInsights(row?.insights)?.items.find((each) => each.key === key);
    if (!row || !item) return "not_found";

    const rest = Object.entries(readFeedback(row.feedback)).filter(([each]) => each !== key);
    const kept = rest.toSorted(([, a], [, b]) => b.at.localeCompare(a.at)).slice(0, mark ? MAX_FEEDBACK - 1 : MAX_FEEDBACK);
    const feedback: InsightFeedback = Object.fromEntries(mark ? [[key, { mark, title: item.title, at: now.toISOString() }], ...kept] : kept);
    await tx.update(businessInsights).set({ feedback, updatedAt: now }).where(eq(businessInsights.businessId, business.id));
    return "saved";
  });
}
