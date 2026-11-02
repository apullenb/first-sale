import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, orderEvents, orderLines, orders, products, stockMovements } from "@/db/schema";
import type { FULFILLMENT_METHODS, ORDER_STATUSES } from "@/lib/domain";
import { type ItemStock, type OptionMovement, type OrderItem, type PlaceOrderIssue, placeOrder, type RequestedLine, restoreStock } from "@/lib/rules/inventory";
import { readOptions, variantKey } from "@/lib/rules/products";

// Owner-scoped like products.ts. Prices and stock come from rules/inventory.ts.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface NewOrder {
  customerName: string;
  fulfillment: (typeof FULFILLMENT_METHODS)[number];
  requestedDate: string | null;
  notes: string;
  lines: RequestedLine[];
}

export type RecordOrderResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_business" }
  | { ok: false; reason: "needs_review"; issues: PlaceOrderIssue[]; names: Record<string, string> };

export interface OrderView {
  id: string;
  isDemo: boolean;
  customerName: string;
  fulfillment: (typeof FULFILLMENT_METHODS)[number];
  requestedDate: string | null;
  notes: string;
  status: (typeof ORDER_STATUSES)[number];
  createdAt: Date;
  lines: { productId: string; name: string; kind: "product" | "service"; priceText: string; values: string[]; quantity: number; unitPriceCents: number | null }[];
  events: { actor: "rule" | "ai" | "owner"; summary: string; createdAt: Date }[];
}

async function businessOf(db: Db | Tx, ownerId: string, lock = false): Promise<string | null> {
  const query = db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  const [row] = lock ? await query.for("update") : await query;
  return row?.id ?? null;
}

// Locked so two orders can't both take the last one
async function lockedItems(tx: Tx, businessId: string, productIds: string[], confirmedOnly: boolean): Promise<(OrderItem & { name: string })[]> {
  if (!productIds.length) return [];
  const rows = await tx
    .select({ id: products.id, name: products.name, priceCents: products.priceCents, quantity: products.quantity, options: products.options })
    .from(products)
    .where(and(eq(products.businessId, businessId), inArray(products.id, productIds), confirmedOnly ? eq(products.status, "confirmed") : undefined))
    .for("update");
  return rows.map((row) => ({ ...row, options: readOptions(row.options) }));
}

async function saveStock(tx: Tx, businessId: string, stock: readonly ItemStock[]) {
  for (const item of stock) {
    await tx.update(products).set({ quantity: item.quantity, options: item.options }).where(and(eq(products.id, item.productId), eq(products.businessId, businessId)));
  }
}

const count = (movements: readonly OptionMovement[]) => movements.reduce((sum, movement) => sum + Math.abs(movement.delta), 0);

export async function recordOrderForOwner(db: Db, ownerId: string, order: NewOrder): Promise<RecordOrderResult> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return { ok: false as const, reason: "no_business" as const };
    const items = await lockedItems(tx, businessId, [...new Set(order.lines.map((line) => line.productId))], true);
    const placed = placeOrder(items, order.lines);
    if (placed.status === "needs_review") {
      return { ok: false as const, reason: "needs_review" as const, issues: placed.issues, names: Object.fromEntries(items.map((item) => [item.id, item.name])) };
    }
    const [row] = await tx
      .insert(orders)
      .values({ businessId, customerName: order.customerName, fulfillment: order.fulfillment, requestedDate: order.requestedDate, notes: order.notes, status: "confirmed" })
      .returning();
    await tx.insert(orderLines).values(
      placed.lines.map((line) => ({ orderId: row.id, productId: line.productId, optionValues: line.values, variantKey: variantKey(line.values), quantity: line.quantity, unitPriceCents: line.unitPriceCents })),
    );
    if (placed.movements.length) {
      await tx.insert(stockMovements).values(placed.movements.map((movement) => ({ productId: movement.productId, orderId: row.id, optionValues: movement.values, delta: movement.delta, reason: "order" })));
      await saveStock(tx, businessId, placed.stock);
    }
    const taken = count(placed.movements);
    await tx.insert(orderEvents).values([
      { orderId: row.id, actor: "owner" as const, summary: "Order entered" },
      { orderId: row.id, actor: "rule" as const, summary: taken ? `${taken} taken from stock` : "No counted stock on this order" },
    ]);
    return { ok: true as const, id: row.id };
  });
}

// Newest first
export async function listOrdersForOwner(db: Db, ownerId: string): Promise<OrderView[]> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return [];
  const rows = await db.select().from(orders).where(eq(orders.businessId, businessId)).orderBy(desc(orders.createdAt), desc(orders.id));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [lines, events] = await Promise.all([
    db
      .select({ orderId: orderLines.orderId, productId: orderLines.productId, name: products.name, kind: products.kind, priceText: products.priceText, values: orderLines.optionValues, quantity: orderLines.quantity, unitPriceCents: orderLines.unitPriceCents })
      .from(orderLines)
      .innerJoin(products, eq(products.id, orderLines.productId))
      .where(inArray(orderLines.orderId, ids))
      .orderBy(asc(orderLines.id)),
    db.select().from(orderEvents).where(inArray(orderEvents.orderId, ids)).orderBy(asc(orderEvents.id)),
  ]);
  return rows.map((row) => ({
    id: row.id,
    isDemo: row.isDemo,
    customerName: row.customerName,
    fulfillment: row.fulfillment,
    requestedDate: row.requestedDate,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt,
    lines: lines.filter((line) => line.orderId === row.id).map(({ productId, name, kind, priceText, values, quantity, unitPriceCents }) => ({ productId, name, kind, priceText, values, quantity, unitPriceCents })),
    events: events.filter((event) => event.orderId === row.id).map(({ actor, summary, createdAt }) => ({ actor, summary, createdAt })),
  }));
}

// Puts back what the order took, to the same options
export async function cancelOrderForOwner(db: Db, ownerId: string, orderId: string): Promise<"cancelled" | "not_found" | "already_cancelled"> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return "not_found";
    const [order] = await tx.select({ id: orders.id, status: orders.status }).from(orders).where(and(eq(orders.id, orderId), eq(orders.businessId, businessId))).for("update");
    if (!order) return "not_found";
    if (order.status === "cancelled") return "already_cancelled";
    const moves = await tx.select({ productId: stockMovements.productId, values: stockMovements.optionValues, delta: stockMovements.delta }).from(stockMovements).where(eq(stockMovements.orderId, order.id));
    const items = await lockedItems(tx, businessId, [...new Set(moves.map((move) => move.productId))], false);
    const restored = restoreStock(items, moves);
    if (restored.movements.length) {
      await tx.insert(stockMovements).values(restored.movements.map((movement) => ({ productId: movement.productId, orderId: order.id, optionValues: movement.values, delta: movement.delta, reason: "cancelled" })));
      await saveStock(tx, businessId, restored.stock);
    }
    await tx.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));
    const back = count(restored.movements);
    await tx.insert(orderEvents).values([
      { orderId: order.id, actor: "owner" as const, summary: "Order cancelled" },
      ...(back || restored.skipped.length
        ? [{ orderId: order.id, actor: "rule" as const, summary: `${back} put back in stock${restored.skipped.length ? `; ${count(restored.skipped)} not put back because that option is no longer counted` : ""}` }]
        : []),
    ]);
    return "cancelled";
  });
}
