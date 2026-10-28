import Link from "next/link";
import { LocalDate } from "@/components/local-date";
import { CARD, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import type { PlanStep } from "@/lib/data/plan";
import { formatFee } from "@/lib/documents/startup-plan";
import type { Costs, NextActions } from "@/lib/rules/next-action";
import { Tick } from "./journey";
import { PlanProgress } from "./plan-summary";

const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });
const STEP_LINK = "flex min-h-11 w-fit items-center font-semibold underline-offset-4 hover:underline";

interface Props {
  actions: NextActions<PlanStep>;
  costs: Costs;
  beforeSelling: { done: number; total: number };
}

// Every step at a glance: what's left to do, what's waiting, and what's done
export function StepBoard({ actions, costs, beforeSelling }: Props) {
  const toDo = [...actions.now, ...actions.decide];
  // Submitted steps wait on the office, the rest on other steps
  const blocked = [...actions.submitted.map((step) => ({ step, on: null })), ...actions.waiting];
  const waiting = blocked.filter(({ step }) => needed(step));
  const done = actions.done.filter(needed);
  // Everything that isn't needed before selling, whatever its state
  const later: { step: PlanStep; mark: "later" | "waiting" | "done"; on: PlanStep[] | null }[] = [
    ...[...actions.later, ...actions.optional].map((step) => ({ step, mark: "later" as const, on: null })),
    ...blocked.filter(({ step }) => !needed(step)).map(({ step, on }) => ({ step, mark: "waiting" as const, on })),
    ...actions.done.filter((step) => !needed(step)).map((step) => ({ step, mark: "done" as const, on: null })),
  ];

  return (
    <section aria-labelledby="board-heading" className={`flex flex-col gap-5 ${CARD}`}>
      <div className="flex flex-col gap-2">
        <h2 id="board-heading" className={SECTION_TITLE}>
          Your steps before your first sale
        </h2>
        <PlanProgress done={beforeSelling.done} total={beforeSelling.total} />
      </div>

      <Column id="todo-heading" title="To do" count={toDo.length} empty="Nothing to do right now.">
        {toDo.map((step) => (
          <Row key={step.id} step={step} mark="todo">
            <Meta step={step} />
            {step.requirementStatus === "conditional" && step.conditions[0] ? <p className="text-sm text-rule">First check: {step.conditions[0]}</p> : null}
            <Link href={`/checklist/${step.id}#progress-heading`} className={`flex min-h-11 w-fit items-center text-sm ${TEXT_LINK}`}>
              Already done this? Mark it done
            </Link>
          </Row>
        ))}
      </Column>

      {waiting.length ? (
        <Column id="waiting-board-heading" title="Waiting" count={waiting.length}>
          {waiting.map(({ step, on }) => (
            <Row key={step.id} step={step} mark="waiting">
              <WaitingNote step={step} on={on} />
            </Row>
          ))}
        </Column>
      ) : null}

      <Column id="done-heading" title="Done" count={done.length} empty="Nothing marked done yet. Mark each step when you finish it.">
        {done.map((step) => (
          <Row key={step.id} step={step} mark="done">
            <DoneNote step={step} />
          </Row>
        ))}
      </Column>

      {later.length ? (
        <details className="group">
          <summary className="flex min-h-11 w-fit cursor-pointer items-center font-semibold underline underline-offset-4">
            For later, and optional ({later.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {later.map(({ step, mark, on }) => (
              <Row key={step.id} step={step} mark={mark}>
                {mark === "done" ? <DoneNote step={step} /> : mark === "waiting" ? <WaitingNote step={step} on={on} /> : <Meta step={step} />}
              </Row>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="text-[15px] text-rule">
        Fees confirmed so far: {formatFee(costs.startupCents)}
        {costs.yearlyCents ? `, then ${formatFee(costs.yearlyCents)} a year` : ""}
        {costs.unknown.length ? ` (${costs.unknown.length} not confirmed yet)` : ""}
      </p>
      <Link href="/checklist" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
        See your full startup plan
      </Link>
    </section>
  );
}

// Counted in the progress bar: required, and needed before selling
function needed(step: PlanStep): boolean {
  return step.timing === "before_selling" && step.requirementStatus !== "optional" && step.requirementStatus !== "outside_coverage";
}

function WaitingNote({ step, on }: { step: PlanStep; on: PlanStep[] | null }) {
  return (
    <p className="text-sm text-rule">
      {on ? (
        `Starts after ${LIST.format(on.map((each) => `“${each.title}”`))}`
      ) : step.submittedAt ? (
        <>
          Submitted <LocalDate iso={step.submittedAt.toISOString()} />, waiting to hear back
        </>
      ) : (
        "Submitted, waiting to hear back"
      )}
    </p>
  );
}

function DoneNote({ step }: { step: PlanStep }) {
  return step.completedAt ? (
    <p className="text-sm text-rule">
      Done <LocalDate iso={step.completedAt.toISOString()} />
    </p>
  ) : null;
}

function Column({ id, title, count, empty, children }: { id: string; title: string; count: number; empty?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-lg font-bold">
        {title} <span className="font-normal text-muted">({count})</span>
      </h3>
      {count ? <ul className="flex flex-col gap-2">{children}</ul> : <p className="text-[15px] text-muted">{empty}</p>}
    </section>
  );
}

const MARKS = {
  todo: "bg-surface ring-2 ring-accent",
  waiting: "bg-rule-tint text-rule",
  done: "bg-accent text-white",
  later: "bg-surface ring-1 ring-ink/20",
} as const;

const MARK_LABELS = { todo: "To do", waiting: "Waiting", done: "Done", later: "Later or optional" } as const;

function Row({ step, mark, children }: { step: PlanStep; mark: keyof typeof MARKS; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-xl bg-ground px-3.5 py-2.5">
      <span className={`mt-3 flex size-5 shrink-0 items-center justify-center rounded-full ${MARKS[mark]}`}>
        {mark === "done" ? <Tick /> : null}
        <span className="sr-only">{MARK_LABELS[mark]}: </span>
      </span>
      <div className="flex min-w-0 flex-col">
        <Link href={`/checklist/${step.id}`} className={`${STEP_LINK} ${mark === "done" ? "text-rule" : ""}`}>
          {step.title}
        </Link>
        {children}
      </div>
    </li>
  );
}

function Meta({ step }: { step: PlanStep }) {
  const facts = [step.agency, step.feeCents === null ? null : `Fee ${formatFee(step.feeCents)}`].filter(Boolean);
  return facts.length ? <p className="text-sm text-muted">{facts.join(" · ")}</p> : null;
}
