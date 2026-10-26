import { describe, expect, it } from "vitest";
import { estimateHire, grossMarginOf } from "./hiring";

describe("estimateHire", () => {
  it("turns weekly hours into monthly cost and sales needed", () => {
    expect(estimateHire({ hoursPerWeek: 15, hourlyCostCents: 1800, grossMargin: 0.4 })).toEqual({
      monthlyCostCents: 117_000,
      salesNeededCents: 292_500,
    });
  });

  it("rounds to whole cents", () => {
    const estimate = estimateHire({ hoursPerWeek: 7, hourlyCostCents: 1733, grossMargin: 0.37 });
    expect(Number.isInteger(estimate.monthlyCostCents)).toBe(true);
    expect(Number.isInteger(estimate.salesNeededCents)).toBe(true);
  });

  it("rounds exact half-cents up", () => {
    // 7.5 h × $10.01 × 52 / 12 = 32,532.5¢
    expect(estimateHire({ hoursPerWeek: 7.5, hourlyCostCents: 1001, grossMargin: 1 }).monthlyCostCents).toBe(32_533);
  });

  it.each([
    { hoursPerWeek: 0, hourlyCostCents: 1800, grossMargin: 0.4 },
    { hoursPerWeek: 169, hourlyCostCents: 1800, grossMargin: 0.4 },
    { hoursPerWeek: Number.POSITIVE_INFINITY, hourlyCostCents: 1800, grossMargin: 0.4 },
    { hoursPerWeek: 10, hourlyCostCents: 0, grossMargin: 0.4 },
    { hoursPerWeek: 10, hourlyCostCents: 1800.5, grossMargin: 0.4 },
    { hoursPerWeek: 10, hourlyCostCents: 1800, grossMargin: 0 },
    { hoursPerWeek: 10, hourlyCostCents: 1800, grossMargin: 1.5 },
    { hoursPerWeek: Number.NaN, hourlyCostCents: 1800, grossMargin: 0.4 },
  ])("rejects %o", (input) => {
    expect(() => estimateHire(input)).toThrow(RangeError);
  });
});

describe("grossMarginOf", () => {
  it("is the share of price left after unit cost", () => {
    expect(grossMarginOf(2000, 1200)).toBeCloseTo(0.4);
  });

  it("can be negative when selling below cost", () => {
    expect(grossMarginOf(1000, 1500)).toBeCloseTo(-0.5);
  });
});
