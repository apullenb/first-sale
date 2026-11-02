import Link from "next/link";
import { Suspense } from "react";
import { Completed, Revisit } from "@/components/completed";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { MoveOn } from "@/components/move-on";
import { PracticeBanner } from "@/components/practice-banner";
import { StatusChip } from "@/components/requirements/sources";
import { SourceButton } from "@/components/requirements/source-button";
import { ACTION_ITEM, PRIMARY_LINK, TEXT_LINK } from "@/components/styles";
import { Areas, areaFor } from "@/components/structure/areas";
import { Comparison } from "@/components/structure/compare";
import {
  DecisionProvider,
  DecisionReview,
  NameQuestion,
  OwnershipQuestion,
  type PlanPick,
  type StructureChoice,
  TaxQuestion,
} from "@/components/structure/decision-form";
import { ReasonList } from "@/components/structure/explain";
import { GuideSection, NameInfo, TaxInfo } from "@/components/structure/guide-sections";
import { History } from "@/components/structure/history";
import { OptionCard } from "@/components/structure/option-card";
import { AdviceRunner } from "@/components/structure/advice-runner";
import { AskAProfessional, StructureWhy, SuggestedPath } from "@/components/structure/suggested-path";
import { WhatIfPanel } from "@/components/structure/what-if";
import { ActionKicker, Card, Fact, Fold, Note, PageHead } from "@/components/ui";
import { getMyBusiness, getMyDetails, getMyPaperwork, getMyResearch, getMyStructureAdvice, listMyHistory, type MyPaperwork } from "@/lib/data/my-business";
import { displayDetail, STRUCTURE_LABELS } from "@/lib/details";
import { formatFee } from "@/lib/documents/startup-plan";
import type { BusinessStructure } from "@/lib/domain";
import { STATE_NAMES } from "@/lib/intake/options";
import { STRUCTURE_NAMES } from "@/lib/research/applicability";
import { profileKey } from "@/lib/research/requirements";
import { formatMinutes, stepMinutes } from "@/lib/rules/progress";
import { sectionMetadata } from "@/lib/sections";
import { guideFor, nameExamples, ownershipExamples, taxExamples } from "@/lib/structure/guide";
import { recordedStructure, relevantLines, structureOption, taxPoints } from "@/lib/structure/options";
import {
  basisLines,
  nameNeed,
  type Recommendation,
  recommendedNamePlan,
  recommendedTaxPlan,
  suggestPath,
  taxFor,
  whyRecommended,
} from "@/lib/structure/suggest";

export const metadata = sectionMetadata("/structure");

type Research = NonNullable<Awaited<ReturnType<typeof getMyResearch>>>;

export default function StructurePage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading your options…</p>}>
      <Structure />
    </Suspense>
  );
}

