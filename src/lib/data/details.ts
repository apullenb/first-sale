import "server-only";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businessDetails, businessEvents, businesses } from "@/db/schema";
import { DETAILS, type DetailKey, displayDetail, isDetailKey } from "@/lib/details";
import type { DecisionBasis } from "@/lib/structure/types";

// Owner-scoped like businesses.ts. Values are checked with detailProblem before they get here.
// Changing a decision adds it to the business history, with what the owner saw when they made it.

export interface SavedDetail {
  key: DetailKey;
  value: string;
  source: "owner" | "document";
  documentId: string | null;
  updatedAt: Date;
}

export async function getDetailsForOwner(db: Db, ownerId: string): Promise<SavedDetail[]> {
  const rows = await db
    .select({ detail: businessDetails })
    .from(businessDetails)
    .innerJoin(businesses, eq(businesses.id, businessDetails.businessId))
    .where(eq(businesses.ownerId, ownerId));
  return rows.flatMap(({ detail }) =>
    isDetailKey(detail.key)
      ? [{ key: detail.key, value: detail.value, source: detail.source, documentId: detail.documentId, updatedAt: detail.updatedAt }]
      : [],
  );
}

export async function saveDetailsForOwner(
  db: Db,
  ownerId: string,
  values: { key: DetailKey; value: string }[],
  origin: { source: "owner" | "document"; documentId: string | null },
  now = new Date(),
  basis: DecisionBasis | null = null,
  // Also record decisions kept as they were, when the owner re-confirms them with changed answers
  reconfirm = false,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!business) return false;
    for (const { key, value } of values) {
      const row = { value: value.trim(), source: origin.source, documentId: origin.documentId, updatedAt: now };
      if ("decision" in DETAILS[key]) {
        const [previous] = await tx
          .select({ value: businessDetails.value })
          .from(businessDetails)
          .where(and(eq(businessDetails.businessId, business.id), eq(businessDetails.key, key)));
        if (previous?.value === row.value && reconfirm && basis) {
          await tx.insert(businessEvents).values({
            businessId: business.id,
            kind: "decision",
            key,
            before: previous.value,
            after: row.value,
            summary: [`${DETAILS[key].label}: kept ${displayDetail(key, row.value)}, with your new answers`],
            basis,
            createdAt: now,
          });
        } else if (previous?.value !== row.value) {
          const before = previous ? displayDetail(key, previous.value) : "Not decided";
          await tx.insert(businessEvents).values({
            businessId: business.id,
            kind: "decision",
            key,
            before: previous?.value ?? null,
            after: row.value,
            summary: [`${DETAILS[key].label}: ${before} → ${displayDetail(key, row.value)}`],
            basis,
            createdAt: now,
          });
        }
      }
      await tx
        .insert(businessDetails)
        .values({ businessId: business.id, key, ...row })
        .onConflictDoUpdate({ target: [businessDetails.businessId, businessDetails.key], set: row });
    }
    return true;
  });
}

export async function deleteDetailForOwner(db: Db, ownerId: string, key: DetailKey): Promise<boolean> {
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  if (!business) return false;
  await db.delete(businessDetails).where(and(eq(businessDetails.businessId, business.id), eq(businessDetails.key, key)));
  return true;
}
