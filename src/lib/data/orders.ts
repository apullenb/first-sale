import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  businesses,
  orderEvents,
  orderLines,
  orders,
  orderPayments,
  products,
  stockMovements,
} from "@/db/schema";
import type { FulfillmentMethod, ORDER_STATUSES } from "@/lib/domain";
import {
  type ItemStock,
  netTaken,
  type OptionMovement,
  type OrderItem,
  type PlaceOrderIssue,
  type PlacedLine,
  placeOrder,
  type RequestedLine,
  restoreStock,
  sumMovements,
} from "@/lib/rules/inventory";
import { type CustomLineInput, type LineInput, linesTotals, MAX_LINE_CENTS } from "@/lib/rules/order-lines";
import {
  canProgressSample,
  canTransition,
  fulfillmentFits,
  paymentSummary,
  validPayment,
  type TrackingInput,
  type TrackingStatus,
  type WorkType,
} from "@/lib/rules/order-tracking";
import { readOptions, variantKey } from "@/lib/rules/products";
import { isEmailDemoKey } from "./email-demo-orders";

// Owner-scoped like products.ts. Prices and stock come from rules/inventory.ts.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface NewOrder {
  customerName: string;
  fulfillment: FulfillmentMethod;
  requestedDate: string | null;
  notes: string;
  // Saved items without a kind are read as kind "item"
  lines: (LineInput | RequestedLine)[];
  id?: string;
  requestKey?: string;
  customerEmail?: string;
  customerPhone?: string;
  workType?: WorkType;
  title?: string;
  jobTime?: string;
  location?: string;
  totalCents?: number | null;
  // A payment already received, recorded with the order
  deposit?: { amountCents: number; paidOn: string; note: string } | null;
}

export type RecordOrderResult =
  | { ok: true; id: string }
  | { ok: false; reason: "no_business" | "not_editable" | "bad_deposit" | "too_large" }
  | {
      ok: false;
      reason: "needs_review";
      issues: PlaceOrderIssue[];
      names: Record<string, string>;
    };

export interface OrderView {
  customerEmail: string;
  customerPhone: string;
  workType: WorkType;
  title: string;
  jobTime: string;
  location: string;
  totalCents: number | null;
  source: "manual" | "email" | "invoice";
  payments: {
    id: string;
    amountCents: number;
    kind: "payment" | "refund";
    paidOn: string;
    note: string;
  }[];
  id: string;
  isDemo: boolean;
  // A DEMO order from the email demo; only its progress can change
  emailSample: boolean;
  customerName: string;
  fulfillment: FulfillmentMethod;
  requestedDate: string | null;
  notes: string;
  status: (typeof ORDER_STATUSES)[number];
  createdAt: Date;
  lines: {
    id: number;
    // Null on a custom line
    productId: string | null;
    name: string;
    kind: "product" | "service" | null;
    priceText: string;
    values: string[];
    quantity: number;
    unitPriceCents: number | null;
  }[];
  events: {
    actor: "rule" | "ai" | "owner";
    summary: string;
    createdAt: Date;
  }[];
}

async function businessOf(
  db: Db | Tx,
  ownerId: string,
  lock = false,
): Promise<string | null> {
  const query = db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.ownerId, ownerId));
  const [row] = lock ? await query.for("update") : await query;
  return row?.id ?? null;
}

// Locked so two orders can't both take the last one
async function lockedItems(
  tx: Tx,
  businessId: string,
  productIds: string[],
  confirmedOnly: boolean,
): Promise<(OrderItem & { name: string })[]> {
  if (!productIds.length) return [];
  const rows = await tx
    .select({
      id: products.id,
      name: products.name,
      priceCents: products.priceCents,
      quantity: products.quantity,
      options: products.options,
    })
    .from(products)
    .where(
      and(
        eq(products.businessId, businessId),
        inArray(products.id, productIds),
        confirmedOnly ? eq(products.status, "confirmed") : undefined,
      ),
    )
    .for("update");
  return rows.map((row) => ({ ...row, options: readOptions(row.options) }));
}

