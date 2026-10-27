import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businessEvents, businesses, intakeDrafts } from "@/db/schema";
import type { BusinessProfile } from "@/lib/domain";

// Saving confirmed answers, with a history entry and the intake draft cleared in the same transaction.
// Decision history is written by saveDetailsForOwner (details.ts).

export type BusinessEvent = typeof businessEvents.$inferSelect;

// Null when the owner already has a business
export async function createBusinessWithHistoryForOwner(db: Db, ownerId: string, profile: BusinessProfile, now = new Date()) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(businesses)
      .values({ ownerId, profile, isDemo: false })
      .onConflictDoNothing({ target: businesses.ownerId })
      .returning();
    if (!row) return null;
    await tx.insert(businessEvents).values({ businessId: row.id, kind: "profile", before: null, after: profile, summary: ["Answered the intake questions"], createdAt: now });
    await tx.delete(intakeDrafts).where(eq(intakeDrafts.userId, ownerId));
    return row;
  });
}

// `summary`: the changes the owner confirmed, in their words. Null with no business.
export async function updateProfileWithHistoryForOwner(db: Db, ownerId: string, profile: BusinessProfile, summary: string[], now = new Date()) {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!current) return null;
    const [row] = await tx.update(businesses).set({ profile }).where(eq(businesses.id, current.id)).returning();
    await tx.insert(businessEvents).values({ businessId: current.id, kind: "profile", before: current.profile, after: profile, summary, createdAt: now });
    await tx.delete(intakeDrafts).where(eq(intakeDrafts.userId, ownerId));
    return row;
  });
}

// Newest first
export async function listHistoryForOwner(db: Db, ownerId: string, filter: { kind?: BusinessEvent["kind"]; limit?: number } = {}): Promise<BusinessEvent[]> {
  const rows = await db
    .select({ event: businessEvents })
    .from(businessEvents)
    .innerJoin(businesses, eq(businesses.id, businessEvents.businessId))
    .where(and(eq(businesses.ownerId, ownerId), filter.kind ? eq(businessEvents.kind, filter.kind) : undefined))
    .orderBy(desc(businessEvents.createdAt), desc(businessEvents.id))
    .limit(filter.limit ?? 50);
  return rows.map(({ event }) => event);
}
