const HOURS_PER_WEEK_MAX = 168;

export interface HireInput {
  hoursPerWeek: number;
  hourlyCostCents: number;
  // Share of each sale left after product costs, 0–1
  grossMargin: number;
}

export interface HireEstimate {
  monthlyCostCents: number;
  salesNeededCents: number;
}

// Added monthly cost of a hire, and the extra sales needed to cover it.
export function estimateHire({ hoursPerWeek, hourlyCostCents, grossMargin }: HireInput): HireEstimate {
  if (!(hoursPerWeek > 0 && hoursPerWeek <= HOURS_PER_WEEK_MAX)) {
    throw new RangeError(`hoursPerWeek must be more than 0 and at most ${HOURS_PER_WEEK_MAX}`);
  }
  if (!(Number.isInteger(hourlyCostCents) && hourlyCostCents > 0)) {
    throw new RangeError("hourlyCostCents must be a whole number greater than 0");
  }
  if (!(grossMargin > 0 && grossMargin <= 1)) {
    throw new RangeError("grossMargin must be greater than 0 and at most 1");
  }

  // 52 weeks over 12 months; multiply first so exact half-cents round up
  const monthlyCost = (hoursPerWeek * hourlyCostCents * 52) / 12;
  return {
    monthlyCostCents: Math.round(monthlyCost),
    salesNeededCents: Math.round(monthlyCost / grossMargin),
  };
}

export function grossMarginOf(priceCents: number, unitCostCents: number): number {
  if (!(priceCents > 0)) throw new RangeError("priceCents must be greater than 0");
  if (unitCostCents < 0) throw new RangeError("unitCostCents cannot be negative");
  return (priceCents - unitCostCents) / priceCents;
}