async function saveStock(
  tx: Tx,
  businessId: string,
  stock: readonly ItemStock[],
) {
  for (const item of stock) {
    await tx
      .update(products)
      .set({ quantity: item.quantity, options: item.options })
      .where(
        and(
          eq(products.id, item.productId),
          eq(products.businessId, businessId),
        ),
      );
  }
}

const count = (movements: readonly OptionMovement[]) =>
  movements.reduce((sum, movement) => sum + Math.abs(movement.delta), 0);

const asLine = (line: LineInput | RequestedLine): LineInput =>
  "kind" in line ? line : { kind: "item", ...line };

const fitsMoney = (cents: number | null) =>
  cents === null || (Number.isSafeInteger(cents) && cents >= 0 && cents <= MAX_LINE_CENTS);

const NO_ITEMS = {
  status: "confirmed" as const,
  lines: [] as PlacedLine[],
  totalCents: null,
  movements: [] as OptionMovement[],
  stock: [] as ItemStock[],
};

// Rows in the order typed; repeats of one option merge into its first line
function lineRows(
  orderId: string,
  entered: readonly LineInput[],
  placed: readonly PlacedLine[],
  names: ReadonlyMap<string, string>,
): (typeof orderLines.$inferInsert)[] {
  const used = new Set<PlacedLine>();
  return entered.flatMap((line): (typeof orderLines.$inferInsert)[] => {
    if (line.kind === "custom")
      return [
        {
          orderId,
          productId: null,
          nameSnapshot: line.description,
          optionValues: [],
          variantKey: "",
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
        },
      ];
    const match = placed.find(
      (each) =>
        each.productId === line.productId &&
        variantKey(each.values) === variantKey(line.values),
    );
    if (!match || used.has(match)) return [];
    used.add(match);
    return [
      {
        orderId,
        productId: match.productId,
        nameSnapshot: names.get(match.productId) ?? null,
        optionValues: match.values,
        variantKey: variantKey(match.values),
        quantity: match.quantity,
        unitPriceCents: match.unitPriceCents,
      },
    ];
  });
}

const customOnly = (lines: readonly LineInput[]) =>
  lines.filter((line): line is CustomLineInput => line.kind === "custom");
const itemsOnly = (lines: readonly LineInput[]) =>
  lines.flatMap((line) => (line.kind === "item" ? [line] : []));

