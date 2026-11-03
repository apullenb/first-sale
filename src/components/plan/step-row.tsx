import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { RequirementStatusChip } from "@/components/requirements/requirement-status";
import { Chip } from "@/components/ui";
import type { PlanStep } from "@/lib/data/plan";
import type { PlanTopic } from "@/lib/domain";
import { formatFee } from "@/lib/documents/startup-plan";
import { TOPIC_LABELS } from "@/lib/labels";
import { formatMinutes, stepMinutes } from "@/lib/rules/progress";

export const TOPIC_ICONS: Record<PlanTopic, IconName> = {
  structure: "scale",
  name_registration: "tag",
  tax_registration: "receipt",
  license_permit: "clipboard",
  location_zoning: "pin",
  employer: "users",
  other: "checklist",
};

export type RowState = "done" | "submitted" | "locked" | "ready";

const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

// A check that draws itself in, once, when it first shows
export function PenCheck({ size = 18, strokeWidth = 2.2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className="pen-draw shrink-0">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

const TICK: Record<RowState, string> = {
  done: "border-done/25 bg-done-tint text-done",
  submitted: "border-check-ring bg-check-tint text-check",
  locked: "border-transparent bg-wash text-faint",
  ready: "border-line-strong bg-surface text-accent",
};

// The square at the start of a row: what kind of step, or that it's done, waiting or locked
function TickBox({ state, topic, tip }: { state: RowState; topic: PlanTopic; tip?: string }) {
  return (
    <span className="relative shrink-0">
      <span aria-hidden="true" className={`grid size-[30px] place-items-center rounded-[9px] border-[1.5px] ${TICK[state]}`}>
        {state === "done" ? <PenCheck size={16} /> : <Icon name={state === "submitted" ? "hourglass" : state === "locked" ? "lock" : TOPIC_ICONS[topic]} size="sm" />}
      </span>
      {tip ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-max max-w-[260px] rounded-[9px] bg-ink px-2.5 py-2 text-[13.5px] font-semibold leading-snug text-white shadow-lift group-hover/row:block group-focus-visible/row:block"
        >
          {tip}
        </span>
      ) : null}
    </span>
  );
}

// One step as a tidy row: tick box, title, a few facts, and a chevron to open it
export function StepRow({ step, state, lockedBy = [], number }: { step: PlanStep; state: RowState; lockedBy?: PlanStep[]; number?: number }) {
  const locked = state === "locked";
  const done = state === "done";
  const first = lockedBy.length ? `Do this first: ${LIST.format(lockedBy.map((each) => each.title))}` : undefined;
  return (
    <li>
      <Link
        href={`/checklist/${step.id}`}
        className={`group/row relative flex min-h-16 items-center gap-3.5 rounded-xl border px-3.5 py-3 transition motion-reduce:transition-none ${
          locked ? "border-line bg-soft" : "border-line bg-surface shadow-soft hover:-translate-y-px hover:border-line-strong hover:shadow-card motion-reduce:hover:translate-y-0"
        }`}
      >
        <TickBox state={state} topic={step.topic} tip={first} />
        <span className="min-w-0 flex-1">
          <span className={`block font-bold leading-snug ${done ? "text-muted line-through decoration-line-strong" : locked ? "text-muted" : "text-ink"}`}>
            {number ? <span className="mr-1 font-semibold tabular-nums text-faint">{number}.</span> : null}
            {step.title}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
            <Chip tone="gray" icon={TOPIC_ICONS[step.topic]}>
              {TOPIC_LABELS[step.topic]}
            </Chip>
            {done ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="check" size="xs" className="text-done" />
                Done{step.completedAt ? <> <LocalDate iso={step.completedAt.toISOString()} /></> : null}
              </span>
            ) : state === "submitted" ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="hourglass" size="xs" className="text-faint" />
                Waiting to hear back
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Icon name="clock" size="xs" className="text-faint" />
                  <span>
                    <span className="sr-only">About </span>
                    <span aria-hidden="true">~</span>
                    {formatMinutes(stepMinutes(step))}
                  </span>
                </span>
                {step.feeCents !== null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="coins" size="xs" className="text-faint" />
                    {step.feeCents === 0 ? "Free" : `Fee ${formatFee(step.feeCents)}`}
                  </span>
                ) : null}
                {step.requirementStatus === "verified" ? null : <RequirementStatusChip status={step.requirementStatus} />}
              </>
            )}
            {first ? <span className="basis-full">{first}</span> : null}
          </span>
        </span>
        <Icon name="chevron" className="text-faint" />
      </Link>
    </li>
  );
}
