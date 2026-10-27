import type { PlatformInfo } from "./platforms";

// Plain arithmetic over the vendor's published prices, shown with the formula

export function firstYearCost(platform: PlatformInfo): { total: number; parts: string[] } {
  const plan = platform.startPlan.monthlyUsd * 12;
  const domain = platform.domain.firstYearUsd ?? 0;
  const parts = [
    platform.startPlan.monthlyUsd === 0
      ? `${platform.startPlan.name} plan: no monthly fee`
      : `${platform.startPlan.name} plan: ${usd(plan)} (${usd(platform.startPlan.monthlyUsd)} × 12 months)`,
  ];
  if (domain) parts.push(`Web address: from about ${usd(domain)} for the first year`);
  return { total: plan + domain, parts };
}

// Card fee on one order, as the platform's published rate works it out
export function cardFeeOn(platform: PlatformInfo, orderUsd: number): number | null {
  if (!platform.cardFee) return null;
  // percent is a fraction, such as 0.029; the result is in dollars
  return Math.round(orderUsd * 100 * platform.cardFee.percent + platform.cardFee.fixedCents) / 100;
}

export function usd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: amount % 1 ? 2 : 0 });
}
