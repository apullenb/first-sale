import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses } from "@/db/schema";
import type { StructureAdvice } from "@/lib/structure/advise";

// Owner-scoped like businesses.ts: the business is always looked up by its owner.

export async function getStructureAdviceForOwner(db: Db, ownerId: string): Promise<StructureAdvice | null> {
  const [row] = await db.select({ advice: businesses.structureAdvice }).from(businesses).where(eq(businesses.ownerId, ownerId));
  return row?.advice ?? null;
}

// False when the owner has no business
export async function saveStructureAdviceForOwner(db: Db, ownerId: string, advice: StructureAdvice): Promise<boolean> {
  const updated = await db.update(businesses).set({ structureAdvice: advice }).where(eq(businesses.ownerId, ownerId)).returning();
  return updated.length > 0;
}
