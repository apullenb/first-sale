import { describe, expect, it } from "vitest";
import {
  checkGroups,
  checkProduct,
  combinations,
  formOf,
  marginOf,
  NO_OPTIONS,
  optionsSummary,
  priceLabel,
  priceRange,
  type ProductForm,
  type ProductValues,
  readOptions,
  stockOf,
  variantRows,
} from "./products";

const form = (overrides: Partial<ProductForm> = {}): ProductForm => ({
  kind: "product",
  name: "Sourdough loaf",
  description: "Naturally leavened",
  price: "9.50",
  unitCost: "",
  quantity: "",
  duration: "",
  location: "",
  included: "",
  groups: [],
  variants: [],
  photo: null,
  ...overrides,
});

const values = (overrides: Partial<ProductValues> = {}): ProductValues => ({
  kind: "product",
  status: "confirmed",
  origin: "owner",
  name: "Loaf",
  description: "",
  descriptionBy: "owner",
  priceCents: 950,
  priceText: "",
  unitCostCents: null,
  quantity: null,
  duration: "",
  location: "",
  included: "",
  options: NO_OPTIONS,
  photo: null,
  ...overrides,
});

describe("checking a product", () => {
  it("keeps the price exactly as typed, in cents", () => {
    expect(checkProduct(form(), true)).toMatchObject({
      ok: true,
      value: { name: "Sourdough loaf", description: "Naturally leavened", priceCents: 950, unitCostCents: null, quantity: null, photo: null, options: NO_OPTIONS },
    });
    expect(checkProduct(form({ price: "$1,200" }), true)).toMatchObject({ ok: true, value: { priceCents: 120_000 } });
    expect(checkProduct(form({ price: "0" }), true)).toMatchObject({ ok: true, value: { priceCents: 0 } });
  });

  it("needs a name and a plain dollar price to confirm", () => {
    expect(checkProduct(form({ name: "  " }), true)).toMatchObject({ ok: false, field: "name" });
    expect(checkProduct(form({ price: "" }), true)).toMatchObject({ ok: false, field: "price" });
    expect(checkProduct(form({ price: "about 10" }), true)).toMatchObject({ ok: false, field: "price" });
    expect(checkProduct(form({ price: "9.999" }), true)).toMatchObject({ ok: false, field: "price" });
    expect(checkProduct(form({ price: "-5" }), true)).toMatchObject({ ok: false, field: "price" });
  });

  it("lets a suggestion wait for its price", () => {
    expect(checkProduct(form({ price: "" }), false)).toMatchObject({ ok: true, value: { priceCents: null } });
    expect(checkProduct(form({ price: "lots" }), false)).toMatchObject({ ok: false, field: "price" });
  });

  it("takes an optional unit cost and whole-number stock", () => {
    expect(checkProduct(form({ unitCost: "3.25", quantity: "1,200" }), true)).toMatchObject({ ok: true, value: { unitCostCents: 325, quantity: 1200 } });
    expect(checkProduct(form({ unitCost: "cheap" }), true)).toMatchObject({ ok: false, field: "unitCost" });
    expect(checkProduct(form({ quantity: "2.5" }), true)).toMatchObject({ ok: false, field: "quantity" });
    expect(checkProduct(form({ quantity: "-1" }), true)).toMatchObject({ ok: false, field: "quantity" });
    expect(checkProduct(form({ quantity: "0" }), true)).toMatchObject({ ok: true, value: { quantity: 0 } });
  });

  it("tidies spaces and control characters and trims long text", () => {
    const checked = checkProduct(form({ name: "  Rye\u0000  loaf\n", description: "x".repeat(400) }), true);
    expect(checked).toMatchObject({ ok: true, value: { name: "Rye loaf" } });
    if (checked.ok) expect(checked.value.description).toHaveLength(300);
  });

  it("keeps the photo the owner picked", () => {
    const photo = { source: "library" as const, fileId: "f1" };
    expect(checkProduct(form({ photo }), true)).toMatchObject({ ok: true, value: { photo } });
  });
});

