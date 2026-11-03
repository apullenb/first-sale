import { beforeEach, describe, expect, it } from "vitest";
import { stockMovements } from "@/db/schema";
import { productValues } from "@/lib/products/test-values";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { cancelOrderForOwner, listOrdersForOwner, type NewOrder, recordOrderForOwner } from "./orders";
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