export async function recordOrderForOwner(
  db: Db,
  ownerId: string,
  order: NewOrder,
): Promise<RecordOrderResult> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId)
      return { ok: false as const, reason: "no_business" as const };
    const entered = order.lines.map(asLine);
    const itemLines = itemsOnly(entered);
    const items = await lockedItems(
      tx,
      businessId,
      [...new Set(itemLines.map((line) => line.productId))],
      true,
    );
    if (order.requestKey) {
      const [prior] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.businessId, businessId),
            eq(orders.requestKey, order.requestKey),
          ),
        );
      if (prior) return { ok: true as const, id: prior.id };
    }
    if (order.id) {
      const [prior] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, order.id), eq(orders.businessId, businessId)))
        .for("update");
      if (
        !prior ||
        prior.isDemo ||
        !["new", "needs_review"].includes(prior.status)
      )
        return { ok: false as const, reason: "not_editable" as const };
    }
    const placed = itemLines.length ? placeOrder(items, itemLines) : NO_ITEMS;
    if (placed.status === "needs_review") {
      return {
        ok: false as const,
        reason: "needs_review" as const,
        issues: placed.issues,
        names: Object.fromEntries(items.map((item) => [item.id, item.name])),
      };
    }
    // With lines, the total is theirs (none until every line has a price); without, the agreed total
    const totals = linesTotals([...placed.lines, ...customOnly(entered)]);
    const totalCents = entered.length
      ? totals.totalCents
      : (order.totalCents ?? null);
    if (!fitsMoney(totalCents) || !fitsMoney(totals.subtotalCents))
      return { ok: false as const, reason: "too_large" as const };
    const deposit = order.deposit
      ? { kind: "payment" as const, ...order.deposit }
      : null;
    if (deposit && !validPayment(totalCents, [], deposit))
      return { ok: false as const, reason: "bad_deposit" as const };
    const values = {
      customerName: order.customerName,
      customerEmail: order.customerEmail ?? "",
      customerPhone: order.customerPhone ?? "",
      workType: order.workType ?? "products",
      title: order.title ?? "",
      jobTime: order.jobTime ?? "",
      location: order.location ?? "",
      totalCents,
      fulfillment: order.fulfillment,
      requestedDate: order.requestedDate,
      notes: order.notes,
      status: "confirmed" as const,
      requestKey: order.requestKey,
      updatedAt: new Date(),
    };
    const [row] = order.id
      ? await tx
          .update(orders)
          .set(values)
          .where(
            and(eq(orders.id, order.id), eq(orders.businessId, businessId)),
          )
          .returning()
      : await tx
          .insert(orders)
          .values({ ...values, businessId })
          .returning();
    if (order.id)
      await tx.delete(orderLines).where(eq(orderLines.orderId, row.id));
    const rows = lineRows(
      row.id,
      entered,
      placed.lines,
      new Map(items.map((item) => [item.id, item.name])),
    );
    if (rows.length) await tx.insert(orderLines).values(rows);
    if (placed.movements.length) {
      await tx.insert(stockMovements).values(
        placed.movements.map((movement) => ({
          productId: movement.productId,
          orderId: row.id,
          optionValues: movement.values,
          delta: movement.delta,
          reason: "order",
        })),
      );
      await saveStock(tx, businessId, placed.stock);
    }
    const taken = count(placed.movements);
    await tx.insert(orderEvents).values([
      { orderId: row.id, actor: "owner" as const, summary: "Order entered" },
      {
        orderId: row.id,
        actor: "rule" as const,
        summary: taken
          ? `${taken} taken from stock`
          : "No counted stock on this order",
      },
    ]);
    if (deposit) {
      await tx
        .insert(orderPayments)
        .values({ orderId: row.id, requestKey: `deposit:${row.id}`, ...deposit });
      await tx.insert(orderEvents).values({
        orderId: row.id,
        actor: "owner" as const,
        summary: `Deposit recorded; ${paymentSummary(totalCents, [deposit]).status.toLowerCase()}`,
      });
    }
    return { ok: true as const, id: row.id };
  });
}

// Newest first; one order when an id is given
export async function listOrdersForOwner(
  db: Db,
  ownerId: string,
  onlyId?: string,
): Promise<OrderView[]> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return [];
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessId),
        onlyId ? eq(orders.id, onlyId) : undefined,
      ),
    )
    .orderBy(desc(orders.createdAt), desc(orders.id));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [lines, events, payments] = await Promise.all([
    db
      .select({
        id: orderLines.id,
        orderId: orderLines.orderId,
        productId: orderLines.productId,
        name: sql<string>`coalesce(${orderLines.nameSnapshot}, ${products.name}, '')`,
        kind: products.kind,
        priceText: sql<string>`coalesce(${products.priceText}, '')`,
        values: orderLines.optionValues,
        quantity: orderLines.quantity,
        unitPriceCents: orderLines.unitPriceCents,
      })
      .from(orderLines)
      .leftJoin(products, eq(products.id, orderLines.productId))
      .where(inArray(orderLines.orderId, ids))
      .orderBy(asc(orderLines.id)),
    db
      .select()
      .from(orderEvents)
      .where(inArray(orderEvents.orderId, ids))
      .orderBy(asc(orderEvents.id)),
    db
      .select()
      .from(orderPayments)
      .where(inArray(orderPayments.orderId, ids))
      .orderBy(asc(orderPayments.createdAt)),
  ]);
  return rows.map((row) => ({
    customerEmail: row.customerEmail,
    customerPhone: row.customerPhone,
    workType: row.workType,
    title: row.title,
    jobTime: row.jobTime,
    location: row.location,
    totalCents: row.totalCents,
    source: row.source,
    payments: payments
      .filter((payment) => payment.orderId === row.id)
      .map(({ id, amountCents, kind, paidOn, note }) => ({
        id,
        amountCents,
        kind,
        paidOn,
        note,
      })),
    id: row.id,
    isDemo: row.isDemo,
    emailSample: row.isDemo && isEmailDemoKey(row.requestKey),
    customerName: row.customerName,
    fulfillment: row.fulfillment,
    requestedDate: row.requestedDate,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt,
    lines: lines
      .filter((line) => line.orderId === row.id)
      .map(({ id, productId, name, kind, priceText, values, quantity, unitPriceCents }) => ({ id, productId, name, kind, priceText, values, quantity, unitPriceCents })),
    events: events
      .filter((event) => event.orderId === row.id)
      .map(({ actor, summary, createdAt }) => ({ actor, summary, createdAt })),
  }));
}

