import { describe, expect, it } from "vitest";
import { checkDraft, customLineFrom, type DraftLine, draftOf, importedDraft, itemsSummary, linesTotals, splitQuantity } from "./order-lines";

const candle = {
  id: "candle",
  name: "Candle",
  priceCents: 2400,
  options: {
    groups: [{ name: "Size", values: ["8 oz", "12 oz"] }],
    variants: [
      { values: ["8 oz"], priceCents: null, quantity: 5 },
      { values: ["12 oz"], priceCents: 3200, quantity: 2 },
    ],
  },
};
const tin = { id: "tin", name: "Tin", priceCents: 1200, options: { groups: [], variants: [] } };
const groom = { id: "groom", name: "Full groom", priceCents: null, options: { groups: [], variants: [] } };
const items = [candle, tin, groom];

const item = (productId: string, quantity: string, values: string[] = []): DraftLine => ({ key: `${productId}-${quantity}-${values.join()}`, kind: "item", productId, values, quantity });
const custom = (description: string, quantity: string, price = ""): DraftLine => ({ key: `c-${description}`, kind: "custom", description, quantity, price });

describe("order line math", () => {
  it("prices saved items from their option, else the item, and custom lines from the owner", () => {
    const checked = checkDraft([item("candle", "2", ["12 oz"]), item("candle", "1", ["8 oz"]), item("tin", "3"), custom("Gift wrap", "2", "4.50")], items);
    expect(checked.error).toBeNull();
    expect(checked.rows.map((row) => [row.unitPriceCents, row.totalCents])).toEqual([
      [3200, 6400],
      [2400, 2400],
      [1200, 3600],
      [450, 900],
    ]);
    expect(checked.subtotalCents).toBe(13_300);
    expect(checked.totalCents).toBe(13_300);
    expect(checked.lines).toEqual([
      { kind: "item", productId: "candle", values: ["12 oz"], quantity: 2 },
      { kind: "item", productId: "candle", values: ["8 oz"], quantity: 1 },
      { kind: "item", productId: "tin", values: [], quantity: 3 },
      { kind: "custom", description: "Gift wrap", quantity: 2, unitPriceCents: 450 },
    ]);
  });

  it("shows no total while any line has no price, but still adds up the priced ones", () => {
    const checked = checkDraft([item("tin", "2"), custom("Delivery", "1"), item("groom", "1")], items);
    expect(checked.error).toBeNull();
    expect(checked.subtotalCents).toBe(2400);
    expect(checked.unpriced).toBe(2);
    expect(checked.totalCents).toBeNull();
    expect(checked.lines[1]).toEqual({ kind: "custom", description: "Delivery", quantity: 1, unitPriceCents: null });
  });

  it("names the first problem: no lines, a missing option, a bad count or price, a blank description", () => {
    expect(checkDraft([], items).error).toBe("Add at least one item or custom line.");
    expect(checkDraft([item("candle", "1")], items).error).toBe("Choose an option.");
    expect(checkDraft([item("tin", "1.5")], items).error).toBe("Type how many as a whole number.");
    expect(checkDraft([item("tin", "0")], items).error).toBe("Type how many as a whole number.");
    expect(checkDraft([custom("Wrap", "1", "abc")], items).error).toBe("Type the price as dollars and cents, or leave it empty.");
    expect(checkDraft([custom(" ", "1")], items).error).toBe("Describe this line.");
    expect(checkDraft([item("gone", "1")], items).error).toBe("That item isn’t in your products any more.");
    expect(checkDraft([custom("Big", "1000000", "1000000")], items).error).toBe("That line is over $1,000,000. Split it up.");
  });

  it("totals only fully priced lines", () => {
    expect(linesTotals([])).toEqual({ subtotalCents: 0, unpriced: 0, totalCents: null });
    expect(linesTotals([{ quantity: 2, unitPriceCents: 500 }, { quantity: 1, unitPriceCents: 0 }])).toEqual({ subtotalCents: 1000, unpriced: 0, totalCents: 1000 });
  });
});

describe("lines from wording", () => {
  it("keeps the whole count and the rest of the wording", () => {
    expect(splitQuantity("2 dozen")).toEqual({ quantity: 2, rest: "dozen" });
    expect(splitQuantity("150")).toEqual({ quantity: 150, rest: "" });
    expect(splitQuantity("Question")).toBeNull();
    expect(splitQuantity("0")).toBeNull();
    expect(customLineFrom("Chocolate chip cookies", "2 dozen")).toEqual({ kind: "custom", description: "Chocolate chip cookies (dozen)", quantity: 2, unitPriceCents: null });
    expect(customLineFrom("Custom birthday cake", "1 (serves about 20)")?.description).toBe("Custom birthday cake (serves about 20)");
    expect(customLineFrom("Sunday hours", "Question")).toBeNull();
  });

  it("matches imported items to saved ones only by exact name without options", () => {
    expect(importedDraft([{ name: "tin", quantity: 2 }, { name: "Candle", quantity: 1 }, { name: "Cake", quantity: 1 }], items)).toEqual([
      { key: "imported-0", kind: "item", productId: "tin", values: [], quantity: "2" },
      { key: "imported-1", kind: "custom", description: "Candle", quantity: "1", price: "" },
      { key: "imported-2", kind: "custom", description: "Cake", quantity: "1", price: "" },
    ]);
  });

  it("turns saved lines back into form rows", () => {
    expect(
      draftOf([
        { productId: "candle", name: "Candle", values: ["8 oz"], quantity: 2, unitPriceCents: 2400 },
        { productId: null, name: "Wrap", values: [], quantity: 1, unitPriceCents: 450 },
      ]),
    ).toEqual([
      { key: "saved-0", kind: "item", productId: "candle", values: ["8 oz"], quantity: "2" },
      { key: "saved-1", kind: "custom", description: "Wrap", quantity: "1", price: "4.50" },
    ]);
  });

  it("summarizes the first line and how many more", () => {
    expect(itemsSummary([], "Groom Bailey")).toBe("Groom Bailey");
    expect(itemsSummary([{ name: "Chocolate chip cookies (dozen)", values: [], quantity: 2 }], "")).toBe("2 × Chocolate chip cookies (dozen)");
    expect(
      itemsSummary(
        [
          { name: "Candle", values: ["12 oz"], quantity: 1 },
          { name: "Tin", values: [], quantity: 2 },
        ],
        "",
      ),
    ).toBe("1 × Candle (12 oz) +1 more");
  });
});
