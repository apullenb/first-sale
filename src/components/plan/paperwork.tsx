import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { Chip } from "@/components/ui";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import type { PlanStep } from "@/lib/data/plan";
import type { BusinessStructure } from "@/lib/domain";
import { formsFor } from "@/lib/documents/form-catalog";
import { formatFee } from "@/lib/documents/startup-plan";
import type { Place } from "@/lib/research/applicability";
import type { ActionStep } from "@/lib/rules/next-action";
import type { PaperworkGroup, PaperworkTask, TaskKind, TaskState } from "@/lib/rules/paperwork";
import { formatMinutes } from "@/lib/rules/progress";
import { PenCheck } from "./step-row";
import { TOPIC_ICONS } from "./topic-icon";

const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

export type PricedTask = PaperworkTask<PlanStep> & { feeCents: number | null; formKey: string | null };

// A fee confirmed by research wins; otherwise the hand-checked forms catalog's
export function priceTasks(tasks: readonly PaperworkTask<PlanStep>[], place: Place | null, structure: BusinessStructure | null): PricedTask[] {
  return tasks.map((task) => {
    const form = place ? (formsFor(OFFICIAL_FORMS, task.step, place, structure).find((each) => !each.kept) ?? null) : null;
    return { ...task, feeCents: task.step.feeCents ?? form?.fee?.cents ?? null, formKey: form?.key ?? null };
  });
}

// For the plan rules: the stored step with what applies now
export function actionStep(task: PricedTask): PlanStep & ActionStep {
  return { ...task.step, requirementStatus: task.requirementStatus, conditions: task.conditions, feeCents: task.feeCents, formKey: task.formKey };
}

export const KIND_LABELS: Record<TaskKind, string | null> = {
  task: null,
  check_place: "Add where you are",
};

const MARKS: Record<TaskState, string> = {
  done: "border-done/25 bg-done-tint text-done",
  waiting: "border-check-ring bg-check-tint text-check",
  locked: "border-dashed border-line-strong bg-wash text-faint",
  ready: "border-line-strong bg-surface text-accent",
};

const STATE_WORDS: Record<TaskState, string> = { done: "Done", waiting: "Waiting to hear back", locked: "Locked", ready: "Ready" };

export function StateMark({ state, icon }: { state: TaskState; icon: IconName }) {
  return (
    <span className={`grid size-[30px] shrink-0 place-items-center rounded-[9px] border-[1.5px] ${MARKS[state]}`}>
      {state === "done" ? <PenCheck size={16} /> : <Icon name={state === "waiting" ? "hourglass" : state === "locked" ? "lock" : icon} size="sm" />}
      <span className="sr-only">{STATE_WORDS[state]}: </span>
    </span>
  );
}

