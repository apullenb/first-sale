import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { TEXT_LINK } from "@/components/styles";
import { Fold, Note } from "@/components/ui";
import { formatFee } from "@/lib/documents/startup-plan";
import type { Costs } from "@/lib/rules/next-action";
import type { TaskState } from "@/lib/rules/paperwork";
import { formatMinutes } from "@/lib/rules/progress";
import { alreadyDoneHref } from "./journey";
import { KIND_LABELS, LockNote, type PricedTask } from "./paperwork";
import { TOPIC_ICONS } from "./topic-icon";

interface Props {
  // Only tasks that apply, with their states from the paperwork rules
  tasks: PricedTask[];
  costs: Costs;
  // The step "Do this next" already shows
  skip?: string | null;
}

type Mark = TaskState | "later";

// Every other task as a row: ready now, waiting on an office, locked behind something else, done, and for later
export function StepBoard({ tasks, costs, skip = null }: Props) {
  const soon = tasks.filter((task) => task.step.timing !== "later");
  const ready = soon.filter((task) => task.state === "ready");
  const toDo = ready.filter((task) => task.step.id !== skip);
  const submitted = soon.filter((task) => task.state === "waiting");
  const locked = soon.filter((task) => task.state === "locked");
  const done = soon.filter((task) => task.state === "done");
  const later = tasks.filter((task) => task.step.timing === "later");

  return (
    <div className="flex flex-col gap-6">
      {toDo.length || submitted.length || locked.length ? (
        <div className="grid items-start gap-6 @3xl:grid-cols-2">
          {toDo.length ? (
            <Group id="now-heading" title={toDo.length < ready.length ? "You can also do now" : "Ready to do now"} count={toDo.length}>
              {toDo.map((task) => (
                <Row key={task.step.id} task={task} mark="ready">
                  <Meta task={task} />
                  <Link href={alreadyDoneHref(task.step)} className={`relative z-10 -my-3 py-3 text-sm ${TEXT_LINK}`}>
                    Already done?<span className="sr-only"> Mark “{task.step.title}” done</span>
                  </Link>
                </Row>
              ))}
            </Group>
          ) : null}
          {submitted.length || locked.length ? (
            <div className="flex flex-col gap-6">
              {submitted.length ? (
                <Group id="board-waiting-heading" title="Waiting to hear back" count={submitted.length}>
                  {submitted.map((task) => (
                    <Row key={task.step.id} task={task} mark="waiting">
                      <Submitted task={task} />
                    </Row>
                  ))}
                </Group>
              ) : null}
              {locked.length ? (
                <Group id="locked-heading" title="Unlocks later" count={locked.length}>
                  {locked.map((task) => (
                    <Row key={task.step.id} task={task} mark="locked">
                      <LockNote blockers={task.blockers} />
                    </Row>
                  ))}
                </Group>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid items-start gap-3 @3xl:grid-cols-2">
        {done.length ? (
          <Fold title={`Done (${done.length})`} summary="Steps you’ve finished" icon="check">
            <ul className="grid gap-2.5">
              {done.map((task) => (
                <Row key={task.step.id} task={task} mark="done">
                  <DoneNote task={task} />
                </Row>
              ))}
            </ul>
          </Fold>
        ) : (
          <Note tone="quiet" icon="check">
            Nothing marked done yet. Mark each step when you finish it.
          </Note>
        )}
        {later.length ? (
          <Fold title={`After you open (${later.length})`} summary="After your first sale, so they don’t hold up your launch" icon="calendar">
            <ul className="grid gap-2.5">
              {later.map((task) => (
                <Row key={task.step.id} task={task} mark={task.state === "ready" ? "later" : task.state}>
                  {task.state === "done" ? <DoneNote task={task} /> : task.state === "waiting" ? <Submitted task={task} /> : task.state === "locked" ? <LockNote blockers={task.blockers} /> : <Meta task={task} />}
                </Row>
              ))}
            </ul>
          </Fold>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[15px] text-muted">
        <p>
          Fees confirmed so far: {formatFee(costs.startupCents)}
          {costs.yearlyCents ? `, then ${formatFee(costs.yearlyCents)} a year` : ""}
          {costs.unknown.length ? ` (${costs.unknown.length} set by the office)` : ""}
        </p>
        <Link href="/start" className={`flex min-h-11 items-center ${TEXT_LINK}`}>
          See every step to start your business
        </Link>
      </div>
    </div>
  );
}

function Group({ id, title, count, children }: { id: string; title: string; count: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <h2 id={id} className="font-display text-[22px] leading-tight">
        {title} <span className="font-sans text-base text-muted">({count})</span>
      </h2>
      <ul className="grid gap-2.5">{children}</ul>
    </section>
  );
}

const TICKS: Record<Mark, string> = {
  ready: "border-line-strong bg-surface text-accent",
  later: "border-line bg-surface text-faint",
  waiting: "border-check-ring bg-check-tint text-check",
  locked: "border-transparent bg-wash text-faint",
  done: "border-done/25 bg-done-tint text-done",
};

const TICK_LABELS: Record<Mark, string> = { ready: "To do", waiting: "Waiting to hear back", locked: "Locked", done: "Done", later: "After your first sale" };

// A task as one ruled row; the whole row opens it, and links inside it sit on top
function Row({ task, mark, children }: { task: PricedTask; mark: Mark; children?: ReactNode }) {
  const icon: IconName = mark === "done" ? "check" : mark === "waiting" ? "hourglass" : mark === "locked" ? "lock" : TOPIC_ICONS[task.step.topic];
  return (
    <li
      className={`relative flex min-h-16 items-center gap-3.5 rounded-xl border border-line px-3.5 py-3 transition hover:border-line-strong hover:shadow-card motion-safe:hover:-translate-y-px ${
        mark === "locked" ? "bg-soft" : "bg-surface shadow-soft"
      }`}
    >
      <span className={`grid size-[30px] shrink-0 place-items-center rounded-[9px] border-[1.5px] ${TICKS[mark]}`}>
        <Icon name={icon} size="sm" strokeWidth={mark === "done" ? 2.2 : undefined} />
        <span className="sr-only">{TICK_LABELS[mark]}: </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/checklist/${task.step.id}`}
          className={`w-fit font-bold leading-snug after:absolute after:inset-0 after:rounded-xl ${
            mark === "done" ? "text-muted line-through decoration-line-strong" : mark === "locked" ? "text-muted" : "text-ink"
          }`}
        >
          {task.step.title}
        </Link>
        {children ? <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">{children}</div> : null}
      </div>
      <Icon name="chevron" className="text-faint" />
    </li>
  );
}

const FACT = "inline-flex items-center gap-1.5";

function Meta({ task }: { task: PricedTask }) {
  const kind = KIND_LABELS[task.kind];
  return (
    <>
      <span className={FACT}>
        <Icon name="clock" size="xs" className="text-faint" />
        <span aria-hidden="true">~{formatMinutes(task.minutes)}</span>
        <span className="sr-only">About {formatMinutes(task.minutes)} of your time</span>
      </span>
      {task.feeCents !== null ? (
        <span className={FACT}>
          <Icon name="dollar" size="xs" className="text-faint" />
          {formatFee(task.feeCents)}
          <span className="sr-only"> fee</span>
        </span>
      ) : null}
      {kind ? <span className="font-semibold text-check">{kind}</span> : null}
      {task.step.agency ? (
        <span className="flex min-w-0 items-start gap-1.5">
          <Icon name="building" size="xs" className="mt-[3px] text-faint" />
          {task.step.agency}
        </span>
      ) : null}
    </>
  );
}

function Submitted({ task }: { task: PricedTask }) {
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <Icon name="hourglass" size="xs" className="mt-[3px] text-check" />
      <span>
        {task.step.submittedAt ? (
          <>
            Submitted <LocalDate iso={task.step.submittedAt.toISOString()} />, waiting to hear back
          </>
        ) : (
          "Submitted, waiting to hear back"
        )}
      </span>
    </span>
  );
}

function DoneNote({ task }: { task: PricedTask }) {
  return (
    <span className={FACT}>
      <Icon name="check" size="xs" className="text-done" />
      {task.step.completedAt ? (
        <>
          Done <LocalDate iso={task.step.completedAt.toISOString()} />
        </>
      ) : (
        "Done"
      )}
    </span>
  );
}
