import "server-only";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, journeyMarks } from "@/db/schema";

// Owner-scoped like businesses.ts: the business is always looked up by its owner.

export interface JourneyMark {
  key: string;
  url: string | null;
  note: string | null;
  createdAt: Date;
}

export async function listJourneyMarksForOwner(db: Db, ownerId: string): Promise<JourneyMark[]> {
  return db
    .select({ key: journeyMarks.key, url: journeyMarks.url, note: journeyMarks.note, createdAt: journeyMarks.createdAt })
    .from(journeyMarks)
    .innerJoin(businesses, eq(businesses.id, journeyMarks.businessId))
    .where(eq(businesses.ownerId, ownerId));
}

// Saves or replaces the mark. False when the owner has no business.
export async function setJourneyMarkForOwner(db: Db, ownerId: string, mark: { key: string; url: string | null; note: string | null }, now = new Date()): Promise<boolean> {
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  if (!business) return false;
  await db
    .insert(journeyMarks)
    .values({ businessId: business.id, ...mark, createdAt: now })
    .onConflictDoUpdate({ target: [journeyMarks.businessId, journeyMarks.key], set: { url: mark.url, note: mark.note, createdAt: now } });
  return true;
}

export async function clearJourneyMarkForOwner(db: Db, ownerId: string, key: string): Promise<void> {
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  if (!business) return;
  await db.delete(journeyMarks).where(and(eq(journeyMarks.businessId, business.id), eq(journeyMarks.key, key)));
}