async function Structure() {
  const [business, details, research, history, advice, paper] = await Promise.all([
    getMyBusiness(),
    getMyDetails(),
    getMyResearch(),
    listMyHistory({ kind: "decision" }),
    getMyStructureAdvice(),
    getMyPaperwork(),
  ]);
  const header = (lead = "Three choices that shape your paperwork: how your business is owned, the name you sell under, and how it’s taxed. Each part explains one choice, then asks you to make it.") => (
    <PageHead
      kicker={
        <span className="inline-flex items-center gap-2">
          <Icon name="scale" size="sm" />
          Start your business · Step 2
        </span>
      }
      title="Business structure"
      lead={lead}
    />
  );
  if (!business?.profile) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        {header()}
        <Card>
          <p className="text-rule">{business ? "Some of your answers need updating first." : "Answer a few questions about your business first. The options here depend on them."}</p>
          <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
            {business ? "Update your answers" : "Tell us about your business"}
            <Icon name="arrow" size="sm" />
          </Link>
        </Card>
      </div>
    );
  }

  const profile = business.profile;
  const state = STATE_NAMES[profile.location.state];
  const owners = profile.owners.count;
  // The AI's recommendation for these answers; the rules' stand in until it's ready
  const current = advice && advice.profileKey === profileKey(profile) ? advice : null;
  const rules = suggestPath(profile);
  const suggestion = current
    ? {
        ...rules,
        option: current.structure,
        headline: current.headline,
        alternatives: rules.alternatives.filter((each) => each.option !== current.structure),
        askAProfessional: current.askAProfessional.length ? current.askAProfessional : rules.askAProfessional,
      }
    : rules;
  const saved = new Map(details.map((detail) => [detail.key, detail.value]));
  const decided = saved.get("structure_choice") ?? "";
  // A recorded structure that no longer fits the number of owners isn't described as if it did
  const recorded = recordedStructure(decided, owners);
  const chosen = recorded.structure;
  // Name and tax guidance follow the recorded structure, or the suggested one
  const basis = chosen ?? suggestion.option;
  const guide = guideFor(profile, suggestion, basis);
  const stateRules = research ? research.requirements.filter((r) => r.topic === "structure" || r.topic === "name_registration") : [];
  // Only forming a company has state-rule lines; a name rule doesn't confirm them
  const stateFound = stateRules.some((r) => r.topic === "structure" && r.level !== "federal" && r.verification === "sourced");
  const lastDecision = history.find((event) => event.key === "structure_choice");
  const stale = lastDecision?.basis && lastDecision.basis.profileKey !== profileKey(profile) ? lastDecision.basis : null;
  const all = [...guide.main, ...guide.more];
  const structureWhy = <StructureWhy reasons={current ? current.reasons : whyRecommended(profile, suggestion)} suggestion={suggestion} />;
  const choice = (id: BusinessStructure): StructureChoice => ({ id, short: structureOption(id).short, why: id === suggestion.option ? structureWhy : null });
  const card = (id: BusinessStructure) => {
    const option = structureOption(id);
    return (
      <OptionCard
        key={id}
        option={option}
        ongoing={relevantLines(option.ongoing(owners), profile)}
        cons={relevantLines(option.cons, profile)}
        state={state}
        stateFound={stateFound}
        why={id === suggestion.option ? structureWhy : null}
        examples={ownershipExamples(profile, id)}
      />
    );
  };
  const namePicks = Object.fromEntries(
    all.map((id) => [id, planPick(current?.structure === id ? (current.name.plan ? { value: current.name.plan, reasons: current.name.reasons } : null) : recommendedNamePlan(profile, id))]),
  );
  const taxPicks = Object.fromEntries(
    all.map((id) => [id, planPick(current?.structure === id ? { value: current.tax.plan, reasons: current.tax.reasons } : recommendedTaxPlan(profile, id))]),
  );
  // Research steps tied to a structure: kept or left out by each choice, worked out from what the research recorded
  const tied = research ? research.requirements.filter((requirement) => requirement.forStructures.length) : [];
  const change = (requirement: (typeof tied)[number]) => ({
    title: requirement.title,
    fee: requirement.verification === "sourced" && requirement.feeCents ? formatFee(requirement.feeCents) : null,
  });
  const changes = research
    ? Object.fromEntries(
        all.map((id) => [
          id,
          {
            kept: tied.filter((requirement) => requirement.forStructures.includes(id)).map(change),
            left: tied.filter((requirement) => !requirement.forStructures.includes(id)).map(change),
          },
        ]),
      )
    : null;

  // Settled: a recorded choice that still fits the answers. Anything that needs another look opens Revisit.
  const settled = Boolean(chosen) && !stale && !suggestion.mismatch && recorded.status !== "no_longer_fits";
  const nameAnswer = saved.get("name_registration_plan");
  const taxAnswer = saved.get("tax_classification_plan");
  const after = afterStructure(paper, profile);
  const next = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-done/20 pt-4">
      <div className="flex min-w-0 flex-col">
        <p className="text-sm font-semibold text-muted">{after.kicker}</p>
        <p className="font-semibold">{after.title}</p>
      </div>
      <Link href={after.href} className={PRIMARY_LINK}>
        {after.action}
        <Icon name="arrow" size="sm" />
      </Link>
    </div>
  );
  // A company's state filing fee only when an official page confirmed it
  const formationFee = stateRules.find((rule) => rule.topic === "structure" && rule.verification === "sourced" && rule.feeCents && rule.forStructures.length);
  const guideAndQuestions = (
    // Starts over if the number of owners changes, since the options change with it
    <DecisionProvider
      key={owners}
        stale={Boolean(stale)}
        recordedAt={lastDecision?.createdAt.toISOString() ?? null}
        current={{
          structure_choice: decided,
          name_registration_plan: saved.get("name_registration_plan") ?? "",
          tax_classification_plan: saved.get("tax_classification_plan") ?? "",
        }}
        owners={owners}
        basis={basisLines(profile)}
        choices={guide.main.map(choice)}
        extra={guide.more.length ? choice(guide.more[0]) : null}
        suggested={suggestion.option}
        nameText={Object.fromEntries(all.map((id) => [id, nameNeed(profile, id).text]))}
        taxText={Object.fromEntries(all.map((id) => [id, taxFor(id, owners).text]))}
        namePicks={namePicks}
        taxPicks={taxPicks}
        changes={changes}
        unsure={<AskAProfessional questions={suggestion.askAProfessional} />}
    >
      <section aria-labelledby="know-heading" className="flex flex-col gap-5">
        <PartHead
          id="know-heading"
          part="Start here"
          title="What to know first"
          lead="Four things that often get mixed up. Each part below explains one of the first three, then asks you to choose. “Not sure yet” is a fine answer."
        />

        <GuideSection id="guide-areas" icon="layers" title="Four things that often get mixed up" lead="A DBA isn’t a structure, and no structure replaces a license. This page asks about the first three.">
          <Areas />
        </GuideSection>

        <GuideSection
          id="guide-ownership"
          icon="users"
          title="How it’s owned"
          lead={`Who owns the business, and whether it’s a company separate from you. With ${owners === 1 ? "one owner" : `${owners} owners`}, these are your options.`}
          area={areaFor("ownership")}
        >
          <SuggestedPath suggestion={suggestion} />
          <Comparison owners={owners} options={guide.main} recommended={suggestion.option} state={state} stateFound={stateFound} />
          <OwnershipQuestion />
          <Fold title="Each option in detail" summary="Why people choose it, what to watch for, what it takes to keep up, and examples" icon="book">
            <div className="grid items-stretch gap-4 md:grid-cols-2">{guide.main.map(card)}</div>
          </Fold>
          {guide.more.map((id) => (
            <Fold key={id} title={`Also possible: ${STRUCTURE_LABELS[id].toLowerCase()}`} summary="Less common for a first business" icon="building">
              {card(id)}
            </Fold>
          ))}
          <Fold title="Try a what-if" summary="See how the suggestion would change. Your saved answers stay as they are." icon="refresh">
            <WhatIfPanel profile={profile} />
          </Fold>
        </GuideSection>

        <NameInfo
          folded={guide.nameFolded}
          forYou={<NameFilings state={state} filings={stateRules.filter((rule) => rule.topic === "name_registration").length} />}
          examples={nameExamples(profile, basis)}
          area={areaFor("name")}
          question={<NameQuestion />}
        />

        <TaxInfo
          owners={owners}
          defaults={guide.main.map((id) => ({ option: id, ...taxFor(id, owners) }))}
          points={taxPoints(guide.main, guide.spouseNote)}
          otherOpen={guide.otherTaxOpen}
          forYou={null}
          examples={taxExamples(profile, basis)}
          area={areaFor("tax")}
          question={<TaxQuestion />}
        />

        {research ? <StateRules state={state} research={research} rules={stateRules} /> : null}
      </section>

      <section id="questions" aria-labelledby="answers-heading" className="flex scroll-mt-6 flex-col gap-5">
        <PartHead id="answers-heading" part="Last step" title="Review and record" lead="Check your three answers and what they change in your plan. Nothing is saved until you record it." />
        <div className="rounded-[14px] border border-line bg-surface p-4 shadow-card sm:p-6">
          <DecisionReview />
        </div>
      </section>
    </DecisionProvider>
  );

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {chosen ? header("How your business is owned, the name you sell under, and how it’s taxed. Your choices are below.") : header()}
      {current ? null : <AdviceRunner />}
      {chosen ? null : (
        <section aria-labelledby="structure-next" className={ACTION_ITEM}>
          <ActionKicker as="h2" id="structure-next">
            Your next step
          </ActionKicker>
          <p className="font-display text-[23px] leading-tight sm:text-[27px]">Choose how your business is owned</p>
          <p className="text-[16.5px] text-rule">Your structure decides your taxes, your paperwork, and whether your personal savings are kept apart from the business.</p>
          <div className="flex flex-wrap gap-2">
            <Fact icon="clock">About {formatMinutes(stepMinutes({ topic: "structure" }))} of your time (an estimate)</Fact>
            <Fact icon="list">Three questions, one in each part</Fact>
          </div>
          <p className="text-[15px] text-muted">
            Choosing costs nothing and files nothing.{" "}
            {formationFee
              ? `Forming ${formationFee.title.match(/\bcorporation\b/i) ? "a corporation" : "an LLC"} in ${state} costs ${formatFee(formationFee.feeCents!)}, from the official page.`
              : `Forming an LLC or corporation has a ${state} filing fee, shown in your plan once an official page confirms it.`}{" "}
            “Not sure yet” is a fine answer for now.
          </p>
          <a href="#question-structure_choice" className={`${PRIMARY_LINK} w-fit`}>
            Go to the first question
            <Icon name="arrow" size="sm" />
          </a>
        </section>
      )}

      {suggestion.mismatch ? (
        <OwnerMismatch owners={owners} structure={suggestion.mismatch} said="registered" />
      ) : recorded.status === "no_longer_fits" ? (
        <OwnerMismatch owners={owners} structure={recorded.was} said="recorded" />
      ) : null}

      {stale ? <StaleDecision decided={decided} then={stale.answers} now={basisLines(profile)} /> : null}

      {chosen ? (
        <>
          <Completed
            title={`You chose ${STRUCTURE_NAMES[chosen]}`}
            when={lastDecision?.createdAt.toISOString() ?? null}
            lines={[
              ...(nameAnswer ? [{ label: "The name you sell under", value: displayDetail("name_registration_plan", nameAnswer) }] : []),
              ...(taxAnswer ? [{ label: "How it’s taxed", value: displayDetail("tax_classification_plan", taxAnswer) }] : []),
            ]}
          >
            {settled ? next : null}
          </Completed>
          {settled ? <MoveOn from="Start your business" /> : null}
          <Revisit id="revisit" open={!settled}>
            {guideAndQuestions}
          </Revisit>
        </>
      ) : (
        guideAndQuestions
      )}

      <History title="Decision history" events={history} empty="No decisions recorded yet." />
    </div>
  );
}

