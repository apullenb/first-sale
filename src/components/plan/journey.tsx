import Link from "next/link";
import { RequirementStatusChip } from "@/components/requirements/requirement-status";
import { CARD, PRIMARY_LINK, SECTION_TITLE } from "@/components/styles";
import type { PlanStep } from "@/lib/data/plan";
import { formatFee } from "@/lib/documents/startup-plan";
import type { NextMove, Stage, StageState } from "@/lib/rules/journey";

// The one thing to do next, from anywhere in the journey
export function StartHere({ move, step, parallel = 0 }: { move: NextMove; step?: PlanStep; parallel?: number }) {
  const facts = step ? [step.agency, step.feeCents === null ? null : `Fee: ${formatFee(step.feeCents)}`].filter(Boolean) : [];
  return (
    <section aria-labelledby="start-heading" className="flex flex-col gap-2.5 rounded-2xl bg-accent-tint p-5 sm:p-6">
      <h2 id="start-heading" className="text-xs font-bold uppercase tracking-wider text-accent-ink">
        Do this next
      </h2>
      <p className="font-display text-2xl font-bold leading-snug text-accent-ink">{move.title}</p>
      {step ? <RequirementStatusChip status={step.requirementStatus} /> : null}
      {facts.length ? <p className="text-rule">{facts.join(" · ")}</p> : null}
      <p className="text-rule">{move.why}</p>
      {step?.conditions[0] ? <p className="text-[15px] text-rule">First check: {step.conditions[0]}</p> : null}
      {parallel > 0 ? (
        <p className="text-sm text-muted">{parallel === 1 ? "One more step" : `${parallel} more steps`} can happen at the same time.</p>
      ) : null}
      {step?.simulated ? <p className="text-sm font-semibold text-check">Practice mode: built-in rules suggested this step, not real research.</p> : null}
      <Link href={move.href} className={`${PRIMARY_LINK} mt-1`}>
        {move.action}
      </Link>
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
  done: "bg-accent text-white",
  now: "bg-surface text-accent-ink ring-2 ring-accent",
  check: "bg-check-tint text-check ring-2 ring-check/40",
  todo: "bg-rule-tint text-rule",
  anytime: "bg-rule-tint text-rule",
};

const LABEL_STYLES: Record<StageState, string> = {
  done: "text-accent-ink",
  now: "text-accent-ink",
  check: "text-check",
  todo: "text-muted",
  anytime: "text-muted",
};

// Where the owner is in starting the business, stage by stage
export function JourneyStages({ stages }: { stages: Stage[] }) {
  const done = stages.filter((stage) => stage.state === "done").length;
  const counted = stages.filter((stage) => stage.state !== "anytime").length;
  return (
    <section aria-labelledby="journey-heading" className={`flex flex-col gap-3 ${CARD}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="journey-heading" className={SECTION_TITLE}>
          Starting your business
        </h2>
        <p className="text-sm text-muted">
          {done} of {counted} stages done
        </p>
      </div>
      <ol className="flex flex-col">
        {stages.map((stage, index) => (
          <li key={stage.href} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${MARKS[stage.state]}`}>
                {stage.state === "done" ? <Tick /> : stage.state === "check" ? "!" : index + 1}
              </span>
              {index < stages.length - 1 ? <span aria-hidden="true" className="w-0.5 flex-1 bg-line" /> : null}
            </div>
            <div className="flex min-w-0 flex-col pb-4">
              <Link href={stage.href} className="flex min-h-8 w-fit items-center text-[17px] font-bold underline-offset-4 hover:underline">
                {stage.title}
              </Link>
              <p className={`text-sm font-semibold ${LABEL_STYLES[stage.state]}`}>{STATE_LABELS[stage.state]}</p>
              <p className="text-[15px] text-rule">{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Tick() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
