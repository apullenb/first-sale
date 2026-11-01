import { z } from "zod";
import { dollars } from "@/lib/website/site/design";
import { marginOf } from "./products";

// The business plan's money estimates: the owner enters the inputs, these rules do every sum

export const MONEY_LIMITS = { items: 12, lines: 12, label: 60, cents: 100_000_000, units: 1_000_000, months: 24 } as const;

const cents = z.number().int().min(0).max(MONEY_LIMITS.cents).nullable();
const label = z.string().trim().max(MONEY_LIMITS.label);
const line = z.object({ label, cents });

export const moneyInputsSchema = z.object({
  items: z.array(z.object({ name: label, priceCents: cents, unitCostCents: cents, unitsPerMonth: z.number().int().min(0).max(MONEY_LIMITS.units).nullable() })).max(MONEY_LIMITS.items),
  monthlyExpenses: z.array(line).max(MONEY_LIMITS.lines),
  startupCosts: z.array(line).max(MONEY_LIMITS.lines),
  cashOnHandCents: cents,
  reserveMonths: z.number().int().min(0).max(MONEY_LIMITS.months).nullable(),
  purpose: z.enum(["intro", "lender"]),
});
export type MoneyInputs = z.infer<typeof moneyInputsSchema>;
export type MoneyItem = MoneyInputs["items"][number];
export type MoneyLine = MoneyInputs["monthlyExpenses"][number];

export const EMPTY_MONEY: MoneyInputs = { items: [], monthlyExpenses: [], startupCosts: [], cashOnHandCents: null, reserveMonths: null, purpose: "intro" };

export const MONEY_PIECES = {
  margins: "unit costs and margins",
  expenses: "monthly operating expenses",
  sales: "expected monthly sales",
  breakEven: "break-even volume",
  cash: "cash needs",
} as const;
export type MoneyPiece = keyof typeof MONEY_PIECES;

export interface MoneyResult {
  margins: { name: string; priceCents: number; unitCostCents: number; marginCents: number; marginPercent: number }[];
  expenses: { lines: { label: string; cents: number }[]; totalCents: number } | null;
  sales: { units: number; revenueCents: number; costCents: number | null; grossCents: number | null } | null;
  // Gross profit less operating expenses, a month
  netCents: number | null;
  // units null: each sale loses money, so no volume covers the expenses
  breakEven: { units: number | null; revenueCents: number | null; basis: "mix" | "one" } | null;
  cash: { startupCents: number; reserveCents: number | null; neededCents: number; onHandCents: number | null; gapCents: number | null } | null;
  missing: MoneyPiece[];
  level: "intro" | "lender";
}

// Rows the owner left blank are dropped; an item needs a name
export function cleanMoney(input: MoneyInputs): MoneyInputs {
  const lines = (list: MoneyLine[]) => list.map((each) => ({ label: each.label.trim(), cents: each.cents })).filter((each) => each.cents !== null);
  return {
    items: input.items
      .map((item) => ({ ...item, name: item.name.trim() }))
      .filter((item) => item.name && (item.priceCents !== null || item.unitCostCents !== null || item.unitsPerMonth !== null)),
    monthlyExpenses: lines(input.monthlyExpenses),
    startupCosts: lines(input.startupCosts),
    cashOnHandCents: input.cashOnHandCents,
    reserveMonths: input.reserveMonths,
    purpose: input.purpose,
  };
}

