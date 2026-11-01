import type { BusinessProfile } from "@/lib/domain";
import { BUDGET_LABELS } from "@/lib/intake/options";
import { comparePlan, costSummary, feeText, usd } from "./costs";
import type { PlatformInfo, PlatformPlan } from "./platforms";

// How a package's first-year cost sits against the owner's startup budget, and a cheaper way to test demand.
// Plain arithmetic over the saved budget range and the platform data; no price is guessed.

type Budget = NonNullable<BusinessProfile["startupBudget"]>;

// The answer is a range, so every share is a range or a bound
const BUDGET_USD: Record<Exclude<Budget, "unsure">, { min: number; max: number | null }> = {
  under_1k: { min: 0, max: 1_000 },
  "1k_5k": { min: 1_000, max: 5_000 },
  "5k_25k": { min: 5_000, max: 25_000 },
  over_25k: { min: 25_000, max: null },
};

export interface BudgetShare {
  text: string;
  // At least a quarter of the budget
  heavy: boolean;
}

const percent = (share: number, round: (value: number) => number) => {
  const value = round(share * 100);
  return value < 1 ? "under 1%" : `${value}%`;
};

export function budgetShare(firstYearUsd: number, budget: BusinessProfile["startupBudget"]): BudgetShare | null {
  if (!budget || budget === "unsure") return null;
  const { min, max } = BUDGET_USD[budget];
  const label = BUDGET_LABELS[budget];
  if (firstYearUsd <= 0) return { text: `None of your startup budget (${label}) in the first year, apart from card fees on sales.`, heavy: false };
  if (max !== null && firstYearUsd >= max) return { text: `All of your startup budget (${label}) or more.`, heavy: true };
  if (max === null) return { text: `At most ${percent(firstYearUsd / min, Math.ceil)} of your startup budget (${label}).`, heavy: false };
  const low = firstYearUsd / max;
  if (min === 0 || firstYearUsd >= min) {
    return { text: `At least ${percent(low, Math.floor)} of your startup budget (${label}). Your budget is a range, so this is the smallest share.`, heavy: low >= 0.25 };
  }
  return {
    text: `${percent(low, Math.floor)} to ${percent(firstYearUsd / min, Math.ceil)} of your startup budget (${label}), depending on where in that range you are.`,
    heavy: low >= 0.25,
  };
}

export interface TestOption {
  platform: PlatformInfo;
  plan: PlatformPlan;
  // The plan with the owner's own web address, for later
  next: PlatformPlan;
  lines: string[];
}

// A $0 plan that still takes card payments, to find out whether people buy before paying monthly
export function demandTestOption(platforms: readonly PlatformInfo[]): TestOption | null {
  for (const platform of platforms) {
    const plan = platform.plans.find((each) => each.monthlyUsd === 0 && each.takesPayments);
    if (!plan) continue;
    const next = comparePlan(platform);
    const lines = [
      `${plan.name}: ${usd(0)} a month. ${plan.adds}`,
      plan.cardFee ? `You pay only card fees when you sell: ${feeText(plan.cardFee)} per card sale.` : "Card fees apply to each sale; the rate isn’t checked here.",
      ...(next !== plan ? [`Move to ${next.name} (${next.price}) when you want your own web address.`] : []),
    ];
    return { platform, plan, next, lines };
  }
  return null;
}

export interface FeatureNeed {
  feature: string;
  need: "now" | "later";
  why: string;
}

// Which paid features this owner's goals call for; the rest can wait
export function featureNeeds(profile: BusinessProfile): FeatureNeed[] {
  const testing = profile.goals.includes("test_idea") || profile.startupBudget === "under_1k";
  const online = profile.channels.some((channel) => channel === "own_website" || channel === "social_media" || channel === "marketplace");
  const handoff = profile.handoff.filter((each) => each !== "unsure" && each !== "in_person_sale");
  const needs: FeatureNeed[] = [];
  if (online) needs.push({ feature: "Taking card payments online", need: "now", why: "You plan to sell through your website or social media, so customers need a way to pay." });
  if (handoff.length) {
    const ways = [handoff.some((each) => each.startsWith("pickup")) ? "pickup" : "", handoff.includes("local_delivery") ? "nearby delivery" : "", handoff.some((each) => each.startsWith("ship")) ? "shipping" : ""].filter(Boolean);
    needs.push({ feature: `Ordering for ${ways.join(" and ")}`, need: "now", why: "You picked these in your answers, so the site should let customers choose them." });
  }
  needs.push(
    testing
      ? { feature: "Your own web address", need: "later", why: "A free address works while you find out whether people buy. Add your own once orders are steady." }
      : { feature: "Your own web address", need: "now", why: "It’s easier to remember and share, and it stays yours if you change builders." },
    { feature: "Business email", need: "later", why: "An email account you already have works to start." },
  );
  return needs;
}

// A package's share of the budget, for its cost summary
export function packageShare(platform: PlatformInfo, budget: BusinessProfile["startupBudget"]): BudgetShare | null {
  return budgetShare(costSummary(platform).firstYearUsd, budget);
}
