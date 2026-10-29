import Link from "next/link";
import { Suspense } from "react";
import { ActorLegend } from "@/components/how-it-works";
import { DashboardWidgets } from "@/components/plan/dashboard-widgets";
import { JourneyStages, StartHere } from "@/components/plan/journey";
import { StepBoard } from "@/components/plan/step-board";
import { CARD, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import { getMyBusiness, getMyDetails, getMyPlan, getMyResearch, listMyDocuments, type MyBusiness } from "@/lib/data/my-business";
import { autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { formsFor } from "@/lib/documents/form-catalog";
import { displayName, profileToAnswers, summarize } from "@/lib/intake/answers";
import { BUDGET_LABELS } from "@/lib/intake/options";
import { placeOf, structureOf } from "@/lib/research/applicability";
import { answerChanges } from "@/lib/research/changes";
import { type JourneyInput, journeyStages, nextMove } from "@/lib/rules/journey";
import { nextActions, planCosts } from "@/lib/rules/next-action";
import { budgetCapCents, remainingWork, spentCents } from "@/lib/rules/progress";

const LABEL = "text-xs font-bold uppercase tracking-wider text-muted";

export default function Today() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-accent-ink">Today</p>
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight">Start your business one step at a time.</h1>
        <p className="max-w-2xl text-lg text-muted">What to do next, what’s done, and what’s still left.</p>
      </section>
      <Suspense fallback={<div className="h-28 max-w-2xl rounded-2xl bg-surface ring-1 ring-ink/5" />}>
        <Overview />
      </Suspense>
      <ActorLegend />
    </div>
  );
}

async function Overview() {
  const [business, plan, research, details, documents] = await Promise.all([getMyBusiness(), getMyPlan(), getMyResearch(), getMyDetails(), listMyDocuments()]);

  const profile = business?.profile ?? null;
  const structure = profile ? structureOf(profile, details) : { structure: null, from: null };
  const decision = structure.structure;
  const changes = research && profile ? answerChanges(research.profile, profile, (research.structure as typeof decision) ?? null, decision) : [];
  const facts = profile ? autofillFacts(profile, details) : [];
  const outdated = documents.filter((doc) => doc.role !== "reviewed" && outdatedFacts(doc.factsUsed, facts).length > 0);
  const toCheck = documents.filter((doc) => doc.role !== "reviewed" && Object.values(doc.answers).some((answer) => answer.state === "suggested"));

  const where = profile ? placeOf(profile) : null;
  const priced = (plan?.steps ?? []).map((step) => {
    const form = where ? (formsFor(OFFICIAL_FORMS, step, where, decision).find((each) => !each.kept) ?? null) : null;
    return { ...step, feeCents: step.feeCents ?? form?.fee?.cents ?? null, formKey: form?.key ?? null };
  });
  const actions = nextActions(priced);
  const costs = planCosts(priced);
  const work = remainingWork(priced);
  const widgets =
    profile && priced.length ? (
      <DashboardWidgets
        left={work.left.length}
        minutes={work.minutes}
        waiting={work.waiting.length}
        spentCents={spentCents(priced)}
        toGoCents={costs.startupCents}
        unknownFees={costs.unknown.length}
        budgetCapCents={budgetCapCents(profile.startupBudget)}
        budgetLabel={profile.startupBudget ? BUDGET_LABELS[profile.startupBudget] : null}
        launchDate={profile.launchDate}
      />
    ) : null;
  const required = priced.filter((step) => step.timing === "before_selling" && step.requirementStatus !== "optional" && step.requirementStatus !== "outside_coverage");
  const beforeSelling = { total: required.length, done: required.filter((step) => step.status === "done").length };
  const first = actions.first;

  const input: JourneyInput = {
    business: !business ? "none" : profile ? "done" : "update",
    businessSummary: profile ? `Answers saved for ${displayName(profile)}.` : null,
    researched: Boolean(research),
    answersChanged: changes.length > 0,
    structure,
    plan: {
      steps: priced.length,
      proposal: Boolean(plan?.proposal),
      beforeSelling,
      first: first ? { id: first.id, title: first.title, later: first.timing === "later", structure: first.topic === "structure" } : null,
    },
    documents: { total: documents.length, waiting: new Set([...outdated, ...toCheck].map((doc) => doc.id)).size },
  };
  const move = nextMove(input);
  const moveStep = move.stepId ? priced.find((step) => step.id === move.stepId) : undefined;

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
  // The next move already points there
  const alsoWaiting = waiting.filter((item) => item.href !== move.href);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {/* Widgets above the next step on wider screens, below it on phones; one copy shows at a time */}
      {widgets ? <div className="hidden sm:block">{widgets}</div> : null}
      <StartHere move={move} step={moveStep} parallel={moveStep && moveStep.timing !== "later" ? Math.max(0, actions.now.length - 1) : 0} />
      {widgets ? <div className="sm:hidden">{widgets}</div> : null}

      {alsoWaiting.length ? (
        <section aria-labelledby="waiting-heading" className="flex flex-col gap-2 rounded-2xl bg-ai-tint p-5 ring-1 ring-ai/15">
          <h2 id="waiting-heading" className="text-xs font-bold uppercase tracking-wider text-ai-ink">
            Also waiting for your OK
          </h2>
          <ul className="flex flex-col gap-2">
            {alsoWaiting.map((item) => (
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

      <JourneyStages stages={journeyStages(input)} />

      {priced.length ? <StepBoard actions={actions} costs={costs} beforeSelling={beforeSelling} /> : null}

      {business ? (
        <>
          <section aria-labelledby="have-heading" className={`flex flex-col gap-2 ${CARD}`}>
            <h2 id="have-heading" className={SECTION_TITLE}>
              Already have some paperwork?
            </h2>
            <p className="text-rule">
              Not starting from scratch? Upload what you already have, like your LLC certificate or EIN letter. Got a letter in the mail you’re not
              sure about? Upload it and First Sale explains what it is and what to do.
            </p>
            <Link href="/documents?add=have#add-form" className={SECONDARY_LINK}>
              Upload a document
            </Link>
          </section>
          <CurrentBusiness business={business} />
        </>
      ) : null}
    </div>
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
