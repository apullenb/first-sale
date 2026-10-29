import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { TEXT_LINK } from "@/components/styles";
import { Fold, Note } from "@/components/ui";
import type { PlanStep } from "@/lib/data/plan";
import { formatFee } from "@/lib/documents/startup-plan";
import type { Costs, NextActions } from "@/lib/rules/next-action";
import { formatMinutes, neededBeforeSelling, stepMinutes } from "@/lib/rules/progress";
import { alreadyDoneHref } from "./journey";
import { TOPIC_ICONS } from "./topic-icon";

const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

interface Props {
  actions: NextActions<PlanStep>;
  costs: Costs;
  // The step "Do this next" already shows
  skip?: string | null;
}

type Mark = "todo" | "waiting" | "locked" | "done" | "later";

// Every other step as a row: ready now, waiting on an office, locked behind another step, done, and for later
export function StepBoard({ actions, costs, skip = null }: Props) {
  const ready = [...actions.now, ...actions.decide];
  const toDo = ready.filter((step) => step.id !== skip);
  // Submitted steps wait on the office, the rest on other steps
  const blocked: { step: PlanStep; on: PlanStep[] | null }[] = [...actions.submitted.map((step) => ({ step, on: null })), ...actions.waiting];
  const submitted = blocked.filter(({ step, on }) => !on && neededBeforeSelling(step));
  const locked = blocked.filter(({ step, on }) => on && neededBeforeSelling(step));
  const done = actions.done.filter(neededBeforeSelling);
  // Everything that isn't needed before selling, whatever its state
  const later: { step: PlanStep; mark: Mark; on: PlanStep[] | null }[] = [
    ...[...actions.later, ...actions.optional].map((step) => ({ step, mark: "later" as const, on: null })),
    ...blocked.filter(({ step }) => !neededBeforeSelling(step)).map(({ step, on }) => ({ step, mark: on ? ("locked" as const) : ("waiting" as const), on })),
    ...actions.done.filter((step) => !neededBeforeSelling(step)).map((step) => ({ step, mark: "done" as const, on: null })),
  ];

  return (
    <div className="flex flex-col gap-6">
      {toDo.length || submitted.length || locked.length ? (
        <div className="grid items-start gap-6 @3xl:grid-cols-2">
          {toDo.length ? (
            <Group id="now-heading" title={toDo.length < ready.length ? "You can also do now" : "Ready to do now"} count={toDo.length}>
              {toDo.map((step) => (
                <Row key={step.id} step={step} mark="todo">
                  <Meta step={step} />
                  <Link href={alreadyDoneHref(step)} className={`relative z-10 -my-3 py-3 text-sm ${TEXT_LINK}`}>
                    Already done?<span className="sr-only"> Mark “{step.title}” done</span>
                  </Link>
                  {step.requirementStatus === "conditional" && step.conditions[0] ? <span className="basis-full text-rule">First check: {step.conditions[0]}</span> : null}
                </Row>
              ))}
            </Group>
          ) : null}
          {submitted.length || locked.length ? (
            <div className="flex flex-col gap-6">
              {submitted.length ? (
                <Group id="board-waiting-heading" title="Waiting to hear back" count={submitted.length}>
                  {submitted.map(({ step }) => (
                    <Row key={step.id} step={step} mark="waiting">
                      <WaitingNote step={step} on={null} />
                    </Row>
                  ))}
                </Group>
              ) : null}
              {locked.length ? (
                <Group id="locked-heading" title="Unlocks later" count={locked.length}>
                  {locked.map(({ step, on }) => (
                    <Row key={step.id} step={step} mark="locked">
                      <WaitingNote step={step} on={on} />
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
              {done.map((step) => (
                <Row key={step.id} step={step} mark="done">
                  <DoneNote step={step} />
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
          <Fold title={`For later, and optional (${later.length})`} summary="After your first sale, or not required" icon="info">
            <ul className="grid gap-2.5">
              {later.map(({ step, mark, on }) => (
                <Row key={step.id} step={step} mark={mark}>
                  {mark === "done" ? <DoneNote step={step} /> : mark === "later" ? <Meta step={step} /> : <WaitingNote step={step} on={on} />}
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
          {costs.unknown.length ? ` (${costs.unknown.length} not confirmed yet)` : ""}
        </p>
        <Link href="/checklist" className={`flex min-h-11 items-center ${TEXT_LINK}`}>
          See your full startup plan
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
  todo: "border-line-strong bg-surface text-accent",
  later: "border-line bg-surface text-faint",
  waiting: "border-check-ring bg-check-tint text-check",
  locked: "border-transparent bg-wash text-faint",
  done: "border-done/25 bg-done-tint text-done",
};

const TICK_LABELS: Record<Mark, string> = { todo: "To do", waiting: "Waiting to hear back", locked: "Locked", done: "Done", later: "Later or optional" };

// A step as one ruled row; the whole row opens the step, and links inside it sit on top
function Row({ step, mark, children }: { step: PlanStep; mark: Mark; children?: ReactNode }) {
  const icon: IconName = mark === "done" ? "check" : mark === "waiting" ? "hourglass" : mark === "locked" ? "lock" : TOPIC_ICONS[step.topic];
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
          href={`/checklist/${step.id}`}
          className={`w-fit font-bold leading-snug after:absolute after:inset-0 after:rounded-xl ${
            mark === "done" ? "text-muted line-through decoration-line-strong" : mark === "locked" ? "text-muted" : "text-ink"
          }`}
        >
          {step.title}
        </Link>
        {children ? <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">{children}</div> : null}
      </div>
      <Icon name="chevron" className="text-faint" />
    </li>
  );
}

const FACT = "inline-flex items-center gap-1.5";

function Meta({ step }: { step: PlanStep }) {
  return (
    <>
      <span className={FACT}>
        <Icon name="clock" size="xs" className="text-faint" />
        <span aria-hidden="true">~{formatMinutes(stepMinutes(step))}</span>
        <span className="sr-only">About {formatMinutes(stepMinutes(step))} of your time</span>
      </span>
      {step.feeCents !== null ? (
        <span className={FACT}>
          <Icon name="dollar" size="xs" className="text-faint" />
          {formatFee(step.feeCents)}
          <span className="sr-only"> fee</span>
        </span>
      ) : null}
      {step.agency ? (
        <span className="flex min-w-0 items-start gap-1.5">
          <Icon name="building" size="xs" className="mt-[3px] text-faint" />
          {step.agency}
        </span>
      ) : null}
    </>
  );
}

function WaitingNote({ step, on }: { step: PlanStep; on: PlanStep[] | null }) {
  return (
    <span className="flex min-w-0 items-start gap-1.5">
      <Icon name={on ? "lock" : "hourglass"} size="xs" className={`mt-[3px] ${on ? "text-faint" : "text-check"}`} />
      <span>
        {on ? (
          `Finish ${LIST.format(on.map((each) => `“${each.title}”`))} first`
        ) : step.submittedAt ? (
          <>
            Submitted <LocalDate iso={step.submittedAt.toISOString()} />, waiting to hear back
          </>
        ) : (
          "Submitted, waiting to hear back"
        )}
      </span>
    </span>
  );
}

function DoneNote({ step }: { step: PlanStep }) {
  return (
    <span className={FACT}>
      <Icon name="check" size="xs" className="text-done" />
      {step.completedAt ? (
        <>
          Done <LocalDate iso={step.completedAt.toISOString()} />
        </>
      ) : (
        "Done"
      )}
    </span>
  );
}