describe("checking a service", () => {
  const service = (overrides: Partial<ProductForm> = {}) => form({ kind: "service", name: "Full groom", price: "$65 a visit", duration: " 2 hours ", location: "At your home", included: "Bath, trim and nails", unitCost: "5", quantity: "3", ...overrides });

  it("keeps the price in the owner's words, and a plain amount in cents too", () => {
    expect(checkProduct(service(), true)).toMatchObject({ ok: true, value: { priceText: "$65 a visit", priceCents: null, duration: "2 hours", location: "At your home", included: "Bath, trim and nails" } });
    expect(checkProduct(service({ price: "65" }), true)).toMatchObject({ ok: true, value: { priceText: "65", priceCents: 6500 } });
  });

  it("needs no price, and never keeps stock or a unit cost", () => {
    expect(checkProduct(service({ price: "" }), true)).toMatchObject({ ok: true, value: { priceText: "", priceCents: null, quantity: null, unitCostCents: null } });
  });
});

describe("options", () => {
  const sizes = { name: "Size", values: ["Small", "Large"] };
  const scents = { name: "Scent", values: ["Cedar", "Lavender"] };

  it("tidies groups: blank and repeated choices go, and names are needed", () => {
    expect(checkGroups([{ name: " Size ", values: ["Small", " small", "", "Large"] }])).toEqual({ ok: true, groups: [sizes] });
    expect(checkGroups([{ name: "", values: [] }])).toEqual({ ok: true, groups: [] });
    expect(checkGroups([{ name: "", values: ["Red"] }])).toMatchObject({ ok: false });
    expect(checkGroups([{ name: "Color", values: [] }])).toMatchObject({ ok: false });
    expect(checkGroups([sizes, { name: "size", values: ["XL"] }])).toMatchObject({ ok: false });
    expect(checkGroups([sizes, scents, { name: "Wick", values: ["One"] }, { name: "Tin", values: ["Gold"] }])).toMatchObject({ ok: false });
    expect(checkGroups([{ name: "A", values: Array.from({ length: 11 }, (_, i) => `a${i}`) }, { name: "B", values: Array.from({ length: 10 }, (_, i) => `b${i}`) }])).toMatchObject({ ok: false });
  });

  it("makes every combination, in group order", () => {
    expect(combinations([sizes, scents])).toEqual([
      ["Small", "Cedar"],
      ["Small", "Lavender"],
      ["Large", "Cedar"],
      ["Large", "Lavender"],
    ]);
    expect(combinations([])).toEqual([]);
  });

  it("keeps what was typed for combinations that still exist", () => {
    const blank = (each: string[]) => ({ values: each, price: "", quantity: "" });
    const rows = variantRows([sizes], [{ values: ["small"], price: "10", quantity: "3" }, { values: ["Medium"], price: "12", quantity: "" }], blank);
    expect(rows).toEqual([
      { values: ["Small"], price: "10", quantity: "3" },
      { values: ["Large"], price: "", quantity: "" },
    ]);
  });

  it("prices and counts each combination as typed; stock is their total", () => {
    const checked = checkProduct(
      form({
        price: "",
        quantity: "99",
        groups: [sizes],
        variants: [
          { values: ["Small"], price: "18", quantity: "4" },
          { values: ["Large"], price: "24.50", quantity: "6" },
        ],
      }),
      true,
    );
    expect(checked).toMatchObject({
      ok: true,
      value: {
        priceCents: null,
        quantity: 10,
        options: {
          groups: [sizes],
          variants: [
            { values: ["Small"], priceCents: 1800, quantity: 4 },
            { values: ["Large"], priceCents: 2450, quantity: 6 },
          ],
        },
      },
    });
  });

  it("needs a main price when some combination has none", () => {
    const variants = [
      { values: ["Small"], price: "18", quantity: "" },
      { values: ["Large"], price: "", quantity: "" },
    ];
    expect(checkProduct(form({ price: "", groups: [sizes], variants }), true)).toMatchObject({ ok: false, field: "price" });
    expect(checkProduct(form({ price: "20", groups: [sizes], variants }), true)).toMatchObject({ ok: true });
  });

  it("refuses prices and stock that aren't plain numbers", () => {
    expect(checkProduct(form({ groups: [sizes], variants: [{ values: ["Small"], price: "cheap", quantity: "" }] }), true)).toMatchObject({ ok: false, field: "variants" });
    expect(checkProduct(form({ groups: [sizes], variants: [{ values: ["Small"], price: "", quantity: "a few" }] }), true)).toMatchObject({ ok: false, field: "variants" });
  });

  it("services have options with prices but never stock", () => {
    const checked = checkProduct(form({ kind: "service", price: "", groups: [{ name: "Package", values: ["Basic", "Full"] }], variants: [{ values: ["Basic"], price: "40", quantity: "5" }] }), true);
    expect(checked).toMatchObject({ ok: true, value: { quantity: null, options: { variants: [{ priceCents: 4000, quantity: null }, { priceCents: null, quantity: null }] } } });
  });
});

