import Link from "next/link";
import { RequirementStatusChip } from "@/components/requirements/requirement-status";
import { SECTION_TITLE } from "@/components/styles";
import type { PlanStep } from "@/lib/data/plan";
import { formatFee } from "@/lib/documents/startup-plan";
import type { Costs, NextActions } from "@/lib/rules/next-action";
import { formatMinutes, stepMinutes } from "@/lib/rules/progress";
import { Lock } from "./lock";

const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });
const LINK = "flex min-h-11 w-fit items-center font-semibold underline underline-offset-4";

function StepLine({ step, extra, locked }: { step: PlanStep; extra?: string; locked?: boolean }) {
  return (
    <li className={`flex flex-col gap-1 rounded-xl px-3.5 py-2 ring-1 ring-ink/5 ${locked ? "bg-ground" : "bg-surface"}`}>
      <Link href={`/checklist/${step.id}`} className={`${LINK} ${locked ? "gap-2 text-muted" : ""}`}>
        {locked ? (
          <span title={extra} className="text-muted">
            <Lock />
          </span>
        ) : null}
        {step.title}
      </Link>
      <div className="flex flex-wrap items-center gap-2 pb-1 text-sm text-muted">
        <RequirementStatusChip status={step.requirementStatus} />
        {step.feeCents !== null ? <span>Fee {formatFee(step.feeCents)}</span> : null}
        {step.status === "todo" ? <span>About {formatMinutes(stepMinutes(step))}</span> : null}
        {extra ? <span>{extra}</span> : null}
      </div>
    </li>
  );
}

function Group({ id, title, help, steps, extra, locked }: { id: string; title: string; help: string; steps: PlanStep[]; extra?: (step: PlanStep) => string; locked?: boolean }) {
  if (!steps.length) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 id={id} className="text-lg font-bold">
          {title} <span className="font-normal text-muted">({steps.length})</span>
        </h3>
        <p className="text-sm text-muted">{help}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {steps.map((step) => (
          <StepLine key={step.id} step={step} extra={extra?.(step)} locked={locked} />
        ))}
      </ul>
    </section>
  );
}

// What to do now, what can happen at the same time, and what waits
export function NextActionGroups({ actions }: { actions: NextActions<PlanStep> }) {
  return (
    <section aria-labelledby="next-heading" className="flex flex-col gap-4">
      <h2 id="next-heading" className={SECTION_TITLE}>
        Before your first sale
      </h2>
      <Group id="now-heading" title="You can do these now, in any order" help="Nothing has to come first, so they can happen at the same time." steps={actions.now} />
      <Group
        id="decide-heading"
        title="Check these first"
        help="Each depends on an answer or a decision. Open one to see what."
        steps={actions.decide}
      />
      <Group
        id="submitted-heading"
        title="Submitted, waiting to hear back"
        help="You told us you submitted these. Mark each approved when the office confirms."
        steps={actions.submitted}
      />
      <Group
        id="waiting-heading"
        title="Locked until another step is done"
        help="Each one opens once the step it needs is finished. You can still read ahead."
        steps={actions.waiting.map((each) => each.step)}
        extra={(step) => `Finish ${LIST.format(actions.waiting.find((each) => each.step.id === step.id)!.on.map((on) => `“${on.title}”`))} first`}
        locked
      />
      {actions.later.length || actions.optional.length ? (
        <details className="group rounded-2xl bg-surface p-4 ring-1 ring-ink/5">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
            Later, and optional ({actions.later.length + actions.optional.length})
          </summary>
          <div className="mt-2 flex flex-col gap-4">
            <Group id="later-heading" title="After you start selling" help="Ongoing obligations and steps for later, like renewals or hiring." steps={actions.later} />
            <Group
              id="optional-heading"
              title="Optional, or outside what First Sale checks"
              help="Not needed before selling. Each one says why it’s here."
              steps={actions.optional}
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}

// Fees confirmed on official pages; unknown fees are listed, never guessed
export function PlanCosts({ costs }: { costs: Costs }) {
  return (
    <section aria-labelledby="costs-heading" className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-ink/5">
      <h2 id="costs-heading" className={SECTION_TITLE}>
        What it costs
      </h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col rounded-xl bg-ground px-3.5 py-3">
          <dt className="text-sm font-semibold text-muted">To get started</dt>
          <dd className="font-display text-2xl font-bold">{costs.startupCents ? formatFee(costs.startupCents) : "$0"}</dd>
          <dd className="text-sm text-rule">Fees confirmed on official pages</dd>
        </div>
        <div className="flex flex-col rounded-xl bg-ground px-3.5 py-3">
          <dt className="text-sm font-semibold text-muted">Each year after that</dt>
          <dd className="font-display text-2xl font-bold">{costs.yearlyCents ? formatFee(costs.yearlyCents) : "None found"}</dd>
          <dd className="text-sm text-rule">Renewals, not counted twice in your first year</dd>
        </div>
      </dl>
      {costs.startup.length || costs.yearly.length ? (
        <details className="group">
          <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-accent-ink underline underline-offset-4">How it adds up</summary>
          <ul className="mt-1 flex flex-col gap-1 text-[15px]">
            {costs.startup.map((line) => (
              <li key={`s-${line.title}`}>
                {line.title}: {formatFee(line.cents)}
              </li>
            ))}
            {costs.yearly.map((line) => (
              <li key={`y-${line.title}`}>
                {line.title}: {formatFee(line.cents)} a year
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {costs.maybe.length ? (
        <p className="text-[15px] text-rule">
          <span className="font-semibold">Maybe, if they apply:</span> {costs.maybe.map((line) => `${line.title} (${formatFee(line.cents)})`).join("; ")}
        </p>
      ) : null}
      {costs.unknown.length ? (
        <p className="text-[15px] text-check">
          <span className="font-semibold">Fee not confirmed yet:</span> {LIST.format(costs.unknown)}. The total leaves these out.
        </p>
      ) : null}
    </section>
  );
}
