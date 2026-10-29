import type { PlatformInfo } from "./platforms";
import type { TermId } from "./terms";

// Plain arithmetic over each package's published prices: the base plan, each extra as a line, then the totals

export type CostAmount =
  | { kind: "monthly"; usd: number }
  // Paid once in the first year; per "year" when the vendor says so
  | { kind: "once"; usd: number; from: boolean; per: "year" | null }
  | { kind: "free_first_year"; later: string | null }
  | { kind: "per_sale"; text: string }
  | { kind: "unknown"; text: string };

export interface CostLine {
  // The term it belongs to; null for the base plan
  term: TermId | null;
  label: string;
  amount: CostAmount;
}

export interface CostSummary {
  base: CostLine;
  extras: CostLine[];
  monthlyUsd: number;
  firstYearUsd: number;
  // A counted price is a "from" price
  from: boolean;
  // Terms whose price isn't known here, so they're left out of the totals
  notCounted: TermId[];
  // Card fee per sale, shown beside the totals since it depends on sales
  perSale: string;
}

const NOT_CHECKED = "Price not checked here";

export function feeText(fee: { percent: number; fixedCents: number }): string {
  // percent is a fraction, such as 0.029
  return `${Math.round(fee.percent * 10_000) / 100}% + ${fee.fixedCents}¢`;
}

function domainLine(platform: PlatformInfo): CostLine[] {
  const { domain, startPlan, name } = platform;
  const lines: CostLine[] = [];
  if (domain.needsPlan) {
    lines.push({
      term: "domain",
      label: `${domain.needsPlan.name} instead of ${startPlan.name}, needed for your own web address`,
      amount: { kind: "monthly", usd: Math.max(0, domain.needsPlan.monthlyUsd - startPlan.monthlyUsd) },
    });
  }
  if (domain.firstYearFree) {
    lines.push({ term: "domain", label: "Web address", amount: { kind: "free_first_year", later: domain.later } });
  } else if (domain.sold === "here" && domain.firstUsd !== null) {
    lines.push({ term: "domain", label: `Web address from ${name}`, amount: { kind: "once", usd: domain.firstUsd, from: domain.from, per: domain.per } });
  } else {
    lines.push({ term: "domain", label: "Web address, from a company that sells them", amount: { kind: "unknown", text: NOT_CHECKED } });
  }
  return lines;
}

function emailLine(platform: PlatformInfo): CostLine {
  const { email } = platform;
  const label =
    email.kind === "addon"
      ? `Business email through ${email.via}`
      : email.kind === "forwarding"
        ? `Business email: forwarding is free; a full inbox through ${email.via}`
        : `Business email, from ${email.via}`;
  return { term: "email", label, amount: email.monthlyUsd === null ? { kind: "unknown", text: NOT_CHECKED } : { kind: "monthly", usd: email.monthlyUsd } };
}

export function costSummary(platform: PlatformInfo): CostSummary {
  const base: CostLine = { term: null, label: `${platform.startPlan.name} plan`, amount: { kind: "monthly", usd: platform.startPlan.monthlyUsd } };
  const perSale = `${feeText(platform.cardFee)} per card sale`;
  const extras: CostLine[] = [
    ...domainLine(platform),
    emailLine(platform),
    {
      term: "checkout",
      label: platform.checkout === "built_in" ? "Card fees" : "Card fees, through your payment provider",
      amount: { kind: "per_sale", text: perSale },
    },
  ];
  let monthlyUsd = 0;
  let onceUsd = 0;
  let from = false;
  for (const line of [base, ...extras]) {
    if (line.amount.kind === "monthly") monthlyUsd += line.amount.usd;
    if (line.amount.kind === "once") {
      onceUsd += line.amount.usd;
      from ||= line.amount.from;
    }
  }
  return {
    base,
    extras,
    monthlyUsd: cents(monthlyUsd),
    firstYearUsd: cents(monthlyUsd * 12 + onceUsd),
    from,
    notCounted: [...new Set(extras.flatMap((line) => (line.amount.kind === "unknown" && line.term ? [line.term] : [])))],
    perSale,
  };
}

const cents = (usdAmount: number) => Math.round(usdAmount * 100) / 100;

export function usd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: amount % 1 ? 2 : 0 });
}
