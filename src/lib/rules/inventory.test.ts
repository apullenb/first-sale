import { describe, expect, it } from "vitest";
import { applyOrder, type OrderItem, orderTotalCents, placeOrder, restoreStock } from "./inventory";
import { NO_OPTIONS } from "./products";

const stock = { "lemon-loaf": 12, "sourdough": 3 };

describe("applyOrder", () => {
  it("confirms and records stock movements", () => {
    expect(applyOrder(stock, [{ productId: "lemon-loaf", quantity: 2 }])).toEqual({
      status: "confirmed",
      stock: { "lemon-loaf": 10, "sourdough": 3 },
      movements: [{ productId: "lemon-loaf", delta: -2 }],
    });
  });

  it("does not change the stock it was given", () => {
    applyOrder(stock, [{ productId: "lemon-loaf", quantity: 2 }]);
    expect(stock["lemon-loaf"]).toBe(12);
  });

  it("adds up repeated lines before checking stock", () => {
    const result = applyOrder(stock, [
      { productId: "sourdough", quantity: 2 },
      { productId: "sourdough", quantity: 2 },
    ]);
    expect(result).toEqual({
      status: "needs_review",
      issues: [{ kind: "insufficient_stock", productId: "sourdough", requested: 4, available: 3 }],
    });
  });

  it("changes nothing when any line fails", () => {
    const result = applyOrder(stock, [
      { productId: "lemon-loaf", quantity: 1 },
      { productId: "rye", quantity: 1 },
    ]);
    expect(result).toEqual({ status: "needs_review", issues: [{ kind: "unknown_product", productId: "rye" }] });
  });

  it("flags empty orders and bad quantities", () => {
    expect(applyOrder(stock, [])).toEqual({ status: "needs_review", issues: [{ kind: "empty_order" }] });
    expect(applyOrder(stock, [{ productId: "lemon-loaf", quantity: 1.5 }])).toEqual({
      status: "needs_review",
      issues: [{ kind: "invalid_quantity", productId: "lemon-loaf", quantity: 1.5 }],
    });
  });

  it("does not treat inherited object keys as products", () => {
    expect(applyOrder(stock, [{ productId: "toString", quantity: 1 }])).toEqual({
      status: "needs_review",
      issues: [{ kind: "unknown_product", productId: "toString" }],
    });
  });
});

