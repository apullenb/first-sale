import Link from "next/link";
import { Suspense } from "react";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { Areas } from "@/components/structure/areas";
import { DecisionForm } from "@/components/structure/decision-form";
import { History } from "@/components/structure/history";
import { OptionCard } from "@/components/structure/option-card";
import { SourceLink } from "@/components/structure/source-link";
import { SuggestedPath } from "@/components/structure/suggested-path";
import { WhatIfPanel } from "@/components/structure/what-if";
import { getMyBusiness, getMyDetails, getMyResearch, listMyHistory } from "@/lib/data/my-business";
import { displayDetail, STRUCTURE_LABELS } from "@/lib/details";
import type { BusinessStructure } from "@/lib/domain";
import { STATE_NAMES } from "@/lib/intake/options";
import { profileKey } from "@/lib/research/requirements";
import { sectionMetadata } from "@/lib/sections";
import { optionsFor, structureOption } from "@/lib/structure/options";
import { basisLines, nameNeed, suggestPath, taxFor } from "@/lib/structure/suggest";

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
    <div className="flex flex-col gap-1.5">
      <p className={EYEBROW}>Start your business · Step 3</p>
      <h1 className={PAGE_TITLE}>Structure and path</h1>
      <p className="text-lg text-muted">How your business is owned, named, taxed and licensed: four separate things, explained for your answers.</p>
    </div>
  );
  if (!business?.profile) {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        {header}
        <p className="text-rule">{business ? "Some of your answers need updating first." : "Answer a few questions about your business first. The options here depend on them."}</p>
        <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
          {business ? "Update your answers" : "Tell us about your business"}
        </Link>
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
  const chosen = decided && decided !== "undecided" && optionsFor(owners).some((option) => option.id === decided) ? (decided as BusinessStructure) : null;
  const stateRules = research ? research.requirements.filter((r) => r.topic === "structure" || r.topic === "name_registration") : [];
  // Only forming a company has state-rule lines; a name rule doesn't confirm them
  const stateFound = stateRules.some((r) => r.topic === "structure" && r.level !== "federal" && r.verification === "sourced");
  const options = optionsFor(owners).sort((a, b) => Number(b.id === suggestion.option) - Number(a.id === suggestion.option));
  const common = options.filter((option) => option.id !== "corporation" || suggestion.option === "corporation");
  const corporation = options.find((option) => option.id === "corporation" && suggestion.option !== "corporation");
  const lastDecision = history.find((event) => event.key === "structure_choice");
  const stale = lastDecision?.basis && lastDecision.basis.profileKey !== profileKey(profile) ? lastDecision.basis : null;

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      {header}

      {stale ? <StaleDecision decided={decided} then={stale.answers} now={basisLines(profile)} /> : null}

      <Areas
        status={{
          ownership: {
            text: decided && decided !== "undecided" ? `You chose ${displayDetail("structure_choice", decided)}.` : `Suggested starting point: ${STRUCTURE_LABELS[suggestion.option]}.`,
          },
          // For the structure they chose, once they've chosen one
          name: { text: (chosen ? nameNeed(profile, chosen) : suggestion.name).text },
          tax: { text: (chosen ? taxFor(chosen, owners) : suggestion.tax).text },
          licenses: research
            ? { text: `Your requirements list what applies in ${state}.`, href: "/requirements", linkText: "See your requirements" }
            : { text: "Not checked yet.", href: "/requirements", linkText: "Find my requirements" },
        }}
      />

      <SuggestedPath suggestion={suggestion} />

      <section aria-labelledby="options-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="options-heading" className="font-display text-2xl font-bold">
            Your options with {owners === 1 ? "one owner" : `${owners} owners`}
          </h2>
          <p className="text-rule">
            Each line links to the official page it comes from. Rules and fees that depend on {state} are marked until they’re confirmed.
          </p>
        </div>
        <Comparison owners={owners} options={common.map((option) => option.id)} />
        {common.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            owners={owners}
            state={state}
            stateFound={stateFound}
            suggested={option.id === suggestion.option}
            questions={option.id === suggestion.option ? suggestion.askAProfessional.slice(0, 2) : []}
          />
        ))}
        {corporation ? (
          <details className={`${CARD} text-[15px]`}>
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Also possible: a corporation (less common for a first business)</summary>
            <div className="pt-3">
              <OptionCard option={corporation} owners={owners} state={state} stateFound={stateFound} suggested={false} questions={[]} />
            </div>
          </details>
        ) : null}
      </section>

      <StateRules state={state} research={research} rules={stateRules} />

      <WhatIfPanel profile={profile} />

      <DecisionForm
        key={`${decided}|${saved.get("name_registration_plan") ?? ""}|${saved.get("tax_classification_plan") ?? ""}`}
        stale={Boolean(stale)}
        recordedAt={lastDecision?.createdAt.toISOString() ?? null}
        current={{
          structure_choice: decided,
          name_registration_plan: saved.get("name_registration_plan") ?? "",
          tax_classification_plan: saved.get("tax_classification_plan") ?? "",
        }}
        suggested={suggestion.option}
        owners={owners}
        basis={basisLines(profile)}
      />

      <History title="Decision history" events={history} empty="No decisions recorded yet." />
    </div>
  );
}

