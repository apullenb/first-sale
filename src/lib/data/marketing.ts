import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, marketingPlans } from "@/db/schema";
import { readIntake, type StoredIntake } from "@/lib/marketing/intake";
import { type MarketingPlan, readPlan } from "@/lib/marketing/types";

// Owner-scoped like website.ts: the business is always looked up by its owner.

type Row = typeof marketingPlans.$inferSelect;
export type MarketingRecord = Omit<Row, "intake" | "plan"> & { intake: StoredIntake | null; plan: MarketingPlan | null };
export type MarketingPatch = Partial<Omit<Row, "businessId" | "updatedAt">>;

function read(row: Row): MarketingRecord {
  return { ...row, intake: readIntake(row.intake), plan: readPlan(row.plan) };
}

export async function getMarketingForOwner(db: Db, ownerId: string): Promise<MarketingRecord | null> {
  const [row] = await db
    .select({ marketing: marketingPlans })
    .from(marketingPlans)
    .innerJoin(businesses, eq(businesses.id, marketingPlans.businessId))
    .where(eq(businesses.ownerId, ownerId));
  return row ? read(row.marketing) : null;
}

// Reads and writes under the business lock, so two saves at once can't drop each other's changes.
// The update returns null to leave the record as it is.
export async function updateMarketingForOwner(
  db: Db,
  ownerId: string,
  update: (current: MarketingRecord | null) => MarketingPatch | null,
  now = new Date(),
): Promise<"saved" | "unchanged" | "no_business"> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!business) return "no_business";
    const [current] = await tx.select().from(marketingPlans).where(eq(marketingPlans.businessId, business.id));
    const patch = update(current ? read(current) : null);
    if (!patch) return "unchanged";
    const set = { ...patch, updatedAt: now };
    await tx
      .insert(marketingPlans)
      .values({ businessId: business.id, ...set })
      .onConflictDoUpdate({ target: marketingPlans.businessId, set });
    return "saved";
  });
}