export async function getOrderForOwner(
  db: Db,
  ownerId: string,
  id: string,
): Promise<OrderView | null> {
  const [order] = await listOrdersForOwner(db, ownerId, id);
  return order ?? null;
}

async function orderMoves(tx: Tx, orderId: string): Promise<OptionMovement[]> {
  return tx
    .select({
      productId: stockMovements.productId,
      values: stockMovements.optionValues,
      delta: stockMovements.delta,
    })
    .from(stockMovements)
    .where(eq(stockMovements.orderId, orderId));
}

// Puts back what the order still holds, to the same options
export async function cancelOrderForOwner(
  db: Db,
  ownerId: string,
  orderId: string,
): Promise<"cancelled" | "not_found" | "already_cancelled" | "completed"> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return "not_found";
    const [order] = await tx
      .select({ id: orders.id, status: orders.status, isDemo: orders.isDemo })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId)))
      .for("update");
    if (!order) return "not_found";
    if (order.status === "cancelled") return "already_cancelled";
    if (
      order.isDemo ||
      order.status === "fulfilled" ||
      order.status === "shipped"
    )
      return "completed";
    const held = netTaken(await orderMoves(tx, order.id));
    const items = await lockedItems(
      tx,
      businessId,
      [...new Set(held.map((move) => move.productId))],
      false,
    );
    const restored = restoreStock(items, held);
    if (restored.movements.length) {
      await tx.insert(stockMovements).values(
        restored.movements.map((movement) => ({
          productId: movement.productId,
          orderId: order.id,
          optionValues: movement.values,
          delta: movement.delta,
          reason: "cancelled",
        })),
      );
      await saveStock(tx, businessId, restored.stock);
    }
    await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(eq(orders.id, order.id));
    const back = count(restored.movements);
    await tx.insert(orderEvents).values([
      {
        orderId: order.id,
        actor: "owner" as const,
        summary: "Order cancelled",
      },
      ...(back || restored.skipped.length
        ? [
            {
              orderId: order.id,
              actor: "rule" as const,
              summary: `${back} put back in stock${restored.skipped.length ? `; ${count(restored.skipped)} not put back because that option is no longer counted` : ""}`,
            },
          ]
        : []),
    ]);
    return "cancelled";
  });
}

export type ReplaceLinesResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_editable" | "empty" | "too_large" | "below_paid" | "unpriced_paid" }
  | { ok: false; reason: "needs_review"; issues: PlaceOrderIssue[]; names: Record<string, string> };

