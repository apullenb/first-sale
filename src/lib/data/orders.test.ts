import { beforeEach, describe, expect, it } from "vitest";
import { stockMovements } from "@/db/schema";
import { productValues } from "@/lib/products/test-values";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { cancelOrderForOwner, listOrdersForOwner, type NewOrder, progressOrderForOwner, recordOrderForOwner, replaceOrderLinesForOwner, updateOrderDetailsForOwner } from "./orders";
import { createProductForOwner, deleteProductForOwner, getProductForOwner } from "./products";

let db: Awaited<ReturnType<typeof createTestDb>>;
let candle: string;
let loaf: string;

const options = {
  groups: [{ name: "Size", values: ["8 oz", "12 oz"] }, { name: "Scent", values: ["Cedar", "Lavender"] }],
  variants: [
    { values: ["8 oz", "Cedar"], priceCents: null, quantity: 3 },
    { values: ["8 oz", "Lavender"], priceCents: null, quantity: 2 },
    { values: ["12 oz", "Cedar"], priceCents: 1800, quantity: 1 },
    { values: ["12 oz", "Lavender"], priceCents: 1800, quantity: 4 },
  ],
};

const order = (lines: NewOrder["lines"]): NewOrder => ({ customerName: "Jo", fulfillment: "pickup", requestedDate: null, notes: "", lines });

async function create(overrides: Parameters<typeof productValues>[0]) {
  const made = await createProductForOwner(db, "owner-a", productValues(overrides));
  if (!made.ok) throw new Error(made.reason);
  return made.id;
}

const variantStock = async (id: string) => (await getProductForOwner(db, "owner-a", id))?.options.variants.map((variant) => variant.quantity);

beforeEach(async () => {
  db = await createTestDb();
  await seedOwners(db);
  candle = await create({ name: "Candle", priceCents: 1200, quantity: 10, options });
  loaf = await create({ name: "Loaf", priceCents: 950, quantity: 5 });
});

describe("orders by option", () => {
  it("save the exact option and its price, and take stock from that option only", async () => {
    const result = await recordOrderForOwner(db, "owner-a", order([
      { productId: candle, values: ["12 oz", "Lavender"], quantity: 3 },
      { productId: candle, values: ["8 oz", "Cedar"], quantity: 1 },
      { productId: loaf, values: [], quantity: 2 },
    ]));
    expect(result.ok).toBe(true);
    expect(await variantStock(candle)).toEqual([2, 2, 1, 1]);
    expect((await getProductForOwner(db, "owner-a", candle))?.quantity).toBe(6);
    expect((await getProductForOwner(db, "owner-a", loaf))?.quantity).toBe(3);
    const [saved] = await listOrdersForOwner(db, "owner-a");
    expect(saved.status).toBe("confirmed");
    expect(saved.lines.map((line) => [line.name, line.values, line.quantity, line.unitPriceCents])).toEqual([
      ["Candle", ["12 oz", "Lavender"], 3, 1800],
      ["Candle", ["8 oz", "Cedar"], 1, 1200],
      ["Loaf", [], 2, 950],
    ]);
    expect(await listOrdersForOwner(db, "owner-b")).toEqual([]);
  });

  it("save nothing when one option is short", async () => {
    const result = await recordOrderForOwner(db, "owner-a", order([
      { productId: loaf, values: [], quantity: 1 },
      { productId: candle, values: ["12 oz", "Cedar"], quantity: 2 },
    ]));
    expect(result).toMatchObject({ ok: false, reason: "needs_review", issues: [{ kind: "insufficient_stock", values: ["12 oz", "Cedar"], available: 1 }] });
    expect(await variantStock(candle)).toEqual([3, 2, 1, 4]);
    expect((await getProductForOwner(db, "owner-a", loaf))?.quantity).toBe(5);
    expect(await listOrdersForOwner(db, "owner-a")).toEqual([]);
    expect(await db.select().from(stockMovements)).toEqual([]);
  });

  it("only use the owner's own items", async () => {
    const result = await recordOrderForOwner(db, "owner-b", order([{ productId: candle, values: ["8 oz", "Cedar"], quantity: 1 }]));
    expect(result).toMatchObject({ ok: false, reason: "needs_review", issues: [{ kind: "unknown_product" }] });
    expect(await variantStock(candle)).toEqual([3, 2, 1, 4]);
  });

  it("put stock back to the same option when cancelled, once", async () => {
    const result = await recordOrderForOwner(db, "owner-a", order([{ productId: candle, values: ["8 oz", "Lavender"], quantity: 2 }]));
    if (!result.ok) throw new Error("expected ok");
    expect(await variantStock(candle)).toEqual([3, 0, 1, 4]);
    expect(await cancelOrderForOwner(db, "owner-b", result.id)).toBe("not_found");
    expect(await cancelOrderForOwner(db, "owner-a", result.id)).toBe("cancelled");
    expect(await variantStock(candle)).toEqual([3, 2, 1, 4]);
    expect((await getProductForOwner(db, "owner-a", candle))?.quantity).toBe(10);
    expect(await cancelOrderForOwner(db, "owner-a", result.id)).toBe("already_cancelled");
    expect(await variantStock(candle)).toEqual([3, 2, 1, 4]);
    const [saved] = await listOrdersForOwner(db, "owner-a");
    expect(saved.status).toBe("cancelled");
    expect(saved.events.map((event) => event.summary)).toContain("2 put back in stock");
  });

  it("keep items on orders from being deleted", async () => {
    await recordOrderForOwner(db, "owner-a", order([{ productId: loaf, values: [], quantity: 1 }]));
    expect(await deleteProductForOwner(db, "owner-a", loaf)).toBe("on_orders");
  });
});