// Where to go once the structure is settled: What applies to you until it's done, then the next ready step
function afterStructure(paper: MyPaperwork | null, profile: Parameters<typeof profileKey>[0]): { kicker: string; title: string; href: string; action: string } {
  const checked = paper?.basis && profileKey(profile) === paper.basis.profileKey;
  if (!checked || paper.view.open.length) {
    return {
      kicker: "Next, step 3",
      title: `Find what applies to you${paper?.basis ? ", and answer a few quick questions" : ""}`,
      href: paper?.basis && paper.view.open.length ? "/requirements#questions" : "/requirements",
      action: "Go to What applies to you",
    };
  }
  const first = paper.view.first;
  if (first) return { kicker: "Up next", title: first.step.title, href: `/checklist/${first.step.id}`, action: "Open this step" };
  return { kicker: "Up next", title: "See every step to start your business", href: "/start", action: "See every step" };
}

function planPick(recommendation: Recommendation<string> | null): PlanPick | null {
  return recommendation ? { value: recommendation.value, why: <ReasonList reasons={recommendation.reasons} /> } : null;
}

function PartHead({ id, part, title, lead }: { id: string; part: string; title: string; lead: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-5">
      <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">{part}</p>
      <h2 id={id} className="font-display text-[28px] leading-tight sm:text-[30px]">
        {title}
      </h2>
      <p className="max-w-2xl text-[17px] text-muted">{lead}</p>
    </div>
  );
}

