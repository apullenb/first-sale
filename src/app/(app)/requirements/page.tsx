import Link from "next/link";
import { Suspense } from "react";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { CheckRequirementsButton } from "@/components/requirements/check-button";
import { RequirementCard, SourceLinks } from "@/components/requirements/requirement-card";
import { ResearchRunStatus } from "@/components/requirements/research-run";
import { CARD, PRIMARY_LINK, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { getMyBusiness, getMyResearch, lastMyRun } from "@/lib/data/my-business";
import type { ResearchSnapshot } from "@/lib/data/research";
import type { BusinessProfile, JurisdictionLevel } from "@/lib/domain";
import { STATE_NAMES } from "@/lib/intake/options";
import { profileKey } from "@/lib/research/requirements";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/requirements");
// Re-checking reads several official pages, then waits on a long model call
export const maxDuration = 300;

export default function RequirementsPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-accent-ink">Start your business · Step 2</p>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">What you need to open</h1>
        <p className="text-lg text-muted">
          Each requirement links to the official page it came from. If there isn’t one, it says so, and tells you who to
          call and what to ask.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading your requirements…</p>}>
        <Requirements />
      </Suspense>
    </div>
  );
}

async function Requirements() {
  const [business, research, run] = await Promise.all([getMyBusiness(), getMyResearch(), lastMyRun("research", null)]);

  if (!business?.profile) {
    return (
      <section className={`flex flex-col gap-3 ${CARD}`}>
        <p>
          {business
            ? "Some of your answers need updating before we can look up your requirements."
            : "Tell us about your business first. Your answers decide which requirements apply."}
        </p>
        <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
          {business ? "Update your answers" : "Tell us about your business"}
        </Link>
      </section>
    );
  }
  return (
    <>
      <ResearchRunStatus run={run} />
      {research ? <Results profile={business.profile} research={research} /> : <FirstCheck profile={business.profile} />}
    </>
  );
}

function FirstCheck({ profile }: { profile: BusinessProfile }) {
  return (
    <section aria-labelledby="first-check" className={`flex flex-col gap-4 ${CARD}`}>
      <h2 id="first-check" className={SECTION_TITLE}>
        Find what applies to you in {STATE_NAMES[profile.location.state]}
      </h2>
      <HowChecked />
      <CheckRequirementsButton label="Find my requirements" variant="primary" />
    </section>
  );
}

// Without a snapshot, says how a check works; with one, how that check went
function HowChecked({ research }: { research?: ResearchSnapshot }) {
  return (
    <ul className="flex flex-col gap-2">
      <li className="flex items-start gap-2.5">
        <ActorChip actor={research?.simulated ? "rule" : "ai"} />
        <span>
          {research?.simulated
            ? "Practice rules read official federal (.gov) pages and matched your answers to a fixed list. No AI looked at your business, and state and local sites weren’t searched."
            : !research
            ? "AI looks for official government (.gov) sites for your state, county and city, plus federal guidance, and lists what applies to your business."
            : research.searched
              ? "AI searched official government (.gov) sites for your state, county and city, plus federal guidance."
              : "AI read official government (.gov) pages, including federal guidance. First Sale didn’t search state and local sites this time."}
        </span>
      </li>
      <li className="flex items-start gap-2.5">
        <ActorChip actor="rule" />
        <span>
          Only sites on the official .gov list count as official, and every quote, fee and deadline{" "}
          {research ? "was" : "is"} checked against the page. Anything that doesn’t match is marked “Needs verification.”
        </span>
      </li>
    </ul>
  );
}

const GROUPS: { label: string; levels: JurisdictionLevel[] }[] = [
  { label: "Federal", levels: ["federal"] },
  { label: "State", levels: ["state"] },
  { label: "County and city", levels: ["county", "city"] },
];

