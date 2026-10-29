import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { NextActionGroups, PlanCosts, StepGroup } from "@/components/plan/next-actions";
import { NextStep } from "@/components/plan/plan-summary";
import { ReviewChanges } from "@/components/plan/review-changes";
import { stepStates } from "@/components/plan/step-state";
import { PenCheck, StepRow } from "@/components/plan/step-row";
import { PracticeBanner } from "@/components/practice-banner";
import { ResearchRunStatus } from "@/components/requirements/research-run";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, Chip, Fold, IconTile, PageHead } from "@/components/ui";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import { getMyBusiness, getMyDetails, getMyPlan, getMyResearch, lastMyRun } from "@/lib/data/my-business";
import type { PlanStep } from "@/lib/data/plan";
import type { BusinessStructure } from "@/lib/domain";
import { formsFor } from "@/lib/documents/form-catalog";
import { placeOf, STRUCTURE_NAMES, structureOf } from "@/lib/research/applicability";
import { type ActionStep, type NextActions, nextActions, planCosts } from "@/lib/rules/next-action";
import { formatMinutes, remainingWork } from "@/lib/rules/progress";
import { sectionMetadata } from "@/lib/sections";
import { replanAction } from "../requirements/actions";
import { savePlanPdfAction } from "./actions";

export const metadata = sectionMetadata("/checklist");

export default function ChecklistPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHead
        kicker={
          <span className="inline-flex items-center gap-2">
            <Icon name="checklist" size="sm" />
            Step 4 of 5
          </span>
        }
        title="Your startup plan"
        lead="What to do next, what can happen at the same time, and what it costs, from your researched requirements."
      />
      <Suspense fallback={<p className="text-muted">Loading your plan…</p>}>
        <Plan />
      </Suspense>
    </div>
  );
}

