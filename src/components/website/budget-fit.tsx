import { LABEL } from "@/components/marketing/pieces";
import { Fold } from "@/components/ui";
import type { BusinessProfile } from "@/lib/domain";
import { budgetShare, demandTestOption, featureNeeds } from "@/lib/website/budget";
import { costSummary, usd } from "@/lib/website/costs";
import type { PlatformInfo } from "@/lib/website/platforms";
import { List } from "./platform-card";

// The recommended package against the owner's startup budget, a $0 way to test demand, and which paid features matter now
export function BudgetFit({ profile, recommended, platforms }: { profile: BusinessProfile; recommended: PlatformInfo; platforms: readonly PlatformInfo[] }) {
  const costs = costSummary(recommended);
  const share = budgetShare(costs.firstYearUsd, profile.startupBudget);
  const test = demandTestOption(platforms);
  const needs = featureNeeds(profile);
  return (
    <section aria-label="Your budget" className="flex flex-col gap-3 rounded-xl border border-line bg-soft px-4 py-3.5">
      <p className={LABEL}>Your budget</p>
      <p className="text-rule">
        <strong className="text-ink">{recommended.name}</strong> costs {costs.from ? "from " : ""}
        <strong className="text-ink">{usd(costs.firstYearUsd)}</strong>
        {recommended.demoPrice ? " (demo price)" : ""} for the first year on {costs.plan.name}, before the extras its cost summary leaves out.{" "}
        {share ? share.text : "Add your startup budget in your answers to see how much of it this uses."}
      </p>
      {test ? (
        <div className="flex flex-col gap-1.5">
          <p className="font-semibold">Cheapest way to test demand first</p>
          <List items={test.lines} tone="good" />
        </div>
      ) : null}
      <Fold icon="info" title="Which paid features you need" summary="From what you sell and how customers get it">
        <List
          tone="plain"
          items={needs.map((need) => (
            <span key={need.feature}>
              <strong>{need.feature}</strong> ({need.need === "now" ? "needed now" : "can wait"}): {need.why}
            </span>
          ))}
        />
      </Fold>
    </section>
  );
}
