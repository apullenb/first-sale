import Link from "next/link";
import { Icon } from "@/components/icons";
import { RequirementStatusChip } from "@/components/requirements/requirement-status";
import { PRIMARY_LINK } from "@/components/styles";
import { Fact, IconTile } from "@/components/ui";
import type { PlanStep } from "@/lib/data/plan";
import { formatFee } from "@/lib/documents/startup-plan";
import { TOPIC_LABELS } from "@/lib/labels";
import { formatMinutes, stepMinutes } from "@/lib/rules/progress";
import { TOPIC_ICONS } from "./step-row";

export function PlanProgress({ done, total }: { done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-[28px] leading-none tabular-nums">
          {done} of {total}
        </span>
        <span className="text-muted">{total === 1 ? "step" : "steps"} done</span>
      </p>
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-wash shadow-[inset_0_0_0_1px_rgb(19_41_75/0.05)]">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// The one thing to do next: ready now, needed before selling. A ruled margin, like a planner page.
export function NextStep({ step, parallel = 0 }: { step: PlanStep; parallel?: number }) {
  return (
    <section
      aria-labelledby="next-step-heading"
      className="relative flex flex-col gap-3.5 rounded-2xl border border-line bg-surface py-6 pr-5 pl-[34px] shadow-lift before:absolute before:inset-y-0 before:left-[18px] before:w-[1.5px] before:bg-accent-ring sm:pr-6 sm:pl-[46px] sm:before:left-7"
    >
      <div className="flex items-center gap-3">
        <IconTile icon={TOPIC_ICONS[step.topic]} big />
        <h2 id="next-step-heading" className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">
          Your next step
        </h2>
      </div>
      <p className="font-display text-[23px] leading-tight sm:text-[27px]">{step.title}</p>
      <div className="flex flex-wrap gap-2">
        <Fact icon="clock">
          <b className="font-bold text-ink">{formatMinutes(stepMinutes(step))}</b> of your time
        </Fact>
        <Fact icon={TOPIC_ICONS[step.topic]}>{TOPIC_LABELS[step.topic]}</Fact>
        {step.agency ? <Fact icon="office">{step.agency}</Fact> : null}
        {step.feeCents !== null ? <Fact icon="coins">{step.feeCents === 0 ? "Free" : `Fee ${formatFee(step.feeCents)}`}</Fact> : null}
      </div>
      {step.requirementStatus === "verified" ? null : <RequirementStatusChip status={step.requirementStatus} />}
      {step.conditions[0] ? <p className="text-[15px] text-rule">First check: {step.conditions[0]}</p> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href={`/checklist/${step.id}`} className={PRIMARY_LINK}>
          Open this step
          <Icon name="arrow" size="sm" />
        </Link>
        {parallel > 0 ? (
          <p className="text-[14.5px] text-muted">{parallel === 1 ? "One more step" : `${parallel} more steps`} can happen at the same time.</p>
        ) : null}
      </div>
      {step.simulated ? (
        <p className="border-t border-line pt-3 text-sm font-semibold text-check">Practice mode: built-in rules suggested this step, not real research.</p>
      ) : null}
    </section>
  );
}