describe("stock and price from options", () => {
  const options = (variants: { priceCents: number | null; quantity: number | null }[]) => ({
    groups: [{ name: "Size", values: variants.map((_, i) => `s${i}`) }],
    variants: variants.map((variant, i) => ({ values: [`s${i}`], ...variant })),
  });

  it("adds up counted options, else keeps the item's own count", () => {
    expect(stockOf(7, NO_OPTIONS)).toBe(7);
    expect(stockOf(7, options([{ priceCents: null, quantity: null }]))).toBe(7);
    expect(stockOf(7, options([{ priceCents: null, quantity: 2 }, { priceCents: null, quantity: null }, { priceCents: null, quantity: 5 }]))).toBe(7);
    expect(stockOf(null, options([{ priceCents: null, quantity: 0 }]))).toBe(0);
  });

  it("ranges from the lowest to the highest price, using the item's price for unpriced options", () => {
    expect(priceRange({ priceCents: 1000, options: NO_OPTIONS })).toEqual({ minCents: 1000, maxCents: 1000 });
    expect(priceRange({ priceCents: 1000, options: options([{ priceCents: 800, quantity: null }, { priceCents: null, quantity: null }, { priceCents: 1500, quantity: null }]) })).toEqual({ minCents: 800, maxCents: 1500 });
    expect(priceRange({ priceCents: null, options: NO_OPTIONS })).toBeNull();
  });

  it("labels the price as customers see it", () => {
    expect(priceLabel(values())).toBe("$9.50");
    expect(priceLabel(values({ priceCents: 1000, options: options([{ priceCents: 1800, quantity: null }, { priceCents: null, quantity: null }]) }))).toBe("$10–$18");
    expect(priceLabel(values({ priceCents: null }))).toBe("");
    expect(priceLabel(values({ kind: "service", priceCents: null, priceText: "From $75" }))).toBe("From $75");
    expect(priceLabel(values({ kind: "service", priceCents: null, priceText: "From $75", options: options([{ priceCents: 4000, quantity: null }, { priceCents: 9000, quantity: null }]) }))).toBe("$40–$90");
  });

  it("sums up the options in words", () => {
    expect(optionsSummary({ groups: [{ name: "Size", values: ["S", "L"] }, { name: "Scent", values: ["Cedar"] }], variants: [] })).toBe("Size: S, L · Scent: Cedar");
  });

  it("reads saved options safely", () => {
    expect(readOptions(null)).toEqual(NO_OPTIONS);
    expect(readOptions({ groups: "nope" })).toEqual(NO_OPTIONS);
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

describe("editing a saved item", () => {
  it("shows the saved values as the owner would type them", () => {
    expect(formOf(values({ priceCents: 950, unitCostCents: 300, quantity: 4 }))).toMatchObject({ name: "Loaf", price: "9.50", unitCost: "3", quantity: "4", groups: [], variants: [] });
    expect(formOf(values({ priceCents: 1200 }))).toMatchObject({ price: "12", unitCost: "", quantity: "" });
    expect(formOf(values({ kind: "service", priceCents: null, priceText: "$40 an hour" }))).toMatchObject({ price: "$40 an hour" });
  });

  it("leaves the total out when options are counted", () => {
    const options = { groups: [{ name: "Size", values: ["S"] }], variants: [{ values: ["S"], priceCents: 1500, quantity: 3 }] };
    expect(formOf(values({ quantity: 3, options }))).toMatchObject({ quantity: "", variants: [{ values: ["S"], price: "15", quantity: "3" }] });
  });
});