function Results({ profile, research }: { profile: BusinessProfile; research: ResearchSnapshot }) {
  const sourcedCount = research.requirements.filter((r) => r.verification === "sourced").length;
  const verifyCount = research.requirements.length - sourcedCount;
  const stateName = STATE_NAMES[profile.location.state];
  const readLevels = new Set(research.sources.map((source) => source.level));
  const changed = profileKey(profile) !== research.profileKey;
  const hasQuestions = research.openQuestions.length > 0;

  return (
    <>
      {research.simulated ? <PracticeBanner what="These requirements are practice results." /> : null}

      {changed ? (
        <section className="flex flex-col gap-3 rounded-2xl bg-check-tint p-5">
          <p className="text-check">Your answers changed since this list was checked. Re-check to bring it up to date.</p>
          <CheckRequirementsButton label="Re-check sources" variant="primary" />
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-accent-tint px-3 py-1 text-sm font-semibold text-accent-ink">
          {sourcedCount} with an official source
        </span>
        <span className="rounded-full bg-check-tint px-3 py-1 text-sm font-semibold text-check">
          {verifyCount} to confirm by phone
        </span>
      </div>
      {research.requirements.length ? (
        <Link href="/checklist" className={PRIMARY_LINK}>
          See your startup plan
        </Link>
      ) : null}

      {GROUPS.map((group) => {
        const items = research.requirements.filter((requirement) => group.levels.includes(requirement.level));
        const local = group.levels[0] !== "federal";
        const missing = local && group.levels.every((level) => !readLevels.has(level));
        if (items.length === 0 && !missing) return null;
        const headingId = `group-${group.levels[0]}`;
        const place = group.label === "State" ? stateName : "county or city";
        return (
          <section key={group.label} aria-labelledby={headingId} className="flex flex-col gap-2.5">
            <h2 id={headingId} className="text-[13px] font-bold uppercase tracking-wider text-muted">
              {group.label === "State" ? stateName : group.label}
            </h2>
            {missing ? (
              <p className="text-sm text-muted">
                {research.searched ? (
                  <>
                    We didn’t find official {place} pages for your business. That doesn’t mean there are no{" "}
                    {group.label === "State" ? "state" : "local"} rules.{" "}
                    {hasQuestions ? (
                      <>
                        See{" "}
                        <a href="#still-to-find-out" className={TEXT_LINK}>
                          “Still to find out”
                        </a>{" "}
                        below for what to ask.
                      </>
                    ) : (
                      "Ask the offices named on each requirement."
                    )}
                  </>
                ) : (
                  <>
                    We haven’t searched official {place} sites yet{items.length ? ", so these say who to ask" : ""}.
                  </>
                )}
              </p>
            ) : null}
            {items.map((requirement) => (
              <RequirementCard key={requirement.id} requirement={requirement} sources={research.sources} />
            ))}
          </section>
        );
      })}

      {research.assumptions.length ? (
        <section aria-labelledby="assumed-heading" className={`flex flex-col gap-3 ${CARD}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id="assumed-heading" className={SECTION_TITLE}>
              What we assumed
            </h2>
            <ActorChip actor="ai" />
          </div>
          <p className="text-muted">These guesses about your business shaped the list. If one is wrong, correct your answers, then re-check.</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {research.assumptions.map((assumption, index) => (
              <li key={index}>{assumption}</li>
            ))}
          </ul>
          <Link href="/business/edit" className={SECONDARY_LINK}>
            Correct your answers
          </Link>
        </section>
      ) : null}

      {hasQuestions ? (
        <section
          id="still-to-find-out"
          aria-labelledby="questions-heading"
          className="flex scroll-mt-4 flex-col gap-3 rounded-2xl bg-check-tint/60 p-5 ring-1 ring-check/15"
        >
          <h2 id="questions-heading" className={`${SECTION_TITLE} text-check`}>
            Still to find out
          </h2>
          <p>First Sale couldn’t settle these. Each one says who can tell you.</p>
          <ul className="flex flex-col gap-2.5">
            {research.openQuestions.map((item, index) => (
              <li key={index} className="flex flex-col gap-0.5 rounded-xl bg-surface px-3.5 py-3 ring-1 ring-ink/5">
                <span className="font-semibold">{item.question}</span>
                {item.whoToCall ? (
                  <span className="text-sm text-rule">
                    <span className="font-semibold">Who to ask:</span> {item.whoToCall}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="how-checked" className={`flex flex-col gap-3 ${CARD}`}>
        <h2 id="how-checked" className={SECTION_TITLE}>
          How this was checked
        </h2>
        <HowChecked research={research} />
        <p className="text-muted">
          Checked <LocalDate iso={research.checkedAt.toISOString()} /> from {research.sources.length} official{" "}
          {research.sources.length === 1 ? "page" : "pages"}:
        </p>
        <div className="text-sm">
          <SourceLinks sources={research.sources} />
        </div>
        {research.unreadSources.length ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-semibold">Pages we couldn’t read this time</p>
            <ul className="flex flex-col gap-1">
              {research.unreadSources.map((source) => (
                <li key={source.key}>
                  {source.title}: <span className="text-muted">{source.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {changed ? null : <CheckRequirementsButton label="Re-check sources" variant="secondary" />}
      </section>
    </>
  );
}