export function planMoney(raw: MoneyInputs): MoneyResult {
  const input = cleanMoney(raw);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  const margins = input.items.flatMap((item) => {
    const margin = item.priceCents ? marginOf(item.priceCents, item.unitCostCents) : null;
    return margin ? [{ name: item.name, priceCents: item.priceCents!, unitCostCents: item.unitCostCents!, marginCents: margin.cents, marginPercent: margin.percent! }] : [];
  });

  const expenseLines = input.monthlyExpenses.map((each) => ({ label: each.label || "Other", cents: each.cents! }));
  const expenses = expenseLines.length ? { lines: expenseLines, totalCents: sum(expenseLines.map((each) => each.cents)) } : null;

  const sold = input.items.filter((item) => item.unitsPerMonth !== null && item.priceCents !== null);
  const units = sum(sold.map((item) => item.unitsPerMonth!));
  const costed = sold.every((item) => item.unitCostCents !== null);
  const revenueCents = sum(sold.map((item) => item.priceCents! * item.unitsPerMonth!));
  const costCents = costed ? sum(sold.map((item) => item.unitCostCents! * item.unitsPerMonth!)) : null;
  const sales = units > 0 ? { units, revenueCents, costCents, grossCents: costCents === null ? null : revenueCents - costCents } : null;
  const netCents = sales?.grossCents != null && expenses ? sales.grossCents - expenses.totalCents : null;

  let breakEven: MoneyResult["breakEven"] = null;
  if (expenses) {
    if (sales && sales.grossCents !== null) {
      // At the expected mix of sales: average margin and price per unit
      breakEven = sales.grossCents > 0 ? volume(expenses.totalCents, sales.grossCents / sales.units, sales.revenueCents / sales.units, "mix") : { units: null, revenueCents: null, basis: "mix" };
    } else if (margins.length === 1) {
      const [only] = margins;
      breakEven = only.marginCents > 0 ? volume(expenses.totalCents, only.marginCents, only.priceCents, "one") : { units: null, revenueCents: null, basis: "one" };
    }
  }

  let cash: MoneyResult["cash"] = null;
  if (input.startupCosts.length) {
    const startupCents = sum(input.startupCosts.map((each) => each.cents!));
    const reserveCents = input.reserveMonths !== null && expenses ? input.reserveMonths * expenses.totalCents : null;
    const neededCents = startupCents + (reserveCents ?? 0);
    cash = { startupCents, reserveCents, neededCents, onHandCents: input.cashOnHandCents, gapCents: input.cashOnHandCents === null ? null : input.cashOnHandCents - neededCents };
  }

  const missing = (Object.keys(MONEY_PIECES) as MoneyPiece[]).filter(
    (piece) =>
      ({
        margins: !margins.length,
        expenses: !expenses,
        sales: !sales,
        breakEven: !breakEven,
        cash: !cash || cash.reserveCents === null || cash.onHandCents === null,
      })[piece],
  );
  return { margins, expenses, sales, netCents, breakEven, cash, missing, level: input.purpose === "lender" && !missing.length ? "lender" : "intro" };
}

function volume(fixedCents: number, marginPerUnit: number, pricePerUnit: number, basis: "mix" | "one") {
  const units = Math.ceil(fixedCents / marginPerUnit);
  return { units, revenueCents: Math.round(units * pricePerUnit), basis };
}

// Key of the plan section these rules write
export const ESTIMATES_KEY = "estimates";

export const PLAN_LEVEL_LABELS = { intro: "Introductory draft", lender: "Prepared for a lender" } as const;

