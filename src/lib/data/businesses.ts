import "server-only";
import { and, asc, eq } from "drizzle-orm";
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

export async function createBusinessForOwner(
  db: Db,
  ownerId: string,
  input: { profile: BusinessProfile; isDemo?: boolean },
) {
  const [row] = await db
    .insert(businesses)
    .values({ ownerId, profile: input.profile, isDemo: input.isDemo ?? false })
    .returning();
  return row;
}
