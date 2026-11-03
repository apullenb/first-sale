import "server-only";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, operationSetups } from "@/db/schema";
import type { OperationKind } from "@/lib/operations/catalog";
import { operationSetupSchema, type OperationSetup } from "@/lib/rules/operations";

export async function listOperationSetupsForOwner(db: Db, ownerId: string) {
  const rows = await db.select({ setup: operationSetups }).from(operationSetups)
    .innerJoin(businesses, eq(businesses.id, operationSetups.businessId)).where(eq(businesses.ownerId, ownerId));
  return rows.flatMap(({ setup }) => {
    const parsed = operationSetupSchema.safeParse(setup.config);
    return parsed.success && parsed.data.kind === setup.kind ? [{ kind: setup.kind, config: parsed.data, paused: setup.paused }] : [];
  });
}

export async function saveOperationSetupForOwner(db: Db, ownerId: string, input: OperationSetup) {
  const config = operationSetupSchema.parse(input);
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  if (!business) return false;
  const values = { businessId: business.id, kind: config.kind, config, paused: false, updatedAt: new Date() };
  await db.insert(operationSetups).values(values).onConflictDoUpdate({ target: [operationSetups.businessId, operationSetups.kind], set: { config, paused: false, updatedAt: values.updatedAt } });
  return true;
}

export async function pauseOperationSetupForOwner(db: Db, ownerId: string, kind: OperationKind, paused: boolean) {
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  if (!business) return false;
  const rows = await db.update(operationSetups).set({ paused, updatedAt: new Date() })
    .where(and(eq(operationSetups.businessId, business.id), eq(operationSetups.kind, kind))).returning();
  return rows.length > 0;
}
