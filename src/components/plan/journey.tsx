import Link from "next/link";
import { Icon } from "@/components/icons";
import { RequirementStatusChip } from "@/components/requirements/requirement-status";
import { ACTION_ITEM, PRIMARY_LINK, SECONDARY_LINK } from "@/components/styles";
import { ActionKicker, Card, Chip, Fact, Hand, IconTile } from "@/components/ui";
import type { PlanStep } from "@/lib/data/plan";
import { formatFee } from "@/lib/documents/startup-plan";
import { TOPIC_LABELS } from "@/lib/labels";
import type { NextMove, Stage, StageState } from "@/lib/rules/journey";
import { formatMinutes, stepMinutes } from "@/lib/rules/progress";
import { TOPIC_ICONS } from "./topic-icon";
import { choosesStructure } from "@/lib/rules/plan";
import { NEEDS_CONFIRMATION } from "@/lib/rules/readiness";

// Where "already done" lands on a step's page; a structure is chosen on Business structure
export function alreadyDoneHref(step: Pick<PlanStep, "id" | "topic" | "forStructures">): string {
  return choosesStructure(step) ? "/structure" : `/checklist/${step.id}#already-done`;
}

// The one thing to do next, from anywhere in the journey, on a ruled card
export function StartHere({
  move,
  step,
  group = null,
  parallel = 0,
  after = null,
  unconfirmed = false,
}: {
  move: NextMove;
  step?: PlanStep;
  // A filing whose form or way to submit no official page confirmed
  unconfirmed?: boolean;
  // The paperwork group the step is in
  group?: { name: string; href: string } | null;
  parallel?: number;
  after?: PlanStep | null;
}) {
  const icon = step ? TOPIC_ICONS[step.topic] : "flag";
  return (
    <section aria-labelledby="start-heading" className={ACTION_ITEM}>
      <span aria-hidden="true" className="absolute right-[22px] top-4 hidden -rotate-[5deg] @3xl:block">
        <Hand>start here ↓</Hand>
      </span>
      <div className="flex items-center gap-3 @3xl:pr-28">
        <IconTile icon={icon} big />
        <div className="flex min-w-0 flex-col">
          <ActionKicker as="h2" id="start-heading">
            Do this next
          </ActionKicker>
          {step?.agency ? <p className="text-[14.5px] leading-snug text-muted">{step.agency}</p> : null}
        </div>
      </div>
      <p className="font-display text-[23px] leading-[1.2] sm:text-[27px]">{move.title}</p>
      {step ? (
        <div className="flex flex-wrap items-center gap-2">
          <Fact icon="clock">
            <b className="font-bold text-ink">~{formatMinutes(stepMinutes(step))}</b>
            <span className="sr-only"> of your time</span> (estimate)
          </Fact>
          {step.feeCents !== null ? (
            <Fact icon="dollar">
              {formatFee(step.feeCents)}
              <span className="sr-only"> fee</span>
            </Fact>
          ) : null}
          <Fact icon={icon}>{TOPIC_LABELS[step.topic]}</Fact>
          {step.requirementStatus === "verified" ? null : <RequirementStatusChip status={step.requirementStatus} />}
          {unconfirmed ? (
            <Chip tone="warn" icon="question">
              {NEEDS_CONFIRMATION}
            </Chip>
          ) : null}
        </div>
      ) : null}
      <p className="text-[16.5px] text-muted">{move.why}</p>
      {step?.conditions[0] ? <p className="text-[15px] text-rule">First check: {step.conditions[0]}</p> : null}
      {parallel > 0 ? (
        <p className="text-[15px] text-muted">{parallel === 1 ? "One more step" : `${parallel} more steps`} can happen at the same time.</p>
      ) : null}
      {step?.simulated ? (
        <p className="flex items-start gap-2 text-sm font-semibold text-check">
          <Icon name="info" size="sm" className="mt-0.5" />
          Practice mode: built-in rules suggested this step, not real research.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2.5">
        <Link href={move.href} className={PRIMARY_LINK}>
          {move.action}
          <Icon name="arrow" size="sm" />
        </Link>
        {step ? (
          <Link href={alreadyDoneHref(step)} className={SECONDARY_LINK}>
            <Icon name="check" size="sm" className="text-accent" />
            I’ve already done this
          </Link>
        ) : null}
      </div>
      {group ? (
        <p className="text-[14.5px] text-muted">
          Part of{" "}
          <Link href={group.href} className="py-3 font-semibold text-rule underline decoration-line-strong underline-offset-4 hover:text-accent">
            {group.name}
          </Link>
        </p>
      ) : null}
      {after ? (
        <p className="border-t border-line pt-3 text-[14.5px] text-muted">
          After this:{" "}
          <Link href={`/checklist/${after.id}`} className="py-3 font-semibold text-rule hover:text-accent hover:underline">
            {after.title}
          </Link>{" "}
          · ~{formatMinutes(stepMinutes(after))}
        </p>
      ) : null}
    </section>
  );
}

const STATE_LABELS: Record<StageState, string> = {
  done: "Done",
  now: "Up next",
  check: "Needs your OK",
  todo: "Not started",
  anytime: "Any time",
};

const MARKS: Record<StageState, string> = {
  done: "border-done/40 bg-done-tint text-done",
  now: "border-accent bg-accent text-white",
  check: "border-check-ring bg-check-tint text-check",
  todo: "border-line-strong bg-surface text-muted",
  anytime: "border-dashed border-line-strong bg-surface text-faint",
};

const LABEL_STYLES: Record<StageState, string> = {
  done: "text-done",
  now: "text-accent",
  check: "text-check",
  todo: "text-muted",
  anytime: "text-muted",
};

// Where the owner is in starting the business, stage by stage
export function JourneyStages({ stages }: { stages: Stage[] }) {
  const done = stages.filter((stage) => stage.state === "done").length;
  const counted = stages.filter((stage) => stage.state !== "anytime").length;
  return (
    <Card
      title="Starting your business"
      icon="flag"
      id="journey-heading"
      action={
        <span className="text-sm text-muted">
          {done} of {counted} stages done
        </span>
      }
    >
      <ol className="flex flex-col">
        {stages.map((stage, index) => (
          <li key={stage.href} className="relative flex gap-3.5 pb-4 last:pb-0">
            {index < stages.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-[15px] top-8 w-[1.5px] bg-line" /> : null}
            <span aria-hidden="true" className={`relative grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] text-sm font-bold ${MARKS[stage.state]}`}>
              {stage.state === "done" ? <Icon name="check" size="sm" strokeWidth={2.4} /> : stage.state === "check" ? "!" : index + 1}
            </span>
            <div className="flex min-w-0 flex-col">
              <Link href={stage.href} className="-my-1.5 flex min-h-11 w-fit items-center font-display text-[17px] leading-tight underline-offset-4 hover:underline">
                {stage.title}
              </Link>
              <p className={`text-sm font-semibold ${LABEL_STYLES[stage.state]}`}>{STATE_LABELS[stage.state]}</p>
              <p className="text-[15px] text-muted">{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function Tick() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
