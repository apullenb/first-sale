import Link from "next/link";
import { Suspense } from "react";
import { ActorLegend } from "@/components/how-it-works";
import { NextStep, PlanProgress } from "@/components/plan/plan-summary";
import { CARD, PRIMARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import { getMyBusiness, getMyDetails, getMyPlan, getMyResearch, listMyDocuments, type MyBusiness } from "@/lib/data/my-business";
import type { PlanView } from "@/lib/data/plan";
import { autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { formsFor } from "@/lib/documents/form-catalog";
import { formatFee } from "@/lib/documents/startup-plan";
import { displayName, profileToAnswers, summarize } from "@/lib/intake/answers";
import { placeOf, structureOf } from "@/lib/research/applicability";
import { answerChanges } from "@/lib/research/changes";
import { nextActions, planCosts } from "@/lib/rules/next-action";

const LABEL = "text-xs font-bold uppercase tracking-wider text-muted";

export default function Today() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-accent-ink">Today</p>
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight">Start your business one step at a time.</h1>
        <p className="max-w-2xl text-lg text-muted">Your next step, what’s waiting for your OK, and how far you’ve come.</p>
      </section>
      <ActorLegend />
      <Suspense fallback={<div className="h-28 max-w-2xl rounded-2xl bg-surface ring-1 ring-ink/5" />}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  const [business, plan, research, details, documents] = await Promise.all([getMyBusiness(), getMyPlan(), getMyResearch(), getMyDetails(), listMyDocuments()]);

  if (!business) {
    return (
      <Link href="/business/new" className={PRIMARY_LINK}>
        Tell us about your business
      </Link>
    );
  }

  const profile = business.profile;
  const decision = profile ? structureOf(profile, details).structure : null;
  const changes = research && profile ? answerChanges(research.profile, profile, (research.structure as typeof decision) ?? null, decision) : [];
  const facts = profile ? autofillFacts(profile, details) : [];
  const outdated = documents.filter((doc) => doc.role !== "reviewed" && outdatedFacts(doc.factsUsed, facts).length > 0);
  const toCheck = documents.filter((doc) => doc.role !== "reviewed" && Object.values(doc.answers).some((answer) => answer.state === "suggested"));
  const waiting: { text: string; href: string; action: string }[] = [];
  if (plan?.proposal) {
    waiting.push({
      text: plan.proposal.from === "replan" ? "Your decisions changed some steps in your plan. Review them first." : "Your requirements were re-checked, and some changes to your plan need your review.",
      href: "/checklist",
      action: "Review the changes",
    });
  }
  if (changes.length) {
    waiting.push({
      text: `Your answers changed since your requirements were checked (${changes.map((change) => change.what.toLowerCase()).join(", ")}).`,
      href: "/requirements",
      action: "See what it changes",
    });
  }
  if (outdated.length) {
    waiting.push({ text: `${outdated.length === 1 ? "A drafted form uses" : `${outdated.length} drafted forms use`} details you’ve since changed.`, href: `/documents/${outdated[0].id}`, action: "Update the answers" });
  } else if (toCheck.length) {
    waiting.push({ text: `${toCheck.length === 1 ? "A form has" : `${toCheck.length} forms have`} drafted answers waiting for you to check.`, href: `/documents/${toCheck[0].id}`, action: "Check the answers" });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {waiting.length ? (
        <section aria-labelledby="waiting-heading" className="flex flex-col gap-2 rounded-2xl bg-ai-tint p-5 ring-1 ring-ai/15">
          <h2 id="waiting-heading" className="text-xs font-bold uppercase tracking-wider text-ai-ink">
            Waiting for your OK
          </h2>
          <ul className="flex flex-col gap-2">
            {waiting.map((item) => (
              <li key={item.href + item.action} className="flex flex-col">
                <p className="text-ai-ink">{item.text}</p>
                <Link href={item.href} className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
                  {item.action}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan && plan.steps.length && profile ? (
        <Progress plan={plan} where={placeOf(profile)} structure={decision} />
      ) : (
        <section aria-labelledby="find-heading" className={`flex flex-col gap-3 ${CARD}`}>
          <h2 id="find-heading" className={SECTION_TITLE}>
            Find out what you need to open
          </h2>
          <p className="text-muted">
            First Sale checks official government sites for the registrations, licenses and permits that apply to you, then puts them in order as your startup plan.
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
        <p>
          {documents.length
            ? `${documents.length} ${documents.length === 1 ? "document" : "documents"}: official forms, your reviewed copies, receipts and approvals.`
            : "Official forms, your reviewed copies, receipts and approvals, kept by plan step."}
        </p>
        <Link href="/documents" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
          Go to your documents
        </Link>
      </section>
    </div>
  );
}

function Progress({ plan, where, structure }: { plan: PlanView; where: Parameters<typeof formsFor>[2]; structure: Parameters<typeof formsFor>[3] }) {
  const priced = plan.steps.map((step) => {
    const form = formsFor(OFFICIAL_FORMS, step, where, structure).find((each) => !each.kept) ?? null;
    return { ...step, feeCents: step.feeCents ?? form?.fee?.cents ?? null, formKey: form?.key ?? null };
  });
  const actions = nextActions(priced);
  const costs = planCosts(priced);
  const beforeSelling = plan.steps.filter((step) => step.timing === "before_selling" && step.requirementStatus !== "optional" && step.requirementStatus !== "outside_coverage");
  const done = beforeSelling.filter((step) => step.status === "done").length;
  const first = actions.first ? plan.steps.find((step) => step.id === actions.first!.id) : undefined;

  return (
    <>
      {first ? (
        <NextStep step={first} parallel={Math.max(0, actions.now.length - 1)} />
      ) : done === beforeSelling.length ? (
        <p className="rounded-2xl bg-accent-tint p-5 font-semibold text-accent-ink">You’ve finished every step you need before selling.</p>
      ) : null}
      <section aria-labelledby="progress-heading" className={`flex flex-col gap-2 ${CARD}`}>
        <h2 id="progress-heading" className={LABEL}>
          Before your first sale
        </h2>
        <PlanProgress done={done} total={beforeSelling.length} />
        <ul className="flex flex-col gap-0.5 text-[15px] text-rule">
          {actions.submitted.length ? <li>{actions.submitted.length} submitted, waiting to hear back</li> : null}
          {actions.decide.length ? <li>{actions.decide.length} depend on an answer or decision</li> : null}
          <li>
            Fees confirmed so far: {formatFee(costs.startupCents)}
            {costs.yearlyCents ? `, then ${formatFee(costs.yearlyCents)} a year` : ""}
            {costs.unknown.length ? ` (${costs.unknown.length} not confirmed yet)` : ""}
          </li>
        </ul>
        <Link href="/checklist" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
          See your startup plan
        </Link>
      </section>
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