describe("placeOrder: orders by option", () => {
  const candle: OrderItem = {
    id: "candle",
    priceCents: 1200,
    quantity: 8,
    options: {
      groups: [{ name: "Size", values: ["8 oz", "12 oz"] }, { name: "Scent", values: ["Cedar", "Lavender"] }],
      variants: [
        { values: ["8 oz", "Cedar"], priceCents: null, quantity: 3 },
        { values: ["8 oz", "Lavender"], priceCents: null, quantity: 0 },
        { values: ["12 oz", "Cedar"], priceCents: 1800, quantity: 1 },
        { values: ["12 oz", "Lavender"], priceCents: 1800, quantity: 4 },
      ],
    },
  };
  const groom: OrderItem = {
    id: "groom",
    priceCents: null,
    quantity: null,
    options: { groups: [{ name: "Dog size", values: ["Small", "Large"] }], variants: [{ values: ["Small"], priceCents: 6500, quantity: null }, { values: ["Large"], priceCents: 9500, quantity: null }] },
  };
  const loaf: OrderItem = { id: "loaf", priceCents: 950, quantity: 5, options: NO_OPTIONS };
  const items = [candle, groom, loaf];

  it("prices each line from its option, falling back to the item's price", () => {
    const result = placeOrder(items, [
      { productId: "candle", values: ["12 oz", "Lavender"], quantity: 2 },
      { productId: "candle", values: ["8 oz", "Cedar"], quantity: 1 },
      { productId: "groom", values: ["Large"], quantity: 1 },
    ]);
    if (result.status !== "confirmed") throw new Error("expected confirmed");
    expect(result.lines.map((line) => [line.values.join("/"), line.unitPriceCents, line.totalCents])).toEqual([
      ["12 oz/Lavender", 1800, 3600],
      ["8 oz/Cedar", 1200, 1200],
      ["Large", 9500, 9500],
    ]);
    expect(result.totalCents).toBe(14300);
  });

  it("takes stock from the ordered option only, and the item's total follows", () => {
    const result = placeOrder(items, [{ productId: "candle", values: ["12 oz", "lavender"], quantity: 3 }]);
    if (result.status !== "confirmed") throw new Error("expected confirmed");
    expect(result.movements).toEqual([{ productId: "candle", values: ["12 oz", "Lavender"], delta: -3 }]);
    const [stock] = result.stock;
    expect(stock.options.variants.map((variant) => variant.quantity)).toEqual([3, 0, 1, 1]);
    expect(stock.quantity).toBe(5);
    expect(candle.options.variants[3].quantity).toBe(4);
  });

  it("is all or nothing when one option is short, even if the item's total would cover it", () => {
    const result = placeOrder(items, [
      { productId: "loaf", values: [], quantity: 1 },
      { productId: "candle", values: ["12 oz", "Cedar"], quantity: 1 },
      { productId: "candle", values: ["12 oz", "Cedar"], quantity: 1 },
    ]);
    expect(result).toEqual({ status: "needs_review", issues: [{ kind: "insufficient_stock", productId: "candle", values: ["12 oz", "Cedar"], requested: 2, available: 1 }] });
  });

  it("needs an exact option for items that have them", () => {
    expect(placeOrder(items, [{ productId: "candle", values: [], quantity: 1 }])).toEqual({ status: "needs_review", issues: [{ kind: "choose_option", productId: "candle" }] });
    expect(placeOrder(items, [{ productId: "candle", values: ["16 oz", "Cedar"], quantity: 1 }])).toEqual({
      status: "needs_review",
      issues: [{ kind: "unknown_option", productId: "candle", values: ["16 oz", "Cedar"] }],
    });
    expect(placeOrder(items, [{ productId: "loaf", values: ["Large"], quantity: 1 }]).status).toBe("needs_review");
  });

  it("keeps items without options working as before", () => {
    const result = placeOrder(items, [{ productId: "loaf", values: [], quantity: 2 }]);
    if (result.status !== "confirmed") throw new Error("expected confirmed");
    expect(result.lines).toEqual([{ productId: "loaf", values: [], quantity: 2, unitPriceCents: 950, totalCents: 1900 }]);
    expect(result.stock).toEqual([{ productId: "loaf", quantity: 3, options: NO_OPTIONS }]);
    expect(placeOrder(items, [{ productId: "loaf", values: [], quantity: 6 }])).toEqual({
      status: "needs_review",
      issues: [{ kind: "insufficient_stock", productId: "loaf", values: [], requested: 6, available: 5 }],
    });
  });

  it("leaves uncounted options alone and shows no total when a price is missing", () => {
    const unpriced = { ...groom, options: { ...groom.options, variants: [{ values: ["Small"], priceCents: null, quantity: null }, groom.options.variants[1]] } };
    const result = placeOrder([unpriced], [{ productId: "groom", values: ["Small"], quantity: 2 }]);
    if (result.status !== "confirmed") throw new Error("expected confirmed");
    expect(result.movements).toEqual([]);
    expect(result.stock).toEqual([]);
    expect(result.totalCents).toBeNull();
  });

  it("restores a cancelled order's stock to the same option", () => {
    const placed = placeOrder(items, [{ productId: "candle", values: ["8 oz", "Cedar"], quantity: 2 }, { productId: "loaf", values: [], quantity: 1 }]);
    if (placed.status !== "confirmed") throw new Error("expected confirmed");
    const after = items.map((item) => {
      const stock = placed.stock.find((each) => each.productId === item.id);
      return stock ? { ...item, quantity: stock.quantity, options: stock.options } : item;
    });
    const restored = restoreStock(after, placed.movements);
    expect(restored.skipped).toEqual([]);
    expect(restored.stock.find((each) => each.productId === "candle")?.options.variants.map((variant) => variant.quantity)).toEqual([3, 0, 1, 4]);
    expect(restored.stock.find((each) => each.productId === "loaf")?.quantity).toBe(5);
  });

  it("doesn't guess where to put stock back when the option is gone", () => {
    const renamed = { ...candle, options: { groups: [{ name: "Size", values: ["Small"] }], variants: [{ values: ["Small"], priceCents: null, quantity: 2 }] } };
    const taken = [{ productId: "candle", values: ["8 oz", "Cedar"], delta: -2 }];
    expect(restoreStock([renamed], taken)).toEqual({ stock: [], movements: [], skipped: taken });
  });

  it("adds money up only when every line has a price", () => {
    expect(orderTotalCents([{ unitPriceCents: 1800, quantity: 2 }, { unitPriceCents: 950, quantity: 1 }])).toBe(4550);
    expect(orderTotalCents([{ unitPriceCents: 1800, quantity: 2 }, { unitPriceCents: null, quantity: 1 }])).toBeNull();
  });
});