// The name filings the owner's check found; the recommended answer is marked in question 2, following their choice
function NameFilings({ state, filings }: { state: string; filings: number }) {
  if (!filings) return null;
  return (
    <a href="#state-rules" className={`inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] ${TEXT_LINK}`}>
      <Icon name="office" size="sm" />
      See the {filings === 1 ? "name filing" : `${filings} name filings`} your check of what applies found in {state}
    </a>
  );
}

function StateRules({ state, research, rules }: { state: string; research: Research; rules: Research["requirements"] }) {
  const sourceFor = (ids: string[]) => research.sources.find((source) => ids.includes(source.key));
  return (
    <GuideSection
      id="state-rules"
      icon="office"
      title={`${state}’s filings and fees`}
      lead="From your check of what applies to you, with the official page and the date it was read. Which ones you need depends on your answers."
    >
      {research.simulated ? <PracticeBanner what="These requirements came from practice research." /> : null}
      {rules.length ? (
        <ul className="flex flex-col gap-2.5">
          {rules.map((rule) => {
            const source = sourceFor(rule.sourceIds);
            const sourced = rule.verification === "sourced";
            return (
              <li key={rule.id} className="flex items-start gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-soft">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold leading-snug">{rule.title}</span>
                    <StatusChip sourced={sourced} />
                  </div>
                  {rule.agency ? (
                    <p className="flex items-center gap-1.5 text-sm text-muted">
                      <Icon name="office" size="xs" className="text-faint" />
                      {rule.agency}
                    </p>
                  ) : null}
                  <p className="text-[15px]">
                    {sourced && rule.feeCents !== null ? `Fee: $${(rule.feeCents / 100).toFixed(2)}. ` : "Fee: set by the state. "}
                    <span className="text-muted">
                      {source ? `From ${source.title}, checked ` : "Checked "}
                      <LocalDate iso={rule.checkedAt.toISOString()} />.
                    </span>
                  </p>
                </div>
                {source ? <SourceButton url={source.url} title={source.title} /> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <Note>
          Your last check didn’t find {state}’s official pages on forming a business or registering a name. That doesn’t mean there are no rules.{" "}
          <Link href="/requirements" className="font-bold underline underline-offset-4">
            Open What applies to you
          </Link>
        </Note>
      )}
    </GuideSection>
  );
}

// A structure that can't fit the number of owners is never described as if it did
function OwnerMismatch({ owners, structure, said }: { owners: number; structure: BusinessStructure; said: "registered" | "recorded" }) {
  const name = STRUCTURE_LABELS[structure].toLowerCase();
  const needs = structure === "partnership" ? "A partnership needs two or more owners" : "A sole proprietorship has just one owner";
  return (
    <Note icon="alert">
      <p className="font-semibold">
        {said === "registered" ? `You said you’re registered as a ${name}` : `You recorded a ${name}`}, but your answers say {owners === 1 ? "you’re the only owner" : `there are ${owners} owners`}.
      </p>
      <p>
        {needs}. {said === "registered" ? "This page is based on the options that fit your number of owners until you correct one of these answers." : "Choose again below, or correct your number of owners."}{" "}
        <Link href="/business/edit" className="font-bold underline underline-offset-4">
          Correct an answer
        </Link>
      </p>
    </Note>
  );
}

function StaleDecision({ decided, then, now }: { decided: string; then: string[]; now: string[] }) {
  const gone = then.filter((line) => !now.includes(line));
  const added = now.filter((line) => !then.includes(line));
  return (
    <section aria-labelledby="stale-heading" className="flex flex-col gap-2 rounded-2xl border border-check-ring bg-check-tint p-5 text-check">
      <h2 id="stale-heading" className="flex items-center gap-2 font-bold">
        <Icon name="refresh" size="sm" />
        Your answers changed since you chose {decided ? displayDetail("structure_choice", decided) : "your structure"}
      </h2>
      <p>Your decision stays as it is. Look again with your new answers, and record a new one if it no longer fits.</p>
      {gone.length || added.length ? (
        <ul className="list-disc pl-5">
          {gone.map((line) => (
            <li key={`was-${line}`}>No longer: {line}</li>
          ))}
          {added.map((line) => (
            <li key={`now-${line}`}>Now: {line}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
