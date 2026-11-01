import { describe, expect, it } from "vitest";
import { EMPTY_MONEY, type MoneyInputs, moneyInputsSchema, moneySection, planLevelNotice, planMoney } from "./plan-money";

// Maple Crumb Test Bakery: a home bakery in Denton with under $1,000 to start
const bakery: MoneyInputs = {
  items: [
    { name: "Sourdough loaf", priceCents: 1000, unitCostCents: 350, unitsPerMonth: 60 },
    { name: "Dozen cookies", priceCents: 1800, unitCostCents: 600, unitsPerMonth: 20 },
  ],
  monthlyExpenses: [
    { label: "Market booth", cents: 16000 },
    { label: "Packaging and labels", cents: 4000 },
  ],
  startupCosts: [
    { label: "Mixer and pans", cents: 45000 },
    { label: "Food handler card", cents: 1000 },
  ],
  cashOnHandCents: 90000,
  reserveMonths: 2,
  purpose: "lender",
};

describe("planMoney", () => {
  it("works out each item's margin", () => {
    expect(planMoney(bakery).margins).toEqual([
      { name: "Sourdough loaf", priceCents: 1000, unitCostCents: 350, marginCents: 650, marginPercent: 65 },
      { name: "Dozen cookies", priceCents: 1800, unitCostCents: 600, marginCents: 1200, marginPercent: 67 },
    ]);
  });

  it("adds up a month of sales, expenses and what's left", () => {
    const result = planMoney(bakery);
    expect(result.expenses?.totalCents).toBe(20000);
    // 60 x $10 + 20 x $18; costs 60 x $3.50 + 20 x $6
    expect(result.sales).toEqual({ units: 80, revenueCents: 96000, costCents: 33000, grossCents: 63000 });
    expect(result.netCents).toBe(43000);
  });

  it("finds break-even at the expected mix, rounding units up", () => {
    // $630 gross over 80 units is $7.875 a unit; $200 / 7.875 = 25.4
    expect(planMoney(bakery).breakEven).toEqual({ units: 26, revenueCents: 31200, basis: "mix" });
  });

  it("uses a single item's margin when there's no sales mix", () => {
    const one = { ...bakery, items: [{ name: "Sourdough loaf", priceCents: 1000, unitCostCents: 350, unitsPerMonth: null }] };
    expect(planMoney(one).breakEven).toEqual({ units: 31, revenueCents: 31000, basis: "one" });
    expect(planMoney(one).sales).toBeNull();
  });

  it("says no volume breaks even when each sale loses money", () => {
    const loss = { ...bakery, items: [{ name: "Pie", priceCents: 500, unitCostCents: 700, unitsPerMonth: 10 }] };
    expect(planMoney(loss).breakEven).toEqual({ units: null, revenueCents: null, basis: "mix" });
    expect(moneySection(loss)).toContain("no sales volume covers the operating expenses");
  });

  it("adds a reserve of operating expenses to starting costs and compares cash on hand", () => {
    // $460 to start + 2 x $200 = $860 against $900
    expect(planMoney(bakery).cash).toEqual({ startupCents: 46000, reserveCents: 40000, neededCents: 86000, onHandCents: 90000, gapCents: 4000 });
    expect(planMoney({ ...bakery, cashOnHandCents: 50000 }).cash?.gapCents).toBe(-36000);
  });

  it("labels the plan for a lender only when asked and every estimate is in", () => {
    expect(planMoney(bakery)).toMatchObject({ missing: [], level: "lender" });
    expect(planMoney({ ...bakery, purpose: "intro" }).level).toBe("intro");
    const partial = planMoney({ ...bakery, cashOnHandCents: null });
    expect(partial).toMatchObject({ missing: ["cash"], level: "intro" });
    expect(planLevelNotice(partial, "lender")).toBe("Introductory draft: describes the business and its plans. Not yet prepared for a lender. Before it goes to a lender, add: cash needs.");
  });

  it("leaves out blank rows and sales without a cost", () => {
    const result = planMoney({
      ...EMPTY_MONEY,
      items: [
        { name: "  ", priceCents: 500, unitCostCents: 100, unitsPerMonth: 5 },
        { name: "Muffin", priceCents: 300, unitCostCents: null, unitsPerMonth: 10 },
      ],
      monthlyExpenses: [{ label: "Booth", cents: null }],
    });
    expect(result.margins).toEqual([]);
    expect(result.expenses).toBeNull();
    expect(result.sales).toEqual({ units: 10, revenueCents: 3000, costCents: null, grossCents: null });
    expect(result.missing).toEqual(["margins", "expenses", "breakEven", "cash"]);
  });

  it("rejects negative or fractional amounts", () => {
    expect(moneyInputsSchema.safeParse({ ...EMPTY_MONEY, cashOnHandCents: -1 }).success).toBe(false);
    expect(moneyInputsSchema.safeParse({ ...EMPTY_MONEY, reserveMonths: 1.5 }).success).toBe(false);
    expect(moneyInputsSchema.safeParse(bakery).success).toBe(true);
  });
});

describe("moneySection", () => {
  it("says the estimates aren't made yet when the owner skips them, with no numbers", () => {
    const text = moneySection(EMPTY_MONEY);
    expect(text).toBe("Not yet estimated: unit costs and margins, monthly operating expenses, expected monthly sales, break-even volume, cash needs. The owner has not entered these figures yet.");
    expect(text).not.toMatch(/\d/);
  });

  it("writes every figure from the rules", () => {
    const text = moneySection(bakery);
    for (const expected of [
      "Sourdough loaf: sells for $10 and costs $3.50 to make or buy, leaving $6.50 a unit (65% of the price).",
      "Monthly operating expenses: $200 a month.",
      "Market booth: $160",
      "Expected sales: 80 units a month, bringing in $960, or $630 after the cost of what is sold.",
      "After operating expenses, that leaves $430 a month.",
      "Break-even: about 26 units a month ($312 in sales) covers the operating expenses, at the expected mix of sales.",
      "Cash needs: $460 in starting costs plus 2 months of operating expenses ($400), for $860 in all.",
      "Cash on hand: $900, which covers this with $40 to spare.",
    ])
      expect(text).toContain(expected);
    expect(text).not.toContain("Not yet estimated");
  });

  it("names what's still missing", () => {
    const text = moneySection({ ...bakery, monthlyExpenses: [], reserveMonths: 3, cashOnHandCents: null });
    expect(text).toContain("Not yet estimated: monthly operating expenses, break-even volume.");
    expect(text).toContain("Cash needs leave out a cash reserve for operating expenses and cash on hand, which the owner has not entered.");
  });
});
