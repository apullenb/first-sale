import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { NextActionGroups, PlanCosts } from "@/components/plan/next-actions";
import { NextStep, PlanProgress } from "@/components/plan/plan-summary";
import { ReviewChanges } from "@/components/plan/review-changes";
import { type StepState, StepStateLabel, stepStates } from "@/components/plan/step-state";
import { PracticeBanner } from "@/components/practice-banner";
import { RequirementStatusChip } from "@/components/requirements/requirement-status";
import { StatusChip } from "@/components/requirements/requirement-card";
import { ResearchRunStatus } from "@/components/requirements/research-run";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECTION_TITLE } from "@/components/styles";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import { getMyBusiness, getMyDetails, getMyPlan, getMyResearch, lastMyRun } from "@/lib/data/my-business";
import type { PlanStep } from "@/lib/data/plan";
import type { BusinessStructure } from "@/lib/domain";
import { formsFor } from "@/lib/documents/form-catalog";
import { formatFee } from "@/lib/documents/startup-plan";
import { LEVEL_LABELS, TOPIC_LABELS } from "@/lib/labels";
import { placeOf, STRUCTURE_NAMES, structureOf } from "@/lib/research/applicability";
import { type ActionStep, type NextActions, nextActions, planCosts } from "@/lib/rules/next-action";
import { sectionMetadata } from "@/lib/sections";
import { replanAction } from "../requirements/actions";
import { savePlanPdfAction } from "./actions";

export const metadata = sectionMetadata("/checklist");

export default function ChecklistPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Start your business · Step 4</p>
        <h1 className={PAGE_TITLE}>Your startup plan</h1>
        <p className="text-lg text-muted">What to do next, what can happen at the same time, and what it costs, from your researched requirements.</p>
      </div>
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
      <section className={`flex flex-col gap-3 ${CARD}`}>
        <p>Tell us about your business first. Your answers decide which steps go in your plan.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
        </Link>
      </section>
    );
  }

  const states = stepStates([...plan.steps, ...plan.retired]);
  const doneCount = plan.steps.filter((step) => step.status === "done").length;
  // The steps themselves say whether they came from practice mode; the latest check may not have been applied
  const practice = plan.steps.some((step) => step.simulated);
  const where = business.profile ? placeOf(business.profile) : null;
  const structure = business.profile ? structureOf(business.profile, details).structure : null;
  const formOf = (step: PlanStep) => (where ? (formsFor(OFFICIAL_FORMS, step, where, structure)[0] ?? null) : null);
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
        <section aria-labelledby="decided-heading" className="flex flex-col gap-3 rounded-2xl bg-ai-tint p-5 ring-1 ring-ai/15">
          <h2 id="decided-heading" className="font-display text-xl font-bold text-ai-ink">
            Your business structure changed
          </h2>
          <p className="text-ai-ink">
            Your plan was built for {structureName(research.structure)}, and you’ve now chosen {structureName(decision)}. Update the plan to see which
            formation steps change. You review every change first.
          </p>
          <ActionButton action={replanAction} label="Show the changes" pendingLabel="Working it out…" variant="primary" />
        </section>
      ) : null}

      {plan.steps.length === 0 ? (
        plan.proposal ? null : (
          <section className={`flex flex-col gap-3 ${CARD}`}>
            <p>
              {research
                ? "Your last check didn’t turn up any steps. Check your requirements again to build your plan."
                : "Your plan is built from the requirements that apply to your business. Find them first, and your steps show up here in order."}
            </p>
            <Link href="/requirements" className={PRIMARY_LINK}>
              Find my requirements
            </Link>
          </section>
        )
      ) : (
        <>
          <ul aria-label="Who did what" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li className="flex items-center gap-2">
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
            <li className="flex items-center gap-2">
              <ActorChip actor="rule" /> decided what applies and the order
            </li>
            <li className="flex items-center gap-2">
              <ActorChip actor="owner" /> submit each one and record it
            </li>
          </ul>

          <PlanProgress done={doneCount} total={plan.steps.length} />
          {actions.first ? (
            <NextStep step={plan.steps.find((step) => step.id === actions.first!.id)!} parallel={Math.max(0, actions.now.length - 1)} />
          ) : doneCount === plan.steps.length ? (
            <p className="rounded-2xl bg-accent-tint p-5 font-semibold text-accent-ink">You’ve finished every step in your plan.</p>
          ) : null}

          <NextActionGroups actions={{ ...actions, ...byId(plan.steps, actions) }} />
          <PlanCosts costs={costs} />

          <details className="group">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center font-semibold underline underline-offset-4">All steps in order ({plan.steps.length})</summary>
            <ol className="mt-2 flex flex-col gap-2.5">
              {plan.steps.map((step, index) => (
                <StepItem key={step.id} step={step} number={index + 1} state={states.get(step.key)} />
              ))}
            </ol>
          </details>

          <section aria-labelledby="save-plan" className={`flex flex-col gap-3 ${CARD}`}>
            <h2 id="save-plan" className={SECTION_TITLE}>
              Keep a copy
            </h2>
            <p className="text-muted">Save your plan as a PDF to print or bring along. A copy goes in your Documents.</p>
            <ActionButton
              action={savePlanPdfAction}
              label="Save as PDF"
              pendingLabel="Saving…"
              pendingStatus="Making a PDF of your plan. It opens when it’s ready."
              openDocument
            />
          </section>
        </>
      )}

      {plan.retired.length ? (
        <section aria-labelledby="retired-steps" className="flex flex-col gap-2.5">
          <h2 id="retired-steps" className={SECTION_TITLE}>
            Finished steps no longer in your plan
          </h2>
          <p className="text-muted">A later check of your requirements left these out. You’d already finished them, so they stay here for your records.</p>
          <ul className="flex flex-col gap-2">
            {plan.retired.map((step) => (
              <li key={step.id} className="flex flex-col gap-0.5 rounded-2xl bg-surface px-4 py-2 ring-1 ring-ink/5 sm:px-5">
                <Link href={`/checklist/${step.id}`} className="flex min-h-11 w-fit items-center font-semibold underline underline-offset-4">
                  {step.title}
                </Link>
                <p className="pb-1 text-sm text-muted">
                  Done
                  {step.completedAt ? (
                    <>
                      {" "}
                      on <LocalDate iso={step.completedAt.toISOString()} />
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </section>
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

function StepItem({ step, number, state }: { step: PlanStep; number: number; state: StepState | undefined }) {
  const facts = [TOPIC_LABELS[step.topic], LEVEL_LABELS[step.level], step.feeCents === null ? null : `Fee: ${formatFee(step.feeCents)}`].filter(Boolean);
  const done = state?.state === "done";
  return (
    <li className="flex gap-3.5 rounded-2xl bg-surface px-4 py-3 ring-1 ring-ink/5 sm:px-5">
      <span className={`mt-2 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-accent text-white" : "bg-rule-tint text-rule"}`}>
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link href={`/checklist/${step.id}`} className="flex min-h-11 w-fit items-center text-[17px] font-bold leading-snug underline underline-offset-4">
          {step.title}
        </Link>
        <p className="text-sm text-muted">{facts.join(" · ")}</p>
        <div className="flex flex-wrap items-center gap-2 pb-1">
          <RequirementStatusChip status={step.requirementStatus} />
          <StatusChip sourced={step.verification === "sourced"} />
          <StepStateLabel state={state} />
        </div>
      </div>
    </li>
  );
}