// Gives back what the order held, then takes for the new lines; all or nothing
export async function replaceOrderLinesForOwner(
  db: Db,
  ownerId: string,
  orderId: string,
  input: readonly LineInput[],
): Promise<ReplaceLinesResult> {
  if (!input.length) return { ok: false, reason: "empty" };
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return { ok: false as const, reason: "not_found" as const };
    const [row] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.businessId, businessId)))
      .for("update");
    if (!row) return { ok: false as const, reason: "not_found" as const };
    if (row.isDemo || !["confirmed", "in_progress", "ready"].includes(row.status))
      return { ok: false as const, reason: "not_editable" as const };
    const held = netTaken(await orderMoves(tx, row.id));
    const itemLines = itemsOnly(input);
    const before = await lockedItems(
      tx,
      businessId,
      [...new Set([...held, ...itemLines].map((line) => line.productId))],
      false,
    );
    const restored = restoreStock(before, held);
    const back = new Map(restored.stock.map((stock) => [stock.productId, stock]));
    const items = before.map((item) => {
      const stock = back.get(item.id);
      return stock ? { ...item, quantity: stock.quantity, options: stock.options } : item;
    });
    const confirmed = await lockedItems(
      tx,
      businessId,
      [...new Set(itemLines.map((line) => line.productId))],
      true,
    );
    const orderable = items.filter((item) => confirmed.some((each) => each.id === item.id));
    const placed = itemLines.length ? placeOrder(orderable, itemLines) : NO_ITEMS;
    if (placed.status === "needs_review")
      return {
        ok: false as const,
        reason: "needs_review" as const,
        issues: placed.issues,
        names: Object.fromEntries(items.map((item) => [item.id, item.name])),
      };
    const totals = linesTotals([...placed.lines, ...customOnly(input)]);
    if (!fitsMoney(totals.totalCents) || !fitsMoney(totals.subtotalCents))
      return { ok: false as const, reason: "too_large" as const };
    const payments = await tx
      .select()
      .from(orderPayments)
      .where(eq(orderPayments.orderId, row.id));
    const paid = paymentSummary(row.totalCents, payments).paid;
    if (totals.totalCents === null && paid > 0)
      return { ok: false as const, reason: "unpriced_paid" as const };
    if (totals.totalCents !== null && totals.totalCents < paid)
      return { ok: false as const, reason: "below_paid" as const };
    await tx.delete(orderLines).where(eq(orderLines.orderId, row.id));
    await tx
      .insert(orderLines)
      .values(lineRows(row.id, input, placed.lines, new Map(items.map((item) => [item.id, item.name]))));
    const net = sumMovements([...restored.movements, ...placed.movements]);
    if (net.length) {
      await tx.insert(stockMovements).values(
        net.map((movement) => ({
          productId: movement.productId,
          orderId: row.id,
          optionValues: movement.values,
          delta: movement.delta,
          reason: "order edited",
        })),
      );
      const final = new Map(restored.stock.map((stock) => [stock.productId, stock]));
      for (const stock of placed.stock) final.set(stock.productId, stock);
      await saveStock(tx, businessId, [...final.values()]);
    }
    await tx
      .update(orders)
      .set({ totalCents: totals.totalCents, updatedAt: new Date() })
      .where(eq(orders.id, row.id));
    const given = net.filter((move) => move.delta > 0);
    const took = net.filter((move) => move.delta < 0);
    await tx.insert(orderEvents).values([
      { orderId: row.id, actor: "owner" as const, summary: "Items changed" },
      {
        orderId: row.id,
        actor: "rule" as const,
        summary: net.length
          ? [took.length ? `${count(took)} taken from stock` : "", given.length ? `${count(given)} put back in stock` : ""].filter(Boolean).join("; ")
          : "Stock unchanged",
      },
    ]);
    return { ok: true as const };
  });
}

export interface DetailsPatch {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  fulfillment?: FulfillmentMethod;
  requestedDate?: string | null;
  jobTime?: string;
  location?: string;
}

// Contact and notes change any time; schedule and handover only while work is open
export async function updateOrderDetailsForOwner(
  db: Db,
  ownerId: string,
  id: string,
  patch: DetailsPatch,
): Promise<"saved" | "not_found" | "not_editable" | "fulfillment"> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return "not_found";
    const [row] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.businessId, businessId)))
      .for("update");
    if (!row) return "not_found";
    if (row.isDemo) return "not_editable";
    const schedule = ["fulfillment", "requestedDate", "jobTime", "location"].some(
      (key) => key in patch,
    );
    if (schedule && ["cancelled", "fulfilled"].includes(row.status))
      return "not_editable";
    if (
      patch.fulfillment &&
      patch.fulfillment !== row.fulfillment &&
      !fulfillmentFits(row.status, row.workType, patch.fulfillment)
    )
      return "fulfillment";
    await tx
      .update(orders)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(orders.id, row.id));
    const changed = [
      "customerName" in patch || "customerEmail" in patch || "customerPhone" in patch ? "Customer details" : "",
      "notes" in patch ? "Notes" : "",
      schedule ? "Schedule" : "",
    ].filter(Boolean);
    await tx.insert(orderEvents).values({
      orderId: row.id,
      actor: "owner",
      summary: `${changed.join(", ") || "Details"} updated`,
    });
    return "saved";
  });
}

