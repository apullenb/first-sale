import Link from "next/link";
import { Icon } from "@/components/icons";
import { RequirementStatusChip } from "@/components/requirements/requirement-status";
import { ACTION_ITEM, PRIMARY_LINK } from "@/components/styles";
import { ActionKicker, Chip, Fact, IconTile } from "@/components/ui";
import type { PlanStep } from "@/lib/data/plan";
import { formatFee } from "@/lib/documents/startup-plan";
import { TOPIC_LABELS } from "@/lib/labels";
import { formatMinutes, stepMinutes } from "@/lib/rules/progress";
import { NEEDS_CONFIRMATION } from "@/lib/rules/readiness";
import type { StepKind } from "@/lib/rules/step-kind";
import { TOPIC_ICONS } from "./step-row";

// The one thing to do next: ready now, needed before selling. A ruled margin, like a planner page.
export function NextStep({
  step,
  parallel = 0,
  kind,
  feeCents,
  unconfirmed = false,
}: {
  step: PlanStep;
  parallel?: number;
  kind: StepKind;
  // With the forms catalog's fee when research found none
  feeCents: number | null;
  // A filing whose form or way to submit no official page confirmed
  unconfirmed?: boolean;
}) {
  return (
    <section aria-labelledby="next-step-heading" className={ACTION_ITEM}>
      <div className="flex items-center gap-3">
        <IconTile icon={TOPIC_ICONS[step.topic]} big />
        <ActionKicker as="h2" id="next-step-heading">
          Your next step
        </ActionKicker>
      </div>
      <p className="font-display text-[23px] leading-tight sm:text-[27px]">{step.title}</p>
      <div className="flex flex-wrap gap-2">
        <Fact icon="clock">
          About <b className="font-bold text-ink">{formatMinutes(stepMinutes(step))}</b> of your time (an estimate)
        </Fact>
        <Fact icon={TOPIC_ICONS[step.topic]}>{TOPIC_LABELS[step.topic]}</Fact>
        {step.agency ? <Fact icon="office">{step.agency}</Fact> : null}
        {feeCents !== null ? (
          <Fact icon="coins">{feeCents === 0 ? "Free" : `Fee ${formatFee(feeCents)}`}</Fact>
        ) : kind === "filing" || kind === "training" ? (
          <Fact icon="coins">Fee not confirmed</Fact>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {step.requirementStatus === "verified" ? null : <RequirementStatusChip status={step.requirementStatus} />}
        {unconfirmed ? (
          <Chip tone="warn" icon="question">
            {NEEDS_CONFIRMATION}
          </Chip>
        ) : null}
      </div>
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
