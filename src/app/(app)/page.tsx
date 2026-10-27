import Link from "next/link";
import { Suspense } from "react";
import { ActorLegend } from "@/components/how-it-works";
import { NextStep, PlanProgress } from "@/components/plan/plan-summary";
import { stepStates } from "@/components/plan/step-state";
import { CARD, PRIMARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { getMyBusiness, getMyPlan, type MyBusiness } from "@/lib/data/my-business";
import type { PlanView } from "@/lib/data/plan";
import { displayName, profileToAnswers, summarize } from "@/lib/intake/answers";

const LABEL = "text-xs font-bold uppercase tracking-wider text-muted";

export default function Today() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-accent-ink">Today</p>
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight">
          Start your business one step at a time.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          See how far you’ve come, what to do next, and anything waiting for your OK.
        </p>
      </section>
      <ActorLegend />
      <Suspense fallback={<div className="h-28 max-w-2xl rounded-2xl bg-surface ring-1 ring-ink/5" />}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  const [business, plan] = await Promise.all([getMyBusiness(), getMyPlan()]);

  if (!business) {
    return (
      <Link href="/business/new" className={PRIMARY_LINK}>
        Tell us about your business
      </Link>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {plan?.proposal ? (
        <section aria-labelledby="waiting-heading" className="flex flex-col gap-2 rounded-2xl bg-ai-tint p-5 ring-1 ring-ai/15">
          <h2 id="waiting-heading" className="text-xs font-bold uppercase tracking-wider text-ai-ink">
            Waiting for your OK
          </h2>
          <p className="text-ai-ink">Your requirements were re-checked, and some changes to your plan need your review.</p>
          <Link href="/checklist" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
            Review the changes
          </Link>
        </section>
      ) : null}

      {plan && plan.steps.length ? (
        <Progress plan={plan} />
      ) : (
        <section aria-labelledby="find-heading" className={`flex flex-col gap-3 ${CARD}`}>
          <h2 id="find-heading" className={SECTION_TITLE}>
            Find out what you need to open
          </h2>
          <p className="text-muted">
            First Sale checks official government sites for the registrations, licenses and permits that apply to you, then
            puts them in order as your startup plan.
          </p>
          <Link href="/requirements" className={PRIMARY_LINK}>
            Find my requirements
          </Link>
        </section>
      )}

      <CurrentBusiness business={business} />

      <section aria-labelledby="documents-heading" className={`flex flex-col gap-1.5 ${CARD}`}>
        <h2 id="documents-heading" className={LABEL}>
          Documents
        </h2>
        <p>Forms you’re working on, and copies First Sale made for you, like your startup plan.</p>
        <Link href="/documents" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
          Go to your documents
        </Link>
      </section>
    </div>
  );
}

function Progress({ plan }: { plan: PlanView }) {
  const states = stepStates([...plan.steps, ...plan.retired]);
  const done = plan.steps.filter((step) => step.status === "done").length;
  const next = plan.steps.find((step) => states.get(step.key)?.state === "ready");

  return (
    <>
      <section aria-labelledby="progress-heading" className={`flex flex-col gap-2 ${CARD}`}>
        <h2 id="progress-heading" className={LABEL}>
          Setup progress
        </h2>
        <PlanProgress done={done} total={plan.steps.length} />
        <Link href="/checklist" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
          See your startup plan
        </Link>
      </section>
      {next ? (
        <NextStep step={next} />
      ) : done === plan.steps.length ? (
        <p className="rounded-2xl bg-accent-tint p-5 font-semibold text-accent-ink">You’ve finished every step in your plan.</p>
      ) : null}
    </>
  );
}

function CurrentBusiness({ business }: { business: MyBusiness }) {
  const rows = business.profile ? summarize(profileToAnswers(business.profile)) : [];
  const detail = rows
    .filter((row) => row.step === "place" || row.step === "sell")
    .map((row) => row.value)
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-labelledby="current-business" className={`flex flex-col gap-2 ${CARD}`}>
      <p className={LABEL}>Working on</p>
      <h2 id="current-business" className="font-display text-2xl font-bold">
        {displayName(business.profile)}
      </h2>
      {detail ? <p className="text-rule">{detail}</p> : null}
      <Link href="/business" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
        See your business
      </Link>
    </section>
  );
}