async function Plan() {
  const [business, plan, research, run, details] = await Promise.all([getMyBusiness(), getMyPlan(), getMyResearch(), lastMyRun("research", null), getMyDetails()]);

  if (!business || !plan) {
    return (
      <Card>
        <p>Tell us about your business first. Your answers decide which steps go in your plan.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }

  const states = stepStates([...plan.steps, ...plan.retired]);
  const doneCount = plan.steps.filter((step) => step.status === "done").length;
  const work = remainingWork(plan.steps);
  // The steps themselves say whether they came from practice mode; the latest check may not have been applied
  const practice = plan.steps.some((step) => step.simulated);
  const where = business.profile ? placeOf(business.profile) : null;
  const structure = business.profile ? structureOf(business.profile, details).structure : null;
  const formOf = (step: PlanStep) => (where ? (formsFor(OFFICIAL_FORMS, step, where, structure).find((form) => !form.kept) ?? null) : null);
  const actionSteps = plan.steps.map((step) => {
    const form = formOf(step);
    return {
      ...step,
      // A fee confirmed by research wins; otherwise the hand-checked catalog's, which also has its date
      feeCents: step.feeCents ?? form?.fee?.cents ?? null,
      renewal: step.renewal ?? (form?.renewal ? { text: form.renewal.text, feeCents: form.renewal.cents } : null),
      formKey: form?.key ?? null,
    };
  });
  const actions = nextActions(actionSteps);
  const costs = planCosts(actionSteps);
  const decision = business.profile ? structureOf(business.profile, details).structure : null;
  // Research saved before decisions were recorded (no profile) can't say what changed
  const decided = research?.profile && research.structure !== decision && !plan.proposal;

  return (
    <>
      <ResearchRunStatus run={run} retryHref="/requirements" />
      {practice ? <PracticeBanner what="Steps in this plan came from practice results." /> : null}

      {plan.proposal ? (
        <ReviewChanges
          key={plan.proposal.checkedAt.toISOString()}
          checkedAt={plan.proposal.checkedAt.toISOString()}
          changes={plan.proposal.changes}
          from={plan.proposal.from}
        />
      ) : null}

      {decided ? (
        <section
          aria-labelledby="decided-heading"
          className="flex flex-col gap-3 rounded-2xl border border-accent-ring bg-surface p-5 shadow-[0_0_0_4px_var(--color-accent-tint),var(--shadow-card)] sm:p-6"
        >
          <div className="flex items-center gap-3">
            <IconTile icon="scale" />
            <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">Needs your OK</p>
          </div>
          <h2 id="decided-heading" className="font-display text-[22px] leading-snug">
            Your business structure changed
          </h2>
          <p className="text-muted">
            Your plan was built for {structureName(research.structure)}, and you’ve now chosen {structureName(decision)}. Update the plan to see which
            formation steps change. You review every change first.
          </p>
          <ActionButton action={replanAction} label="Show the changes" pendingLabel="Working it out…" variant="primary" />
        </section>
      ) : null}

      {plan.steps.length === 0 ? (
        plan.proposal ? null : (
          <Card>
            <p>
              {research
                ? "Your last check didn’t turn up any steps. Check your requirements again to build your plan."
                : "Your plan is built from the requirements that apply to your business. Find them first, and your steps show up here in order."}
            </p>
            <Link href="/requirements" className={PRIMARY_LINK}>
              Find my requirements
              <Icon name="arrow" size="sm" />
            </Link>
          </Card>
        )
      ) : (
        <>
          <div className="-mt-2 flex flex-wrap items-center gap-2">
            <Chip tone="done" icon="check">
              {doneCount} of {plan.steps.length} done
            </Chip>
            {work.left.length ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13.5px] font-semibold leading-tight text-rule">
                <Icon name="clock" size="xs" />
                {work.left.length} left before your first sale · about {formatMinutes(work.minutes)} of your time
              </span>
            ) : null}
            {work.waiting.length ? (
              <Chip tone="warn" icon="hourglass">
                {work.waiting.length} waiting to hear back
              </Chip>
            ) : null}
          </div>
          <div aria-hidden="true" className="-mt-2 h-1.5 overflow-hidden rounded-full bg-wash">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((doneCount / plan.steps.length) * 100)}%` }} />
          </div>

          {actions.first ? (
            <NextStep step={plan.steps.find((step) => step.id === actions.first!.id)!} parallel={Math.max(0, actions.now.length - 1)} />
          ) : doneCount === plan.steps.length ? (
            <section aria-label="Plan finished" className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-lift">
              <span className="grid size-11 shrink-0 place-items-center rounded-full border-[1.5px] border-done/25 bg-done-tint text-done">
                <PenCheck size={26} />
              </span>
              <p className="font-display text-[22px] leading-snug">You’ve finished every step in your plan.</p>
            </section>
          ) : null}

          <NextActionGroups actions={{ ...actions, ...byId(plan.steps, actions) }} />
          <PlanCosts costs={costs} />

          <Fold title={`All steps in order (${plan.steps.length})`} summary="Every step, numbered in the order they come" icon="list">
            <ol className="grid gap-2.5">
              {plan.steps.map((step, index) => {
                const state = states.get(step.key);
                return (
                  <StepRow
                    key={step.id}
                    step={step}
                    number={index + 1}
                    state={!state || state.state === "ready" ? "ready" : state.state === "waiting" ? "locked" : state.state}
                    lockedBy={state?.state === "waiting" ? state.waitingOn : []}
                  />
                );
              })}
            </ol>
          </Fold>

          <Fold title="How this plan was made" summary="Who drafted the steps, and who decides" icon="info">
            <ul aria-label="Who did what" className="flex flex-col gap-2 text-[15px]">
              <li className="flex items-center gap-2.5">
                {practice ? (
                  <>
                    <ActorChip actor="rule" /> drafted the steps in practice mode
                  </>
                ) : (
                  <>
                    <ActorChip actor="ai" /> drafted the steps from official pages
                  </>
                )}
              </li>
              <li className="flex items-center gap-2.5">
                <ActorChip actor="rule" /> decided what applies and the order
              </li>
              <li className="flex items-center gap-2.5">
                <ActorChip actor="owner" /> submit each one and record it
              </li>
            </ul>
            <p className="text-sm text-muted">Times are rough estimates of your own hands-on time. Time waiting on an office isn’t counted.</p>
          </Fold>

          <Card title="Keep a copy" icon="file" id="save-plan">
            <p className="text-muted">Save your plan as a PDF to print or bring along. A copy goes in your Documents.</p>
            <ActionButton
              action={savePlanPdfAction}
              label="Save as PDF"
              pendingLabel="Saving…"
              pendingStatus="Making a PDF of your plan. It opens when it’s ready."
              openDocument
            />
          </Card>
        </>
      )}

      {plan.retired.length ? (
        <StepGroup
          level={2}
          id="retired-steps"
          title="Finished steps no longer in your plan"
          help="A later check left these out. You’d already finished them, so they stay here for your records."
          icon="check"
          tone="done"
          count={plan.retired.length}
        >
          <ul className="grid gap-2.5">
            {plan.retired.map((step) => (
              <StepRow key={step.id} step={step} state="done" />
            ))}
          </ul>
        </StepGroup>
      ) : null}
    </>
  );
}

function structureName(structure: string | null): string {
  return structure && structure in STRUCTURE_NAMES ? STRUCTURE_NAMES[structure as BusinessStructure] : "an undecided structure";
}

// The groups hold priced copies; the page shows the stored steps
function byId(steps: readonly PlanStep[], actions: NextActions<ActionStep & { id: string }>): NextActions<PlanStep> {
  const find = (id: string) => steps.find((step) => step.id === id)!;
  return {
    now: actions.now.map((step) => find(step.id)),
    decide: actions.decide.map((step) => find(step.id)),
    submitted: actions.submitted.map((step) => find(step.id)),
    waiting: actions.waiting.map((each) => ({ step: find(each.step.id), on: each.on.map((on) => find(on.id)) })),
    later: actions.later.map((step) => find(step.id)),
    optional: actions.optional.map((step) => find(step.id)),
    done: actions.done.map((step) => find(step.id)),
    first: actions.first ? find(actions.first.id) : null,
  };
}
