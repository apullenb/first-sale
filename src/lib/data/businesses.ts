import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses } from "@/db/schema";
import type { BusinessProfile } from "@/lib/domain";

// Owner-scoped queries; each owner has at most one business. Pages call my-business.ts instead.

export async function getBusinessForOwner(db: Db, ownerId: string) {
  const [row] = await db.select().from(businesses).where(eq(businesses.ownerId, ownerId)).limit(1);
  return row ?? null;
}

export async function updateBusinessProfileForOwner(db: Db, ownerId: string, profile: BusinessProfile) {
  const [row] = await db.update(businesses).set({ profile }).where(eq(businesses.ownerId, ownerId)).returning();
  return row ?? null;
}

// Null when the owner already has one
export async function createBusinessForOwner(
  db: Db,
  ownerId: string,
  input: { profile: BusinessProfile; isDemo?: boolean },
) {
  const [row] = await db
    .insert(businesses)
    .values({ ownerId, profile: input.profile, isDemo: input.isDemo ?? false })
    .onConflictDoNothing({ target: businesses.ownerId })
    .returning();
  return row ?? null;
}
