import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { InsightsPanel } from "@/components/insights/insights-panel";
import { RunStatus } from "@/components/run-status";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { getModel } from "@/lib/ai";
import { getMyInsights, lastMyRun } from "@/lib/data/my-business";
import { CUT_OFF_MESSAGE } from "@/lib/data/workflow-runs";
import { basisOf, changedAreas } from "@/lib/insights/facts";
import { gatherMyInsightInputs } from "@/lib/insights/gather";
import { FACT_AREA_LABELS } from "@/lib/insights/types";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/insights");
// Writing insights waits on an AI call
export const maxDuration = 300;

export default function InsightsPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6 wrap-break-word">
      <PageHead
        kicker={
          <span className="flex items-center gap-2">
            <Icon name="lightbulb" size="sm" />
            Start your business
          </span>
        }
        title="Business insights"
        lead="Friendly feedback on your idea: what’s strong, what to keep an eye on, tips for success and creative ideas."
      />
      <Suspense fallback={<p className="text-muted">Loading your insights…</p>}>
        <InsightsView />
      </Suspense>
    </div>
  );
}

async function InsightsView() {
  const [inputs, saved, run] = await Promise.all([gatherMyInsightInputs(), getMyInsights(), lastMyRun("insights", null)]);

  if (!inputs) {
    return (
      <Card title="Start with your business" icon="store">
        <p className="text-rule">Tell us about your business first. Insights come from your answers.</p>
        <Link href="/business" className={PRIMARY_LINK}>
          Tell us about your business
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }

  const insights = saved?.insights ?? null;
  const changed = insights ? changedAreas(insights.basis, basisOf(inputs)).map((area) => FACT_AREA_LABELS[area]) : [];
  const marks = Object.fromEntries(Object.entries(saved?.feedback ?? {}).map(([key, entry]) => [key, entry.mark]));

  return (
    <>
      {run && (run.status === "running" || run.message === CUT_OFF_MESSAGE) ? (
        <RunStatus status={run.status === "running" ? "running" : "failed"} message={null} what="Writing your insights" />
      ) : null}
      <InsightsPanel insights={insights} marks={marks} changed={changed} practice={getModel().simulated} />
    </>
  );
}
