import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { StatusChip } from "@/components/requirements/sources";
import { SourceButton } from "@/components/requirements/source-button";
import { PRIMARY_LINK, TEXT_LINK } from "@/components/styles";
import { Areas } from "@/components/structure/areas";
import { Comparison } from "@/components/structure/compare";
import { DecisionForm, type PlanPick, type StructureChoice } from "@/components/structure/decision-form";
import { ReasonList } from "@/components/structure/explain";
import { ForYou, GuideSection, NameInfo, TaxInfo } from "@/components/structure/guide-sections";
import { History } from "@/components/structure/history";
import { OptionCard } from "@/components/structure/option-card";
import { AskAProfessional, StructureWhy, SuggestedPath } from "@/components/structure/suggested-path";
import { WhatIfPanel } from "@/components/structure/what-if";
import { Card, Chip, Fold, Note, PageHead } from "@/components/ui";
import { getMyBusiness, getMyDetails, getMyResearch, listMyHistory } from "@/lib/data/my-business";
import { displayDetail, STRUCTURE_LABELS } from "@/lib/details";
import { formatFee } from "@/lib/documents/startup-plan";
import type { BusinessProfile, BusinessStructure } from "@/lib/domain";
import { STATE_NAMES } from "@/lib/intake/options";
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
  const [business, details, research, history] = await Promise.all([getMyBusiness(), getMyDetails(), getMyResearch(), listMyHistory({ kind: "decision" })]);
  const header = (
    <PageHead
      kicker={
        <span className="inline-flex items-center gap-2">
          <Icon name="scale" size="sm" />
          Start your business · Step 2
        </span>
      }
      title="Business structure"
      lead="Three choices that shape your paperwork: how your business is owned, the name you sell under, and how it’s taxed. Read what each means for you first, then answer three short questions."
    />
  );
  if (!business?.profile) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        {header}
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
  const suggestion = suggestPath(profile);
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
  const structureWhy = <StructureWhy reasons={whyRecommended(profile, suggestion)} suggestion={suggestion} />;
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
  const namePick = recommendedNamePlan(profile, basis);
  const taxPick = recommendedTaxPlan(profile, basis);
  const namePicks = Object.fromEntries(all.map((id) => [id, planPick(recommendedNamePlan(profile, id))]));
  const taxPicks = Object.fromEntries(all.map((id) => [id, planPick(recommendedTaxPlan(profile, id))]));
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

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {header}
      <div className="-mt-2 flex flex-wrap items-center gap-2">
        {chosen ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-done/25 bg-done-tint px-2.5 py-1.5 text-[13.5px] font-semibold leading-tight text-done">
            <Icon name="check" size="xs" />
            You chose {STRUCTURE_LABELS[chosen]}
          </span>
        ) : (
          <Chip tone="accent" icon="scale">
            Three questions at the end
          </Chip>
        )}
        <Chip icon="clock">About {formatMinutes(stepMinutes({ topic: "structure" }))}</Chip>
        <a href="#questions" className={`inline-flex min-h-11 items-center gap-1 px-1 text-[15px] ${TEXT_LINK}`}>
          Skip to the questions
        </a>
      </div>

      {suggestion.mismatch ? (
        <OwnerMismatch owners={owners} structure={suggestion.mismatch} said="registered" />
      ) : recorded.status === "no_longer_fits" ? (
        <OwnerMismatch owners={owners} structure={recorded.was} said="recorded" />
      ) : null}

      {stale ? <StaleDecision decided={decided} then={stale.answers} now={basisLines(profile)} /> : null}

      <section aria-labelledby="know-heading" className="flex flex-col gap-5">
        <PartHead id="know-heading" part="Part 1 of 2" title="What to know first" lead="Nothing to answer yet. Read what each choice means for you, compare, and open the examples." />

        <GuideSection id="guide-areas" icon="layers" title="Four things that often get mixed up" lead="A DBA isn’t a structure, and no structure replaces a license. This page asks about the first three.">
          <Areas />
        </GuideSection>

        <GuideSection
          id="guide-ownership"
          icon="users"
          title="How it’s owned"
          lead={`Who owns the business, and whether it’s a company separate from you. With ${owners === 1 ? "one owner" : `${owners} owners`}, these are your options.`}
        >
          <SuggestedPath suggestion={suggestion} />
          <Comparison owners={owners} options={guide.main} recommended={suggestion.option} state={state} stateFound={stateFound} />
          <div className="grid items-stretch gap-4 md:grid-cols-2">{guide.main.map(card)}</div>
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
          forYou={<NameForYou profile={profile} option={basis} pick={namePick} state={state} filings={stateRules.filter((rule) => rule.topic === "name_registration").length} />}
          examples={nameExamples(profile, basis)}
        />

        <TaxInfo
          owners={owners}
          defaults={guide.main.map((id) => ({ option: id, ...taxFor(id, owners) }))}
          points={taxPoints(guide.main, guide.spouseNote)}
          otherOpen={guide.otherTaxOpen}
          forYou={<ForYou label={taxLabel(taxPick.value, basis)} reasons={taxPick.reasons} />}
          examples={taxExamples(profile, basis)}
        />

        <StateRules state={state} research={research} rules={stateRules} />
      </section>

      <section id="questions" aria-labelledby="answers-heading" className="flex scroll-mt-6 flex-col gap-5">
        <PartHead
          id="answers-heading"
          part="Part 2 of 2"
          title="Your answers"
          lead="Pick an answer for each. “Not sure yet” is a fine answer. You’ll review everything before it’s saved."
        />
        <div className="rounded-[14px] border border-line bg-surface p-4 shadow-card sm:p-6">
          {/* Starts over if the number of owners changes, since the options change with it */}
          <DecisionForm
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
          />
        </div>
      </section>

      {decided ? (
        <section aria-label="What’s next" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-soft">
          <div className="flex min-w-0 flex-col">
            <p className="text-sm font-semibold text-muted">Next, step 3</p>
            <p className="font-semibold">Find what applies to you{research ? ", and answer a few quick questions" : ""}</p>
          </div>
          <Link href="/requirements" className={PRIMARY_LINK}>
            Go to What applies to you
            <Icon name="arrow" size="sm" />
          </Link>
        </section>
      ) : null}

      <History title="Decision history" events={history} empty="No decisions recorded yet." />
    </div>
  );
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

