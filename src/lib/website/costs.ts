import type { PlatformInfo, PlatformPlan } from "./platforms";
import type { TermId } from "./terms";

// Plain arithmetic over each package's published prices. Every package is priced for the same need: the owner's own
// web address and a way to take card payments.

export type CostAmount =
  | { kind: "monthly"; usd: number; billing: "monthly" | "yearly" }
  // Paid once in the first year; per "year" only when the vendor says so
  | { kind: "once"; usd: number; from: boolean; per: "year" | null }
  | { kind: "free_first_year"; later: string | null }
  | { kind: "per_sale"; text: string }
  | { kind: "unknown"; text: string };

export interface CostLine {
  // The term it belongs to; null for the plan itself
  term: TermId | null;
  label: string;
  amount: CostAmount;
  // In the totals, or left out with the reason why
  counted: boolean;
  whyNot: string | null;
}

export interface CostSummary {
  plan: PlatformPlan;
  base: CostLine;
  // Month-to-month billing, shown beside a yearly plan but not totaled
  monthToMonth: CostLine | null;
  extras: CostLine[];
  monthlyUsd: number;
  // What a yearly plan charges up front; null for plans paid each month
  upFrontUsd: number | null;
  firstYearUsd: number;
  // A counted price is a "from" price
  from: boolean;
}

const NOT_CHECKED = "price not checked here";

export function feeText(fee: { percent: number; fixedCents: number }): string {
  // percent is a fraction, such as 0.029
  return `${Math.round(fee.percent * 10_000) / 100}% + ${fee.fixedCents}¢`;
}

// The cheapest plan with the owner's own web address and card payments; every total uses it
export function comparePlan(platform: PlatformInfo): PlatformPlan {
  const fits = platform.plans.filter((plan) => plan.ownAddress && plan.takesPayments);
  const pool = fits.length ? fits : platform.plans;
  return pool.reduce((best, plan) => (plan.monthlyUsd < best.monthlyUsd ? plan : best));
}

// The cheapest plan of all doesn't give the owner's own address, so the comparison needs a higher one
export function needsUpgrade(platform: PlatformInfo): boolean {
  const cheapest = platform.plans.reduce((best, plan) => (plan.monthlyUsd < best.monthlyUsd ? plan : best));
  return !cheapest.ownAddress || !cheapest.takesPayments;
}

function domainLine(platform: PlatformInfo, plan: PlatformPlan): CostLine {
  const { domain, name } = platform;
  if (domain.firstYearFreeWithYearly && plan.billing === "yearly") {
    return { term: "domain", label: "Web address, free with yearly billing", amount: { kind: "free_first_year", later: domain.later }, counted: true, whyNot: null };
  }
  if (domain.sold === "here" && domain.firstUsd !== null) {
    const amount: CostAmount = { kind: "once", usd: domain.firstUsd, from: domain.from, per: domain.per };
    return domain.per
      ? { term: "domain", label: `Web address from ${name}`, amount, counted: true, whyNot: null }
      : { term: "domain", label: `Web address from ${name}`, amount, counted: false, whyNot: `${name}’s page doesn’t say how long it covers` };
  }
  const label = domain.sold === "here" ? `Web address from ${name}` : "Web address, from a company that sells them";
  return { term: "domain", label, amount: { kind: "unknown", text: "Price not checked" }, counted: false, whyNot: NOT_CHECKED };
}

function emailLine(platform: PlatformInfo): CostLine {
  const { email } = platform;
  const label =
    email.kind === "addon"
      ? `Business email through ${email.via}`
      : email.kind === "forwarding"
        ? `Business email inbox from ${email.via} (forwarding is free)`
        : `Business email, from ${email.via}`;
  return email.monthlyUsd === null
    ? { term: "email", label, amount: { kind: "unknown", text: "Price not checked" }, counted: false, whyNot: NOT_CHECKED }
    : { term: "email", label, amount: { kind: "monthly", usd: email.monthlyUsd, billing: "monthly" }, counted: true, whyNot: null };
}

function cardLine(platform: PlatformInfo, plan: PlatformPlan): CostLine {
  const label = platform.checkout === "built_in" ? `Card fees on ${plan.name}` : "Card fees, through your payment provider";
  return plan.cardFee
    ? { term: "checkout", label, amount: { kind: "per_sale", text: `${feeText(plan.cardFee)} per card sale` }, counted: false, whyNot: "it depends on your sales" }
    : { term: "checkout", label, amount: { kind: "unknown", text: "Rate not checked" }, counted: false, whyNot: NOT_CHECKED };
}

export function costSummary(platform: PlatformInfo): CostSummary {
  const plan = comparePlan(platform);
  const base: CostLine = { term: null, label: `${plan.name} plan`, amount: { kind: "monthly", usd: plan.monthlyUsd, billing: plan.billing }, counted: true, whyNot: null };
  const monthToMonth: CostLine | null =
    plan.billing === "yearly" && plan.monthToMonthUsd !== null
      ? {
          term: null,
          label: "Or pay month to month",
          amount: { kind: "monthly", usd: plan.monthToMonthUsd, billing: "monthly" },
          counted: false,
          whyNot: "the total uses yearly billing",
        }
      : null;
  const extras = [domainLine(platform, plan), emailLine(platform), cardLine(platform, plan)];
  let monthlyUsd = 0;
  let onceUsd = 0;
  let from = false;
  for (const line of [base, ...extras]) {
    if (!line.counted) continue;
    if (line.amount.kind === "monthly") monthlyUsd += line.amount.usd;
    if (line.amount.kind === "once") {
      onceUsd += line.amount.usd;
      from ||= line.amount.from;
    }
  }
  return {
    plan,
    base,
    monthToMonth,
    extras,
    monthlyUsd: cents(monthlyUsd),
    upFrontUsd: plan.billing === "yearly" ? cents(plan.monthlyUsd * 12) : null,
    firstYearUsd: cents(monthlyUsd * 12 + onceUsd),
    from,
  };
}

const cents = (usdAmount: number) => Math.round(usdAmount * 100) / 100;
export const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export function usd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: amount % 1 ? 2 : 0 });
}

// "Your first year" for a package, written by code from its cost summary
export function firstYearText(platform: PlatformInfo): string {
  const costs = costSummary(platform);
  const paid =
    costs.upFrontUsd !== null ? `${usd(costs.plan.monthlyUsd)} a month, billed yearly (${usd(costs.upFrontUsd)} up front)` : `${usd(costs.plan.monthlyUsd)} a month`;
  const left = [costs.base, ...costs.extras].filter((line) => !line.counted).map((line) => `${lower(line.label)} (${line.whyNot})`);
  return `${costs.from ? "From " : ""}${usd(costs.firstYearUsd)} for the first year on ${costs.plan.name}, paid ${paid}${platform.demoPrice ? " (demo price)" : ""}. Not counted: ${left.join("; ")}.`;
}
