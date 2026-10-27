import Link from "next/link";
import { Suspense } from "react";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { CheckRequirementsButton } from "@/components/requirements/check-button";
import { RequirementCard, SourceLinks } from "@/components/requirements/requirement-card";
import { getMyBusiness, getMyResearch } from "@/lib/data/my-business";
import type { ResearchSnapshot } from "@/lib/data/research";
import type { BusinessProfile, JurisdictionLevel } from "@/lib/domain";
import { STATE_NAMES } from "@/lib/intake/options";
import { profileKey } from "@/lib/research/requirements";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/requirements");
// Re-checking reads several official pages, then waits on a long model call
export const maxDuration = 300;

const PRIMARY_LINK = "flex min-h-12 w-fit items-center rounded-lg bg-accent px-5 font-bold text-white hover:bg-accent-ink";

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
  const [business, research] = await Promise.all([getMyBusiness(), getMyResearch()]);

  if (!business?.profile) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-ink/5">
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
  if (!research) return <FirstCheck profile={business.profile} />;
  return <Results profile={business.profile} research={research} />;
}

function FirstCheck({ profile }: { profile: BusinessProfile }) {
  return (
    <section aria-labelledby="first-check" className="flex flex-col gap-4 rounded-2xl bg-surface p-5 ring-1 ring-ink/5">
      <h2 id="first-check" className="font-display text-xl font-bold">
        Find what applies to you in {STATE_NAMES[profile.location.state]}
      </h2>
      <HowChecked />
      <CheckRequirementsButton label="Find my requirements" variant="primary" />
    </section>
  );
}

function HowChecked({ model }: { model?: string }) {
  return (
    <ul className="flex flex-col gap-2">
      <li className="flex items-start gap-2.5">
        <ActorChip actor="ai" />
        <span>
          {model ? `AI (${model}) read` : "AI reads"} official government pages and {model ? "listed" : "lists"} what
          applies to your business.
        </span>
      </li>
      <li className="flex items-start gap-2.5">
        <ActorChip actor="rule" />
        <span>
          Every quote, fee and deadline {model ? "was" : "is"} checked against the pages. Anything that doesn’t match is
          marked “Needs verification.”
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

  return (
    <>
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

      {GROUPS.map((group) => {
        const items = research.requirements.filter((requirement) => group.levels.includes(requirement.level));
        if (items.length === 0) return null;
        const missing = group.levels.every((level) => !readLevels.has(level));
        const headingId = `group-${group.levels[0]}`;
        return (
          <section key={group.label} aria-labelledby={headingId} className="flex flex-col gap-2.5">
            <h2 id={headingId} className="text-[13px] font-bold uppercase tracking-wider text-muted">
              {group.label === "State" ? stateName : group.label}
            </h2>
            {missing && group.levels[0] !== "federal" ? (
              <p className="text-sm text-muted">
                First Sale doesn’t have official {group.label === "State" ? stateName : "county and city"} pages yet, so
                these say who to ask.
              </p>
            ) : null}
            {items.map((requirement) => (
              <RequirementCard key={requirement.id} requirement={requirement} sources={research.sources} />
            ))}
          </section>
        );
      })}

      <section aria-labelledby="how-checked" className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-ink/5">
        <h2 id="how-checked" className="font-display text-xl font-bold">
          How this was checked
        </h2>
        <HowChecked model={research.model} />
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
