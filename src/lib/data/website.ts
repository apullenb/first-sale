import "server-only";
import { eq, getTableColumns } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, websitePlans } from "@/db/schema";

// Owner-scoped like businesses.ts: the business is always looked up by its owner.

export type WebsitePlan = typeof websitePlans.$inferSelect;
export type WebsitePatch = Partial<Omit<WebsitePlan, "businessId" | "updatedAt">>;

const planColumns = getTableColumns(websitePlans);

export async function getWebsitePlanForOwner(db: Db, ownerId: string): Promise<WebsitePlan | null> {
  const [row] = await db
    .select(planColumns)
    .from(websitePlans)
    .innerJoin(businesses, eq(businesses.id, websitePlans.businessId))
    .where(eq(businesses.ownerId, ownerId));
  return row ?? null;
}

// Creates the plan on first save. False when the owner has no business.
export async function saveWebsitePlanForOwner(db: Db, ownerId: string, patch: WebsitePatch, now = new Date()): Promise<boolean> {
  return (await updateWebsitePlanForOwner(db, ownerId, () => patch, now)) === "saved";
}

// Reads and writes under the business lock, so two saves at once can't drop each other's changes.
// The update returns null to leave the plan as it is.
export async function updateWebsitePlanForOwner(
  db: Db,
  ownerId: string,
  update: (plan: WebsitePlan | null) => WebsitePatch | null,
  now = new Date(),
): Promise<"saved" | "unchanged" | "no_business"> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!business) return "no_business";
    const [current] = await tx.select().from(websitePlans).where(eq(websitePlans.businessId, business.id));
    const patch = update(current ?? null);
    if (!patch) return "unchanged";
    const set = { ...patch, updatedAt: now };
    await tx
      .insert(websitePlans)
      .values({ businessId: business.id, ...set })
      .onConflictDoUpdate({ target: websitePlans.businessId, set });
    return "saved";
  });
}
