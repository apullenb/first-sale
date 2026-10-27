import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { NextStep, PlanProgress } from "@/components/plan/plan-summary";
import { ReviewChanges } from "@/components/plan/review-changes";
import { type StepState, StepStateLabel, stepStates } from "@/components/plan/step-state";
import { PracticeBanner } from "@/components/practice-banner";
import { StatusChip } from "@/components/requirements/requirement-card";
import { ResearchRunStatus } from "@/components/requirements/research-run";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECTION_TITLE } from "@/components/styles";
import { getMyBusiness, getMyPlan, getMyResearch, lastMyRun } from "@/lib/data/my-business";
import type { PlanStep } from "@/lib/data/plan";
import { formatFee } from "@/lib/documents/startup-plan";
import { LEVEL_LABELS, TOPIC_LABELS } from "@/lib/labels";
import { sectionMetadata } from "@/lib/sections";
import { savePlanPdfAction } from "./actions";

export const metadata = sectionMetadata("/checklist");

export default function ChecklistPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Start your business · Step 4</p>
        <h1 className={PAGE_TITLE}>Your startup plan</h1>
        <p className="text-lg text-muted">
          Your steps in order, with who handles each one, what to have ready, and fees checked on official pages.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading your plan…</p>}>
        <Plan />
      </Suspense>
    </div>
  );
}

async function Plan() {
  const [business, plan, research, run] = await Promise.all([getMyBusiness(), getMyPlan(), getMyResearch(), lastMyRun("research", null)]);

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
  const next = plan.steps.find((step) => states.get(step.key)?.state === "ready");
  // The steps themselves say whether they came from practice mode; the latest check may not have been applied
  const practice = plan.steps.some((step) => step.simulated);

  return (
    <>
      <ResearchRunStatus run={run} retryHref="/requirements" />
      {practice ? <PracticeBanner what="Steps in this plan came from practice results." /> : null}

      {plan.proposal ? (
        <ReviewChanges
          key={plan.proposal.checkedAt.toISOString()}
          checkedAt={plan.proposal.checkedAt.toISOString()}
          changes={plan.proposal.changes}
        />
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
              <ActorChip actor="rule" /> put them in order
            </li>
            <li className="flex items-center gap-2">
              <ActorChip actor="owner" /> mark each one done
            </li>
          </ul>

          <PlanProgress done={doneCount} total={plan.steps.length} />
          {next ? (
            <NextStep step={next} />
          ) : doneCount === plan.steps.length ? (
            <p className="rounded-2xl bg-accent-tint p-5 font-semibold text-accent-ink">You’ve finished every step in your plan.</p>
          ) : null}

          <section aria-labelledby="all-steps" className="flex flex-col gap-2.5">
            <h2 id="all-steps" className={SECTION_TITLE}>
              All steps
            </h2>
            <ol className="flex flex-col gap-2.5">
              {plan.steps.map((step, index) => (
                <StepItem key={step.id} step={step} number={index + 1} state={states.get(step.key)} />
              ))}
            </ol>
          </section>

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
          <p className="text-muted">
            A later check of your requirements left these out. You’d already finished them, so they stay here for your
            records.
          </p>
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

function StepItem({ step, number, state }: { step: PlanStep; number: number; state: StepState | undefined }) {
  const facts = [TOPIC_LABELS[step.topic], LEVEL_LABELS[step.level], step.feeCents === null ? null : `Fee: ${formatFee(step.feeCents)}`].filter(Boolean);
  const done = state?.state === "done";
  return (
    <li className="flex gap-3.5 rounded-2xl bg-surface px-4 py-3 ring-1 ring-ink/5 sm:px-5">
      <span
        className={`mt-2 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done ? "bg-accent text-white" : "bg-rule-tint text-rule"
        }`}
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link href={`/checklist/${step.id}`} className="flex min-h-11 w-fit items-center text-[17px] font-bold leading-snug underline underline-offset-4">
          {step.title}
        </Link>
        <p className="text-sm text-muted">{facts.join(" · ")}</p>
        <div className="flex flex-wrap items-center gap-2 pb-1">
          <StatusChip sourced={step.verification === "sourced"} />
          <StepStateLabel state={state} />
        </div>
      </div>
    </li>
  );
}
