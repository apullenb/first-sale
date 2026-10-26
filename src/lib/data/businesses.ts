import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses } from "@/db/schema";
import type { BusinessProfile } from "@/lib/domain";

// Owner-scoped queries. Pages call my-businesses.ts instead, which takes the owner from the session.

export function listBusinessesForOwner(db: Db, ownerId: string) {
  return db.select().from(businesses).where(eq(businesses.ownerId, ownerId)).orderBy(asc(businesses.createdAt));
}

export async function getBusinessForOwner(db: Db, ownerId: string, businessId: string) {
  const [row] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

export async function updateBusinessProfileForOwner(
  db: Db,
  ownerId: string,
  businessId: string,
  profile: BusinessProfile,
) {
  const [row] = await db
    .update(businesses)
    .set({ profile })
    .where(and(eq(businesses.id, businessId), eq(businesses.ownerId, ownerId)))
    .returning();
  return row ?? null;
}

// Null when the owner already has `limit` businesses. Locked per owner, so parallel creates can't pass it.
export async function createBusinessForOwner(
  db: Db,
  ownerId: string,
  input: { profile: BusinessProfile; isDemo?: boolean },
  limit = Number.POSITIVE_INFINITY,
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(1, hashtext(${ownerId}))`);
    const [existing] = await tx.select({ n: count() }).from(businesses).where(eq(businesses.ownerId, ownerId));
    if (existing.n >= limit) return null;
    const [row] = await tx
      .insert(businesses)
      .values({ ownerId, profile: input.profile, isDemo: input.isDemo ?? false })
      .returning();
    return row;
  });
}