describe("orders with custom lines, edits and details", () => {
  it("mix saved and custom lines in the order typed, total them and record a deposit", async () => {
    const result = await recordOrderForOwner(db, "owner-a", {
      ...order([
        { kind: "item", productId: candle, values: ["12 oz", "Cedar"], quantity: 1 },
        { kind: "custom", description: "Gift wrap", quantity: 2, unitPriceCents: 300 },
        { kind: "item", productId: loaf, values: [], quantity: 2 },
      ]),
      deposit: { amountCents: 1000, paidOn: "2026-11-03", note: "Cash" },
    });
    if (!result.ok) throw new Error("expected ok");
    const [saved] = await listOrdersForOwner(db, "owner-a");
    expect(saved.lines.map((line) => [line.productId === null, line.name, line.quantity, line.unitPriceCents])).toEqual([
      [false, "Candle", 1, 1800],
      [true, "Gift wrap", 2, 300],
      [false, "Loaf", 2, 950],
    ]);
    expect(saved.totalCents).toBe(1800 + 600 + 1900);
    expect(saved.payments).toMatchObject([{ kind: "payment", amountCents: 1000, note: "Cash" }]);
    expect(saved.events.map((event) => event.summary)).toContain("Deposit recorded; partially paid");
  });

  it("leave the total open while a custom line has no price, and refuse a deposit then", async () => {
    const lines: NewOrder["lines"] = [{ kind: "custom", description: "Repair", quantity: 1, unitPriceCents: null }];
    expect(await recordOrderForOwner(db, "owner-a", { ...order(lines), deposit: { amountCents: 100, paidOn: "2026-11-03", note: "" } })).toEqual({ ok: false, reason: "bad_deposit" });
    const result = await recordOrderForOwner(db, "owner-a", order(lines));
    if (!result.ok) throw new Error("expected ok");
    const [saved] = await listOrdersForOwner(db, "owner-a");
    expect(saved.totalCents).toBeNull();
    expect(saved.lines[0]).toMatchObject({ productId: null, kind: null, name: "Repair" });
  });

  it("change items by giving back what the order held and taking for the new lines, once", async () => {
    const result = await recordOrderForOwner(db, "owner-a", order([{ productId: candle, values: ["8 oz", "Lavender"], quantity: 2 }, { productId: loaf, values: [], quantity: 1 }]));
    if (!result.ok) throw new Error("expected ok");
    expect(await variantStock(candle)).toEqual([3, 0, 1, 4]);
    const edited = await replaceOrderLinesForOwner(db, "owner-a", result.id, [
      { kind: "item", productId: candle, values: ["8 oz", "Lavender"], quantity: 1 },
      { kind: "item", productId: candle, values: ["12 oz", "Lavender"], quantity: 2 },
      { kind: "custom", description: "Card", quantity: 1, unitPriceCents: 250 },
    ]);
    expect(edited).toEqual({ ok: true });
    expect(await variantStock(candle)).toEqual([3, 1, 1, 2]);
    expect((await getProductForOwner(db, "owner-a", loaf))?.quantity).toBe(5);
    const [saved] = await listOrdersForOwner(db, "owner-a");
    expect(saved.totalCents).toBe(1200 + 3600 + 250);
    expect(saved.events.map((event) => event.summary)).toEqual(expect.arrayContaining(["Items changed", "2 taken from stock; 2 put back in stock"]));
    // Too many: nothing changes
    const short = await replaceOrderLinesForOwner(db, "owner-a", result.id, [{ kind: "item", productId: candle, values: ["12 oz", "Cedar"], quantity: 5 }]);
    expect(short).toMatchObject({ ok: false, reason: "needs_review" });
    expect(await variantStock(candle)).toEqual([3, 1, 1, 2]);
    // Cancelling gives back only what it still holds
    expect(await cancelOrderForOwner(db, "owner-a", result.id)).toBe("cancelled");
    expect(await variantStock(candle)).toEqual([3, 2, 1, 4]);
    expect((await getProductForOwner(db, "owner-a", loaf))?.quantity).toBe(5);
    expect(await replaceOrderLinesForOwner(db, "owner-a", result.id, [{ kind: "custom", description: "x", quantity: 1, unitPriceCents: 1 }])).toEqual({ ok: false, reason: "not_editable" });
  });

  it("won't drop the total below what's paid, or leave it open once paid", async () => {
    const result = await recordOrderForOwner(db, "owner-a", { ...order([{ productId: loaf, values: [], quantity: 2 }]), deposit: { amountCents: 1500, paidOn: "2026-11-03", note: "" } });
    if (!result.ok) throw new Error("expected ok");
    expect(await replaceOrderLinesForOwner(db, "owner-a", result.id, [{ kind: "item", productId: loaf, values: [], quantity: 1 }])).toEqual({ ok: false, reason: "below_paid" });
    expect(await replaceOrderLinesForOwner(db, "owner-a", result.id, [{ kind: "custom", description: "Bread", quantity: 1, unitPriceCents: null }])).toEqual({ ok: false, reason: "unpriced_paid" });
    expect(await replaceOrderLinesForOwner(db, "owner-b", result.id, [{ kind: "item", productId: loaf, values: [], quantity: 3 }])).toEqual({ ok: false, reason: "not_found" });
    expect((await getProductForOwner(db, "owner-a", loaf))?.quantity).toBe(3);
  });

  it("update contact, notes and schedule; a handover must fit the current step", async () => {
    const result = await recordOrderForOwner(db, "owner-a", order([{ kind: "custom", description: "Cake", quantity: 1, unitPriceCents: 4000 }]));
    if (!result.ok) throw new Error("expected ok");
    expect(await updateOrderDetailsForOwner(db, "owner-b", result.id, { notes: "x" })).toBe("not_found");
    expect(
      await updateOrderDetailsForOwner(db, "owner-a", result.id, { customerPhone: "555-0100", notes: "No nuts", requestedDate: "2026-11-07", jobTime: "10:00", fulfillment: "delivery", location: "12 Oak St" }),
    ).toBe("saved");
    const [saved] = await listOrdersForOwner(db, "owner-a");
    expect(saved).toMatchObject({ customerPhone: "555-0100", notes: "No nuts", requestedDate: "2026-11-07", jobTime: "10:00", fulfillment: "delivery", location: "12 Oak St" });
    expect(saved.events.at(-1)?.summary).toBe("Customer details, Notes, Schedule updated");
    expect(await progressOrderForOwner(db, "owner-a", result.id, "ready")).toBe(true);
    expect(await updateOrderDetailsForOwner(db, "owner-a", result.id, { fulfillment: "shipping" })).toBe("fulfillment");
    expect(await progressOrderForOwner(db, "owner-a", result.id, "fulfilled")).toBe(true);
    expect(await updateOrderDetailsForOwner(db, "owner-a", result.id, { requestedDate: null })).toBe("not_editable");
    expect(await updateOrderDetailsForOwner(db, "owner-a", result.id, { notes: "Picked up" })).toBe("saved");
  });
});