function NameForYou({
  profile,
  option,
  pick,
  state,
  filings,
}: {
  profile: BusinessProfile;
  option: BusinessStructure;
  pick: ReturnType<typeof recommendedNamePlan>;
  state: string;
  // Name filings the owner's research found
  filings: number;
}) {
  const need = nameNeed(profile, option);
  const label = !pick
    ? need.text
    : pick.value === "register_dba"
      ? profile.name
        ? `Register “${profile.name}” as a DBA`
        : "Register the name you sell under as a DBA"
      : "Sell under your legal name. There’s no name to register.";
  return (
    <ForYou label={label} reasons={pick ? pick.reasons : null}>
      {filings && pick?.value !== "legal_name" ? (
        <a href="#state-rules" className={`relative z-10 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] ${TEXT_LINK}`}>
          <Icon name="office" size="sm" />
          See the {filings === 1 ? "name filing" : `${filings} name filings`} your check of what applies found in {state}
        </a>
      ) : null}
    </ForYou>
  );
}

function taxLabel(value: string, option: BusinessStructure): string {
  return value === "default"
    ? `Keep the default for a ${STRUCTURE_LABELS[option].replace(/ \(LLC\)$/, "").toLowerCase()}`
    : "Ask a tax professional about another tax status before you file";
}

function StateRules({ state, research, rules }: { state: string; research: Research | null; rules: Research["requirements"] }) {
  const sourceFor = (ids: string[]) => research?.sources.find((source) => ids.includes(source.key));
  return (
    <GuideSection
      id="state-rules"
      icon="office"
      title={`${state}’s filings and fees`}
      lead="From your check of what applies to you, with the official page and the date it was read. Which ones you need depends on your answers."
    >
      {research?.simulated ? <PracticeBanner what="These requirements came from practice research." /> : null}
      {!research ? (
        <Note>
          <p>Not checked yet. That’s the next step, after you answer here. Until then, treat {state}’s fees and filing steps as unknown. We don’t guess them.</p>
          <Link href="/requirements" className="mt-1 inline-flex min-h-11 items-center font-bold underline underline-offset-4">
            Find what applies to you on official {state} sites
          </Link>
        </Note>
      ) : rules.length ? (
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
                    {sourced && rule.feeCents !== null ? `Fee: $${(rule.feeCents / 100).toFixed(2)}. ` : "Fee: not confirmed. "}
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
