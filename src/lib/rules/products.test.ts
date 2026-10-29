import { describe, expect, it } from "vitest";
import { checkProduct, formOf, marginOf, type ProductForm } from "./products";

const form = (overrides: Partial<ProductForm> = {}): ProductForm => ({ name: "Sourdough loaf", description: "Naturally leavened", price: "9.50", unitCost: "", quantity: "", photo: null, ...overrides });

describe("checking a product", () => {
  it("keeps the price exactly as typed, in cents", () => {
    expect(checkProduct(form())).toEqual({
      ok: true,
      value: { name: "Sourdough loaf", description: "Naturally leavened", priceCents: 950, unitCostCents: null, quantity: null, photo: null },
    });
    expect(checkProduct(form({ price: "$1,200" }))).toMatchObject({ ok: true, value: { priceCents: 120_000 } });
    expect(checkProduct(form({ price: "0" }))).toMatchObject({ ok: true, value: { priceCents: 0 } });
  });

  it("needs a name and a plain dollar price", () => {
    expect(checkProduct(form({ name: "  " }))).toMatchObject({ ok: false, field: "name" });
    expect(checkProduct(form({ price: "" }))).toMatchObject({ ok: false, field: "price" });
    expect(checkProduct(form({ price: "about 10" }))).toMatchObject({ ok: false, field: "price" });
    expect(checkProduct(form({ price: "9.999" }))).toMatchObject({ ok: false, field: "price" });
    expect(checkProduct(form({ price: "-5" }))).toMatchObject({ ok: false, field: "price" });
  });

  it("takes an optional unit cost and whole-number stock", () => {
    expect(checkProduct(form({ unitCost: "3.25", quantity: "1,200" }))).toMatchObject({ ok: true, value: { unitCostCents: 325, quantity: 1200 } });
    expect(checkProduct(form({ unitCost: "cheap" }))).toMatchObject({ ok: false, field: "unitCost" });
    expect(checkProduct(form({ quantity: "2.5" }))).toMatchObject({ ok: false, field: "quantity" });
    expect(checkProduct(form({ quantity: "-1" }))).toMatchObject({ ok: false, field: "quantity" });
    expect(checkProduct(form({ quantity: "0" }))).toMatchObject({ ok: true, value: { quantity: 0 } });
  });

  it("tidies spaces and control characters and trims long text", () => {
    const checked = checkProduct(form({ name: "  Rye\u0000  loaf\n", description: "x".repeat(400) }));
    expect(checked).toMatchObject({ ok: true, value: { name: "Rye loaf" } });
    if (checked.ok) expect(checked.value.description).toHaveLength(300);
  });

  it("keeps the photo the owner picked", () => {
    const photo = { source: "library" as const, fileId: "f1" };
    expect(checkProduct(form({ photo }))).toMatchObject({ ok: true, value: { photo } });
  });
});

describe("what's left from a sale", () => {
  it("is the price less what one costs, with its share of the price", () => {
    expect(marginOf(950, 325)).toEqual({ cents: 625, percent: 66 });
    expect(marginOf(500, 700)).toEqual({ cents: -200, percent: -40 });
    expect(marginOf(0, 100)).toEqual({ cents: -100, percent: null });
    expect(marginOf(950, null)).toBeNull();
  });
});

describe("editing a saved product", () => {
  it("shows the saved values as the owner would type them", () => {
    expect(formOf({ name: "Loaf", description: "", priceCents: 950, unitCostCents: 300, quantity: 4, photo: null })).toEqual({
      name: "Loaf",
      description: "",
      price: "9.50",
      unitCost: "3",
      quantity: "4",
      photo: null,
    });
    expect(formOf({ name: "Loaf", description: "", priceCents: 1200, unitCostCents: null, quantity: null, photo: null })).toMatchObject({ price: "12", unitCost: "", quantity: "" });
  });
});
