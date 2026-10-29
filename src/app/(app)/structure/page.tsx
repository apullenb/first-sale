import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { StatusChip } from "@/components/requirements/requirement-card";
import { SourceButton } from "@/components/requirements/source-button";
import { PRIMARY_LINK } from "@/components/styles";
import { Areas } from "@/components/structure/areas";
import { DecisionForm, type StructureChoice } from "@/components/structure/decision-form";
import { History } from "@/components/structure/history";
import { OptionCard } from "@/components/structure/option-card";
import { SourceLink } from "@/components/structure/source-link";
import { AskAProfessional, SuggestedPath } from "@/components/structure/suggested-path";
import { WhatIfPanel } from "@/components/structure/what-if";
import { Card, Chip, Fold, Note, PageHead } from "@/components/ui";
import { getMyBusiness, getMyDetails, getMyResearch, listMyHistory } from "@/lib/data/my-business";
import { displayDetail, STRUCTURE_LABELS } from "@/lib/details";
import { formatFee } from "@/lib/documents/startup-plan";
import type { BusinessStructure } from "@/lib/domain";
import { STATE_NAMES } from "@/lib/intake/options";
import { profileKey } from "@/lib/research/requirements";
import { formatMinutes, stepMinutes } from "@/lib/rules/progress";
import { sectionMetadata } from "@/lib/sections";
import { optionsFor, type StructureOption, structureOption } from "@/lib/structure/options";
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
    <PageHead
      kicker={
        <span className="inline-flex items-center gap-2">
          <Icon name="scale" size="sm" />
          Start your business · Step 3
        </span>
      }
      title="Business structure"
      lead="How your business is owned, named, taxed and licensed: four separate things, explained for your answers. You can change your mind later."
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
  const chosen = decided && decided !== "undecided" && optionsFor(owners).some((option) => option.id === decided) ? (decided as BusinessStructure) : null;
  const stateRules = research ? research.requirements.filter((r) => r.topic === "structure" || r.topic === "name_registration") : [];
  // Only forming a company has state-rule lines; a name rule doesn't confirm them
  const stateFound = stateRules.some((r) => r.topic === "structure" && r.level !== "federal" && r.verification === "sourced");
  const options = optionsFor(owners).sort((a, b) => Number(b.id === suggestion.option) - Number(a.id === suggestion.option));
  const common = options.filter((option) => option.id !== "corporation" || suggestion.option === "corporation");
  const corporation = options.find((option) => option.id === "corporation" && suggestion.option !== "corporation");
  const lastDecision = history.find((event) => event.key === "structure_choice");
  const stale = lastDecision?.basis && lastDecision.basis.profileKey !== profileKey(profile) ? lastDecision.basis : null;
  const choice = (option: StructureOption): StructureChoice => ({
    id: option.id,
    suggested: option.id === suggestion.option,
    details: (
      <OptionCard
        option={option}
        owners={owners}
        state={state}
        stateFound={stateFound}
        questions={option.id === suggestion.option ? suggestion.askAProfessional.slice(0, 2) : []}
      />
    ),
  });
  // Research steps tied to a structure: kept or left out by each choice, worked out from what the research recorded
  const tied = research ? research.requirements.filter((requirement) => requirement.forStructures.length) : [];
  const change = (requirement: (typeof tied)[number]) => ({
    title: requirement.title,
    fee: requirement.verification === "sourced" && requirement.feeCents ? formatFee(requirement.feeCents) : null,
  });
  const changes = research
    ? Object.fromEntries(
        options.map((option) => [
          option.id,
          {
            kept: tied.filter((requirement) => requirement.forStructures.includes(option.id)).map(change),
            left: tied.filter((requirement) => !requirement.forStructures.includes(option.id)).map(change),
          },
        ]),
      )
    : null;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {header}
      <div className="-mt-2 flex flex-wrap gap-2">
        {chosen ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-done/25 bg-done-tint px-2.5 py-1.5 text-[13.5px] font-semibold leading-tight text-done">
            <Icon name="check" size="xs" />
            You chose {STRUCTURE_LABELS[chosen]}
          </span>
        ) : (
          <Chip tone="accent" icon="scale">
            One choice to make
          </Chip>
        )}
        <Chip icon="clock">About {formatMinutes(stepMinutes({ topic: "structure" }))}</Chip>
      </div>

      {stale ? <StaleDecision decided={decided} then={stale.answers} now={basisLines(profile)} /> : null}

      <SuggestedPath suggestion={suggestion}>
        <WhatIfPanel profile={profile} />
      </SuggestedPath>

      <DecisionForm
        key={`${decided}|${saved.get("name_registration_plan") ?? ""}|${saved.get("tax_classification_plan") ?? ""}`}
        stale={Boolean(stale)}
        recordedAt={lastDecision?.createdAt.toISOString() ?? null}
        current={{
          structure_choice: decided,
          name_registration_plan: saved.get("name_registration_plan") ?? "",
          tax_classification_plan: saved.get("tax_classification_plan") ?? "",
        }}
        owners={owners}
        basis={basisLines(profile)}
        choices={common.map(choice)}
        extra={corporation ? choice(corporation) : null}
        nameText={Object.fromEntries(options.map((option) => [option.id, nameNeed(profile, option.id).text]))}
        taxText={Object.fromEntries(options.map((option) => [option.id, taxFor(option.id, owners).text]))}
        changes={changes}
        unsure={<AskAProfessional questions={suggestion.askAProfessional} />}
      />

      <StateRules state={state} research={research} rules={stateRules} />

      <div className="flex flex-col gap-3">
        <Fold title="Four separate decisions" summary="Ownership, name, taxes and licenses, and where you stand on each" icon="list">
          <Areas
            status={{
              ownership: {
                text:
                  decided && decided !== "undecided" ? `You chose ${displayDetail("structure_choice", decided)}.` : `Suggested starting point: ${STRUCTURE_LABELS[suggestion.option]}.`,
              },
              // For the structure they chose, once they've chosen one
              name: { text: (chosen ? nameNeed(profile, chosen) : suggestion.name).text },
              tax: { text: (chosen ? taxFor(chosen, owners) : suggestion.tax).text },
              licenses: research
                ? { text: `Your requirements list what applies in ${state}.`, href: "/requirements", linkText: "See your requirements" }
                : { text: "Not checked yet.", href: "/requirements", linkText: "Find my requirements" },
            }}
          />
        </Fold>
        <div className="hidden sm:block">
          <Fold title="Compare them side by side" summary={`Your options with ${owners === 1 ? "one owner" : `${owners} owners`}, at a glance`} icon="scale">
            <Comparison owners={owners} options={common.map((option) => option.id)} />
          </Fold>
        </div>
      </div>

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
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-left text-[15px]">
        <caption className="px-4 pt-3 pb-1 text-left text-sm text-muted">
          At a glance. The SBA says rules vary by state and its own comparison is only a guideline
          <SourceLink fact="varies_by_state" />.
        </caption>
        <thead>
          <tr className="border-b border-line bg-soft">
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
            <tr key={label} className="border-b border-line last:border-b-0">
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
    <Card title={`${state}’s filings and fees`} icon="office" id="state-rules" className="scroll-mt-6">
      {research?.simulated ? <PracticeBanner what="These requirements came from practice research." /> : null}
      {!research ? (
        <Note>
          <p>Not checked yet. Until they are, treat {state}’s fees and filing steps as unknown. We don’t guess them.</p>
          <Link href="/requirements" className="mt-1 inline-flex min-h-11 items-center font-bold underline underline-offset-4">
            Find my requirements on official {state} sites
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
            See your requirements
          </Link>
        </Note>
      )}
    </Card>
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