// One line of a list: state, title, a short summary, time, and what it waits on
export function ListRow({
  href,
  title,
  summary,
  state,
  icon,
  meta,
  note,
  next = false,
}: {
  href: string;
  title: string;
  summary: string;
  state: TaskState;
  icon: IconName;
  meta?: ReactNode;
  note?: ReactNode;
  // The one to do next here
  next?: boolean;
}) {
  const locked = state === "locked";
  return (
    <li>
      <Link
        href={href}
        className={`group/row relative flex min-h-16 items-start gap-3.5 rounded-xl border px-3.5 py-3 transition motion-reduce:transition-none ${
          next
            ? "border-accent bg-surface shadow-[0_0_0_3px_var(--color-accent-tint),var(--shadow-soft)]"
            : locked
              ? "border-line bg-soft"
              : "border-line bg-surface shadow-soft hover:-translate-y-px hover:border-line-strong hover:shadow-card motion-reduce:hover:translate-y-0"
        }`}
      >
        <StateMark state={state} icon={icon} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {next ? <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-accent">Do this next</span> : null}
          <span className={`font-bold leading-snug ${state === "done" ? "text-muted line-through decoration-line-strong" : locked ? "text-rule" : "text-ink"}`}>{title}</span>
          {summary ? <span className="text-[14.5px] leading-snug text-muted">{summary}</span> : null}
          {meta ? <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">{meta}</span> : null}
          {note ? <span className="mt-1 text-sm text-rule">{note}</span> : null}
        </span>
        <Icon name="chevron" className="mt-1 text-faint" />
      </Link>
    </li>
  );
}

const FACT = "inline-flex items-center gap-1.5";

export function TimeFact({ minutes, later = false }: { minutes: number; later?: boolean }) {
  return (
    <span className={`${FACT} tabular-nums`}>
      <Icon name="clock" size="xs" className="text-faint" />
      <span>
        <span className="sr-only">About </span>
        <span aria-hidden="true">~</span>
        {formatMinutes(minutes)}
        <span className="sr-only"> of your time</span>
        {later ? " · after your first sale" : ""}
      </span>
    </span>
  );
}

export function LockNote({ blockers }: { blockers: PaperworkTask<PlanStep>["blockers"] }) {
  const own = blockers.filter((each) => !each.office);
  return (
    <span className="inline-flex items-start gap-1.5">
      <Icon name={own.length ? "lock" : "hourglass"} size="xs" className="mt-[3px] shrink-0 text-faint" />
      <span>
        {own.length
          ? `Do this first: ${LIST.format(own.map((each) => (each.taskKey ? `“${each.title}”` : each.title)))}`
          : `Waits on the office to approve ${LIST.format(blockers.map((each) => `“${each.title}”`))}`}
      </span>
    </span>
  );
}

export function TaskListRow({ task, next = false }: { task: PricedTask; next?: boolean }) {
  const step = task.step;
  const kind = KIND_LABELS[task.kind];
  const meta =
    task.state === "done" ? (
      <span className={FACT}>
        <Icon name="check" size="xs" className="text-done" />
        Done{step.completedAt ? <> <LocalDate iso={step.completedAt.toISOString()} /></> : null}
      </span>
    ) : task.state === "waiting" ? (
      <span className={FACT}>
        <Icon name="hourglass" size="xs" className="text-check" />
        {step.submittedAt ? (
          <>
            Submitted <LocalDate iso={step.submittedAt.toISOString()} />, waiting to hear back
          </>
        ) : (
          "Submitted, waiting to hear back"
        )}
      </span>
    ) : (
      <>
        <TimeFact minutes={task.minutes} later={step.timing === "later"} />
        {task.feeCents !== null ? (
          <span className={FACT}>
            <Icon name="coins" size="xs" className="text-faint" />
            {task.feeCents === 0 ? "Free" : `Fee ${formatFee(task.feeCents)}`}
          </span>
        ) : null}
        {kind ? (
          <Chip tone="warn" icon="pin">
            {kind}
          </Chip>
        ) : null}
      </>
    );
  return (
    <ListRow
      href={`/checklist/${step.id}`}
      title={step.title}
      summary={task.summary}
      state={task.state}
      icon={TOPIC_ICONS[step.topic]}
      meta={meta}
      note={task.state === "locked" ? <LockNote blockers={task.blockers} /> : null}
      next={next}
    />
  );
}

// A group's facts in a line: how much is done, the time left, and whether it waits on something
export function GroupFacts({ group }: { group: PaperworkGroup<PlanStep> }) {
  const done = group.tasks.filter((task) => task.state === "done").length;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {group.tasks.length ? (
        <Chip tone={done === group.tasks.length ? "done" : "plain"} icon="check">
          {done} of {group.tasks.length} done
        </Chip>
      ) : null}
      {group.minutesLeft ? (
        <Chip icon="clock">
          ~{formatMinutes(group.minutesLeft)} left{group.later ? ", after your first sale" : ""}
        </Chip>
      ) : null}
      {group.state === "waiting" ? (
        <Chip tone="warn" icon="hourglass">
          Waiting to hear back
        </Chip>
      ) : group.state === "locked" ? (
        <Chip tone="gray" icon="lock">
          Waits on {LIST.format(group.waitsOn)}
        </Chip>
      ) : null}
    </span>
  );
}

// Filings that wait on a structure decision, said once, with where to decide
export function WaitingOnStructure({ titles }: { titles: string[] }) {
  return (
    <li>
      <Link
        href="/structure"
        className="flex min-h-16 items-start gap-3.5 rounded-xl border border-dashed border-line-strong bg-soft px-3.5 py-3 transition hover:border-muted motion-reduce:transition-none"
      >
        <StateMark state="locked" icon="scale" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-bold leading-snug text-rule">
            {titles.length === 1 ? "1 filing depends on your business structure" : `${titles.length} filings depend on your business structure`}
          </span>
          <span className="text-[14.5px] leading-snug text-muted">
            Which ones you need shows up once you choose: {LIST.format(titles.map((title) => title.replace(/\.$/, "")))}.
          </span>
          <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-rule">
            <Icon name="lock" size="xs" className="text-faint" />
            Do this first: choose your business structure
          </span>
        </span>
        <Icon name="chevron" className="mt-1 text-faint" />
      </Link>
    </li>
  );
}
