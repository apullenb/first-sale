import { describe, expect, it } from "vitest";
import { applyOrder } from "./inventory";

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
