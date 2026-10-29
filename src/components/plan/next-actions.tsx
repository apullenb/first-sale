import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Card, IconTile } from "@/components/ui";
import type { PlanStep } from "@/lib/data/plan";
import { formatFee } from "@/lib/documents/startup-plan";
import type { Costs, NextActions } from "@/lib/rules/next-action";
import { type RowState, StepRow } from "./step-row";

const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

type Tone = "accent" | "gray" | "warn" | "done";

// A group of steps that folds away, like a part of the plan
export function StepGroup({
  id,
  title,
  help,
  icon,
  tone = "gray",
  open,
  count,
  level = 3,
  children,
}: {
  id: string;
  title: string;
  help: string;
  icon: IconName;
  tone?: Tone;
  open?: boolean;
  count: number;
  // 2 when the group stands on its own, not under a section heading
  level?: 2 | 3;
  children: ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <details id={id} open={open} className="group/fold scroll-mt-4 rounded-[14px] border border-line bg-surface shadow-soft">
      <summary className="flex min-h-[58px] cursor-pointer list-none items-center gap-3 px-[18px] py-3.5 [&::-webkit-details-marker]:hidden">
        <IconTile icon={icon} tone={tone} />
        <span className="grid min-w-0 flex-1 gap-px">
          <Heading className="text-[16.5px] font-bold">
            {title} <span className="font-semibold text-muted tabular-nums">({count})</span>
          </Heading>
          <small className="text-[14.5px] text-muted">{help}</small>
        </span>
        <Icon name="chevron" className="text-faint transition-transform group-open/fold:rotate-90 motion-reduce:transition-none" />
      </summary>
      <div className="px-[18px] pb-[18px]">{children}</div>
    </details>
  );
}

function Rows({ steps, state, on }: { steps: PlanStep[]; state: RowState; on?: (step: PlanStep) => PlanStep[] }) {
  return (
    <ul className="grid gap-2.5">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} state={state} lockedBy={on?.(step)} />
      ))}
    </ul>
  );
}

// What to do now, what can happen at the same time, and what waits
export function NextActionGroups({ actions }: { actions: NextActions<PlanStep> }) {
  const waitingOn = (step: PlanStep) => actions.waiting.find((each) => each.step.id === step.id)?.on ?? [];
  const groups = [
    {
      id: "now-steps",
      title: "Ready to do now",
      help: "Nothing has to come first, so they can happen at the same time, in any order.",
      icon: "list" as const,
      tone: "accent" as const,
      steps: actions.now,
      state: "ready" as const,
      open: true,
    },
    {
      id: "decide-steps",
      title: "Check these first",
      help: "Each depends on an answer or a decision. Open one to see what.",
      icon: "branch" as const,
      tone: "accent" as const,
      steps: actions.decide,
      state: "ready" as const,
      open: true,
    },
    {
      id: "submitted-steps",
      title: "Submitted, waiting to hear back",
      help: "You told us you submitted these. Mark each approved when the office confirms.",
      icon: "hourglass" as const,
      tone: "warn" as const,
      steps: actions.submitted,
      state: "submitted" as const,
      open: true,
    },
    {
      id: "locked-steps",
      title: "Locked until another step is done",
      help: "Each one opens once the step it needs is finished. You can still read ahead.",
      icon: "lock" as const,
      tone: "gray" as const,
      steps: actions.waiting.map((each) => each.step),
      state: "locked" as const,
      open: true,
    },
    {
      id: "later-steps",
      title: "After you start selling",
      help: "Ongoing obligations and steps for later, like renewals or hiring.",
      icon: "calendar" as const,
      tone: "gray" as const,
      steps: actions.later,
      state: "ready" as const,
      open: false,
    },
    {
      id: "optional-steps",
      title: "Optional, or outside what First Sale checks",
      help: "Not needed before selling. Each one says why it’s here.",
      icon: "info" as const,
      tone: "gray" as const,
      steps: actions.optional,
      state: "ready" as const,
      open: false,
    },
    {
      id: "done-steps",
      title: "Done",
      help: "Steps you’ve finished.",
      icon: "check" as const,
      tone: "done" as const,
      steps: actions.done,
      state: "done" as const,
      open: false,
    },
  ];
  return (
    <section aria-labelledby="next-heading" className="flex flex-col gap-3">
      <h2 id="next-heading" className="font-display text-[22px] leading-snug">
        Your steps
      </h2>
      {groups.map((group) =>
        group.steps.length ? (
          <StepGroup key={group.id} id={group.id} title={group.title} help={group.help} icon={group.icon} tone={group.tone} open={group.open} count={group.steps.length}>
            <Rows steps={group.steps} state={group.state} on={group.state === "locked" ? waitingOn : undefined} />
          </StepGroup>
        ) : null,
      )}
    </section>
  );
}

// Fees confirmed on official pages; unknown fees are listed, never guessed
export function PlanCosts({ costs }: { costs: Costs }) {
  return (
    <Card title="What it costs" icon="coins" id="costs-heading">
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-soft px-4 py-3">
          <dt className="text-sm font-semibold text-muted">To get started</dt>
          <dd className="font-display text-[32px] leading-tight tabular-nums">{costs.startupCents ? formatFee(costs.startupCents) : "$0"}</dd>
          <dd className="text-sm text-muted">Fees confirmed on official pages</dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-soft px-4 py-3">
          <dt className="text-sm font-semibold text-muted">Each year after that</dt>
          <dd className="font-display text-[32px] leading-tight tabular-nums">{costs.yearlyCents ? formatFee(costs.yearlyCents) : "None found"}</dd>
          <dd className="text-sm text-muted">Renewals, not counted twice in your first year</dd>
        </div>
      </dl>
      {costs.startup.length || costs.yearly.length ? (
        <details className="group/add">
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-accent [&::-webkit-details-marker]:hidden">
            <Icon name="chevron" size="sm" className="transition-transform group-open/add:rotate-90 motion-reduce:transition-none" />
            How it adds up
          </summary>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line px-4 text-[15px]">
            {costs.startup.map((line) => (
              <li key={`s-${line.title}`} className="flex flex-wrap justify-between gap-x-4 py-2.5">
                <span>{line.title}</span>
                <b className="tabular-nums">{formatFee(line.cents)}</b>
              </li>
            ))}
            {costs.yearly.map((line) => (
              <li key={`y-${line.title}`} className="flex flex-wrap justify-between gap-x-4 py-2.5">
                <span>{line.title}</span>
                <b className="tabular-nums">{formatFee(line.cents)} a year</b>
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
        <p className="flex items-start gap-2 text-[15px] text-check">
          <Icon name="info" size="sm" className="mt-0.5" />
          <span>
            <span className="font-semibold">Fee not confirmed yet:</span> {LIST.format(costs.unknown)}. The total leaves these out.
          </span>
        </p>
      ) : null}
    </Card>
  );
}