// Short cells from the SBA's own comparison; the cards below hold the detail
function Comparison({ owners, options }: { owners: number; options: BusinessStructure[] }) {
  const rows: [string, Record<BusinessStructure, string>][] = [
    ["Owners", { sole_proprietorship: "One person", partnership: "Two or more", llc: "One or more", corporation: "One or more" }],
    ["To start it", { sole_proprietorship: "Nothing to file", partnership: "Depends on your state", llc: "File with your state, pay a fee", corporation: "File with your state, pay a fee" }],
    [
      "Business debts",
      {
        sole_proprietorship: "Yours personally",
        partnership: "Unlimited personal liability, the SBA says",
        llc: "Protected “in most instances”, the SBA says",
        corporation: "A legal entity separate from its owners, the SBA says; ask what isn’t covered",
      },
    ],
    [
      "Income tax",
      {
        sole_proprietorship: "On your own return",
        partnership: "Partnership return; each partner reports a share",
        llc: owners > 1 ? "Like a partnership, by default" : "On your own return, by default",
        corporation: "Pays its own, unless an S corp",
      },
    ],
    ["Paperwork", { sole_proprietorship: "Least", partnership: "A yearly partnership return", llc: "State reports and fees vary", corporation: "The most" }],
  ];
  return (
    <div className="hidden overflow-hidden rounded-2xl bg-surface ring-1 ring-ink/5 sm:block">
      <table className="w-full text-left text-[15px]">
        <caption className="px-4 pt-3 text-left text-sm text-muted">
          At a glance. The SBA says rules vary by state and its own comparison is only a guideline
          <SourceLink fact="varies_by_state" />.
        </caption>
        <thead>
          <tr className="border-b border-rule-tint">
            <th scope="col" className="px-4 py-2.5">
              <span className="sr-only">Topic</span>
            </th>
            {options.map((option) => (
              <th key={option} scope="col" className="px-4 py-2.5 font-bold">
                {structureOption(option).label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, cells]) => (
            <tr key={label} className="border-b border-rule-tint last:border-b-0">
              <th scope="row" className="px-4 py-2.5 font-semibold text-rule">
                {label}
              </th>
              {options.map((option) => (
                <td key={option} className="px-4 py-2.5">
                  {cells[option]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StateRules({ state, research, rules }: { state: string; research: Research | null; rules: Research["requirements"] }) {
  const sourceFor = (ids: string[]) => research?.sources.find((source) => ids.includes(source.key));
  return (
    <section id="state-rules" aria-labelledby="state-rules-heading" className="flex scroll-mt-6 flex-col gap-3">
      <h2 id="state-rules-heading" className={SECTION_TITLE}>
        {state}’s filings and fees
      </h2>
      {research?.simulated ? <PracticeBanner what="These requirements came from practice research." /> : null}
      {!research ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-check-tint p-4 text-check">
          <p>
            Not checked yet. Until they are, treat {state}’s fees and filing steps as unknown. We don’t guess them.
          </p>
          <Link href="/requirements" className={`${TEXT_LINK} w-fit`}>
            Find my requirements on official {state} sites
          </Link>
        </div>
      ) : rules.length ? (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => {
            const source = sourceFor(rule.sourceIds);
            const sourced = rule.verification === "sourced";
            return (
              <li key={rule.id} className="flex flex-col gap-1 rounded-2xl bg-surface p-4 ring-1 ring-ink/5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{rule.title}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${sourced ? "bg-accent-tint text-accent-ink" : "bg-check-tint text-check"}`}>
                    {sourced ? "Official source" : "Needs verification"}
                  </span>
                </div>
                {rule.agency ? <p className="text-sm text-muted">{rule.agency}</p> : null}
                <p className="text-[15px]">
                  {sourced && rule.feeCents !== null ? `Fee: $${(rule.feeCents / 100).toFixed(2)}. ` : "Fee: not confirmed. "}
                  Checked <LocalDate iso={rule.checkedAt.toISOString()} />.
                </p>
                {source ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className={`${TEXT_LINK} w-fit text-sm`}>
                    {source.title}
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-check-tint p-4 text-check">
          Your last check didn’t find {state}’s official pages on forming a business or registering a name. That doesn’t mean there are no rules.{" "}
          <Link href="/requirements" className={TEXT_LINK}>
            See your requirements
          </Link>
        </p>
      )}
    </section>
  );
}

function StaleDecision({ decided, then, now }: { decided: string; then: string[]; now: string[] }) {
  const gone = then.filter((line) => !now.includes(line));
  const added = now.filter((line) => !then.includes(line));
  return (
    <section aria-labelledby="stale-heading" className="flex flex-col gap-2 rounded-2xl bg-check-tint p-5 text-check">
      <h2 id="stale-heading" className="font-bold">
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