// Notice at the top of the plan's PDF
export function planLevelNotice(result: MoneyResult, purpose: MoneyInputs["purpose"]): string {
  if (result.level === "lender") return "Prepared for a lender: includes the owner’s financial estimates, calculated by SnapStart. Check every figure before you share it.";
  const why = purpose === "lender" ? ` Before it goes to a lender, add: ${result.missing.map((piece) => MONEY_PIECES[piece]).join(", ")}.` : "";
  return `Introductory draft: describes the business and its plans. Not yet prepared for a lender.${why}`;
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

// The plan's "Financial Estimates" section, written by code from the owner's inputs only
export function moneySection(raw: MoneyInputs): string {
  const result = planMoney(raw);
  const input = cleanMoney(raw);
  if (result.missing.length === Object.keys(MONEY_PIECES).length && !result.cash) {
    return `Not yet estimated: ${Object.values(MONEY_PIECES).join(", ")}. The owner has not entered these figures yet.`;
  }
  const parts: string[] = ["These are planning estimates entered by the owner, with the totals worked out by SnapStart. They are not a forecast or a financial statement."];

  if (result.margins.length) {
    parts.push(
      ["Unit costs and margins:", ...result.margins.map((each) => `${each.name}: sells for ${dollars(each.priceCents)} and costs ${dollars(each.unitCostCents)} to make or buy, leaving ${dollars(each.marginCents)} a unit (${each.marginPercent}% of the price).`)].join("\n"),
    );
  }
  if (result.expenses) {
    parts.push([`Monthly operating expenses: ${dollars(result.expenses.totalCents)} a month.`, ...result.expenses.lines.map((each) => `${each.label}: ${dollars(each.cents)}`)].join("\n"));
  }
  if (result.sales) {
    const lines = input.items.filter((item) => item.unitsPerMonth !== null && item.priceCents !== null).map((item) => `${item.name}: ${count(item.unitsPerMonth!, "unit", "units")} a month`);
    const gross = result.sales.grossCents !== null ? `, or ${dollars(result.sales.grossCents)} after the cost of what is sold` : "";
    parts.push([`Expected sales: ${count(result.sales.units, "unit", "units")} a month, bringing in ${dollars(result.sales.revenueCents)}${gross}.`, ...lines].join("\n"));
  }
  if (result.netCents !== null) {
    parts.push(result.netCents >= 0 ? `After operating expenses, that leaves ${dollars(result.netCents)} a month.` : `After operating expenses, that is a loss of ${dollars(-result.netCents)} a month.`);
  }
  if (result.breakEven) {
    const how = result.breakEven.basis === "mix" ? "at the expected mix of sales" : `selling ${result.margins[0].name}`;
    parts.push(
      result.breakEven.units === null
        ? `Break-even: at these prices and costs, ${result.breakEven.basis === "mix" ? "the expected sales do" : `each sale of ${result.margins[0].name} does`} not cover the cost of what is sold, so no sales volume covers the operating expenses.`
        : `Break-even: about ${count(result.breakEven.units, "unit", "units")} a month (${dollars(result.breakEven.revenueCents!)} in sales) covers the operating expenses, ${how}.`,
    );
  }
  if (result.cash) {
    const { startupCents, reserveCents, neededCents, onHandCents, gapCents } = result.cash;
    const reserve = reserveCents !== null ? ` plus ${count(input.reserveMonths!, "month", "months")} of operating expenses (${dollars(reserveCents)})` : "";
    const lines = [`Cash needs: ${dollars(startupCents)} in starting costs${reserve}, for ${dollars(neededCents)} in all.`, ...input.startupCosts.map((each) => `${each.label || "Other"}: ${dollars(each.cents!)}`)];
    if (onHandCents !== null && gapCents !== null) lines.push(gapCents >= 0 ? `Cash on hand: ${dollars(onHandCents)}, which covers this with ${dollars(gapCents)} to spare.` : `Cash on hand: ${dollars(onHandCents)}, which leaves ${dollars(-gapCents)} still to find.`);
    parts.push(lines.join("\n"));
  }

  const notYet = result.missing.filter((piece) => piece !== "cash" || !result.cash);
  const cashGaps = result.cash ? [result.cash.reserveCents === null ? "a cash reserve for operating expenses" : "", result.cash.onHandCents === null ? "cash on hand" : ""].filter(Boolean) : [];
  if (notYet.length) parts.push(`Not yet estimated: ${notYet.map((piece) => MONEY_PIECES[piece]).join(", ")}.`);
  if (cashGaps.length) parts.push(`Cash needs leave out ${cashGaps.join(" and ")}, which the owner has not entered.`);
  return parts.join("\n\n");
}