export async function progressOrderForOwner(
  db: Db,
  ownerId: string,
  id: string,
  status: TrackingStatus,
) {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return false;
    const [row] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.businessId, businessId)))
      .for("update");
    const sample = !!row?.isDemo && isEmailDemoKey(row.requestKey);
    if (
      !row ||
      (row.isDemo && !sample) ||
      !(sample ? canProgressSample : canTransition)(
        row.status,
        status,
        row.workType,
        row.fulfillment,
      )
    )
      return false;
    await tx
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, row.id));
    await tx.insert(orderEvents).values({
      orderId: id,
      actor: "owner",
      summary: `Progress: ${status.replaceAll("_", " ")}`,
    });
    return true;
  });
}

export async function paymentForOwner(
  db: Db,
  ownerId: string,
  input: {
    orderId: string;
    requestKey: string;
    amountCents: number;
    kind: "payment" | "refund";
    paidOn: string;
    note: string;
  },
) {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return false;
    const [row] = await tx
      .select()
      .from(orders)
      .where(
        and(eq(orders.id, input.orderId), eq(orders.businessId, businessId)),
      )
      .for("update");
    if (!row || row.isDemo || ["new", "needs_review"].includes(row.status))
      return false;
    const entries = await tx
      .select()
      .from(orderPayments)
      .where(eq(orderPayments.orderId, row.id));
    if (entries.some((entry) => entry.requestKey === input.requestKey))
      return true;
    if (row.status === "cancelled" && input.kind === "payment") return false;
    if (!validPayment(row.totalCents, entries, input)) return false;
    await tx.insert(orderPayments).values(input);
    const summary = paymentSummary(row.totalCents, [...entries, input]);
    await tx.insert(orderEvents).values({
      orderId: row.id,
      actor: "owner",
      summary: `${input.kind === "refund" ? "Refund" : "Payment"} recorded; ${summary.status.toLowerCase()}`,
    });
    await tx
      .update(orders)
      .set({ updatedAt: new Date() })
      .where(eq(orders.id, row.id));
    return true;
  });
}

export async function scheduleOrderForOwner(
  db: Db,
  ownerId: string,
  input: Pick<TrackingInput, "requestedDate" | "jobTime" | "location"> & {
    id: string;
  },
) {
  return (
    (await updateOrderDetailsForOwner(db, ownerId, input.id, {
      requestedDate: input.requestedDate || null,
      jobTime: input.jobTime,
      location: input.location,
    })) === "saved"
  );
}

export async function setOrderTotalForOwner(
  db: Db,
  ownerId: string,
  id: string,
  totalCents: number,
) {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return false;
    const [row] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.businessId, businessId)))
      .for("update");
    if (
      !row ||
      row.isDemo ||
      ["new", "needs_review", "cancelled"].includes(row.status) ||
      !Number.isSafeInteger(totalCents) ||
      totalCents < 0 ||
      totalCents > 100_000_000
    )
      return false;
    const [line] = await tx
      .select({ id: orderLines.id })
      .from(orderLines)
      .where(eq(orderLines.orderId, row.id))
      .limit(1);
    // Priced lines set the total; one without a price leaves it for the owner to agree
    if (line && row.totalCents !== null) return false;
    const payments = await tx
      .select()
      .from(orderPayments)
      .where(eq(orderPayments.orderId, row.id));
    if (totalCents < paymentSummary(row.totalCents, payments).paid)
      return false;
    await tx
      .update(orders)
      .set({ totalCents, updatedAt: new Date() })
      .where(eq(orders.id, row.id));
    await tx.insert(orderEvents).values({
      orderId: row.id,
      actor: "owner",
      summary: "Agreed total updated",
    });
    return true;
  });
}
