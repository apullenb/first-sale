import "server-only";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businessDetails, businesses } from "@/db/schema";
import { type DetailKey, isDetailKey } from "@/lib/details";

// Owner-scoped like businesses.ts. Values are checked with detailProblem before they get here.

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
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
    if (!business) return false;
    for (const { key, value } of values) {
      const row = { value: value.trim(), source: origin.source, documentId: origin.documentId, updatedAt: now };
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
