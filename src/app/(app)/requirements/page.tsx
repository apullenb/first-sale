import Link from "next/link";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { Icon, type IconName } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { StepGroup } from "@/components/plan/next-actions";
import { PracticeBanner } from "@/components/practice-banner";
import { CheckRequirementsButton } from "@/components/requirements/check-button";
import { CoverageList } from "@/components/requirements/coverage-list";
import { RequirementCard, SourceLinks } from "@/components/requirements/requirement-card";
import { RequirementStatusChip } from "@/components/requirements/requirement-status";
import { ResearchRunStatus } from "@/components/requirements/research-run";
import { WrittenInquiry } from "@/components/requirements/written-inquiry";
import { PRIMARY_LINK, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, Fold, IconTile, PageHead } from "@/components/ui";
import { getMyBusiness, getMyDetails, getMyResearch, lastMyRun } from "@/lib/data/my-business";
import type { ResearchSnapshot } from "@/lib/data/research";
import type { BusinessProfile } from "@/lib/domain";
import { classify, jurisdictionName, type Place, placeLabel, placeOf, type RequirementStatus, STATUS_HELP, structureOf } from "@/lib/research/applicability";
import { answerChanges } from "@/lib/research/changes";
import { writtenInquiry } from "@/lib/research/inquiry";
import { profileKey } from "@/lib/research/requirements";
import { sectionMetadata } from "@/lib/sections";
import { replanAction } from "./actions";

export const metadata = sectionMetadata("/requirements");
// Re-checking reads several official pages, then waits on a long model call
export const maxDuration = 300;

export default function RequirementsPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHead
        kicker={
          <span className="inline-flex items-center gap-2">
            <Icon name="search" size="sm" />
            Start your business · Step 2
          </span>
        }
        title="Regulations"
        lead="The rules that apply to your business, where each comes from, and what’s still unknown. Nothing here is a guess dressed up as a rule."
      />
      <Suspense fallback={<p className="text-muted">Loading your requirements…</p>}>
        <Requirements />
      </Suspense>
    </div>
  );
}

async function Requirements() {
  const [business, research, run, details] = await Promise.all([getMyBusiness(), getMyResearch(), lastMyRun("research", null), getMyDetails()]);

  if (!business?.profile) {
    return (
      <Card>
        <p>
          {business
            ? "Some of your answers need updating before we can look up your requirements."
            : "Tell us about your business first. Your answers decide which requirements apply."}
        </p>
        <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
          {business ? "Update your answers" : "Tell us about your business"}
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }
  const place = placeOf(business.profile);
  return (
    <>
      <ResearchRunStatus run={run} />
      <PlaceSummary place={place} />
      {research ? <Results profile={business.profile} research={research} details={details} place={place} /> : <FirstCheck place={place} />}
    </>
  );
}

function PlaceSummary({ place }: { place: Place }) {
  const unsure = place.city && place.insideCity === "unknown";
  const lines: { text: string; known: boolean }[] = [
    { text: `Federal and ${place.stateName} rules apply to you.`, known: true },
    { text: place.county ? `${place.county} County rules may apply.` : "County: not given yet, so county rules aren’t checked.", known: Boolean(place.county) },
    {
      text: !place.city
        ? "City: not given yet."
        : place.insideCity === "yes"
          ? `You’re inside ${place.city} city limits, so its rules apply.`
          : place.insideCity === "no"
            ? `You’re outside ${place.city} city limits. Your township or village may have its own rules.`
            : `Not confirmed whether you’re inside ${place.city} city limits. A mailing address or ZIP code doesn’t say.`,
      known: Boolean(place.city) && place.insideCity !== "unknown",
    },
  ];
  return (
    <Card title="Where your rules come from" icon="pin" id="place-heading">
      <p className="font-display text-xl leading-snug">{placeLabel(place)}</p>
      <ul className="flex flex-col gap-1.5 text-[15px] text-rule">
        {lines.map((line) => (
          <li key={line.text} className="flex items-start gap-2.5">
            <Icon name={line.known ? "check" : "question"} size="sm" className={`mt-0.5 ${line.known ? "text-accent" : "text-check"}`} />
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      {unsure || !place.county ? (
        <Link href="/business/edit" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
          Confirm your place
        </Link>
      ) : null}
    </Card>
  );
}

function FirstCheck({ place }: { place: Place }) {
  return (
    <Card title={`Find what applies to you in ${place.stateName}`} icon="search" id="first-check" bodyClassName="gap-4">
      <HowChecked />
      <CheckRequirementsButton label="Find my requirements" variant="primary" />
    </Card>
  );
}

// Without a snapshot, says how a check works; with one, how that check went
function HowChecked({ research }: { research?: ResearchSnapshot }) {
  return (
    <ul className="flex flex-col gap-2.5 text-[15px]">
      <li className="flex items-start gap-2.5">
        <ActorChip actor={research?.simulated ? "rule" : "ai"} />
        <span>
          {research?.simulated
            ? "Practice rules read official pages and matched your answers to a fixed list. No AI looked at your business, and state and local sites weren’t searched."
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
          Only sites on the official .gov list count as official, and every quote, fee and deadline {research ? "was" : "is"} checked against the
          page. Rules then decide whether each one applies to you, from your answers.
        </span>
      </li>
    </ul>
  );
}

const GROUPS: { status: RequirementStatus; heading: string; icon: IconName; tone: "accent" | "gray" | "warn" }[] = [
  { status: "verified", heading: "Applies to you", icon: "check", tone: "accent" },
  { status: "conditional", heading: "Depends on something", icon: "branch", tone: "gray" },
  { status: "needs_confirmation", heading: "To confirm", icon: "question", tone: "warn" },
  { status: "optional", heading: "Your choice", icon: "plus", tone: "gray" },
  { status: "outside_coverage", heading: "Outside what First Sale checks", icon: "external", tone: "gray" },
];

const LEVEL_ORDER = { federal: 0, state: 1, county: 2, city: 3 } as const;

function Results({
  profile,
  research,
  details,
  place,
}: {
  profile: BusinessProfile;
  research: ResearchSnapshot;
  details: { key: string; value: string }[];
  place: Place;
}) {
  const decision = structureOf(profile, details);
  // Any change to the answers needs a new search; until then, statuses and places follow the answers that were checked
  const recheck = profileKey(profile) !== research.profileKey;
  const basis = recheck && research.profile ? research.profile : profile;
  const basisPlace = recheck && research.profile ? placeOf(research.profile) : place;
  const standings = new Map(research.requirements.map((requirement) => [requirement.id, classify(requirement, basis, basisPlace, decision)]));
  const fitting = research.requirements.filter((requirement) => standings.get(requirement.id)!.fitsStructure);
  const ruledOut = research.requirements.filter((requirement) => !standings.get(requirement.id)!.fitsStructure);
  const changes = answerChanges(research.profile, profile, (research.structure as typeof decision.structure) ?? null, decision.structure);
  // A change no watched answer explains, or a snapshot saved before answers were kept, can only say that something changed
  const unknownChange = recheck && !changes.some((change) => change.recheck);
  const hasQuestions = research.openQuestions.length > 0;
  const sourceIds = new Map(research.sources.map((source) => [source.key, source]));

  return (
    <>
      {research.simulated ? <PracticeBanner what="These requirements are practice results." /> : null}

      {changes.length || unknownChange ? (
        <section aria-labelledby="changed-heading" className="flex flex-col gap-3 rounded-2xl border border-check-ring bg-check-tint p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <IconTile icon="refresh" tone="warn" />
            <h2 id="changed-heading" className="font-display text-[22px] leading-snug">
              Your answers changed since this check
            </h2>
          </div>
          {changes.length ? (
            <ul className="flex flex-col gap-1.5">
              {changes.map((change) => (
                <li key={change.what} className="flex flex-col">
                  <span className="font-semibold">
                    {change.what}
                    {change.before || change.now ? `: ${change.before || "not given"} → ${change.now || "not given"}` : " changed"}
                  </span>
                  <span className="text-sm text-rule">Can change: {change.affects}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Some of your answers changed.</p>
          )}
          <p className="text-rule">Nothing in your plan changes until you review it. Steps you’ve finished stay finished.</p>
          {recheck ? (
            <CheckRequirementsButton label="Re-check sources" variant="primary" />
          ) : (
            <ActionButton action={replanAction} label="Update my plan" pendingLabel="Updating…" variant="primary" doneHref="/checklist" />
          )}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul aria-label="How many of each" className="flex flex-wrap gap-2">
          {GROUPS.map((group) => {
            const count = fitting.filter((requirement) => standings.get(requirement.id)!.status === group.status).length;
            return count ? (
              <li key={group.status}>
                <a
                  href={`#group-${group.status}`}
                  className="flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-surface py-1 pr-3 pl-1.5 shadow-soft transition hover:border-line-strong motion-reduce:transition-none"
                >
                  <RequirementStatusChip status={group.status} />
                  <span className="text-[15px] font-bold tabular-nums">{count}</span>
                </a>
              </li>
            ) : null;
          })}
        </ul>
        {fitting.length ? (
          <Link href="/checklist" className={PRIMARY_LINK}>
            See your licenses and registrations
            <Icon name="arrow" size="sm" />
          </Link>
        ) : null}
      </div>

      {GROUPS.map((group) => {
        const items = fitting
          .filter((requirement) => standings.get(requirement.id)!.status === group.status)
          .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
        if (!items.length) return null;
        return (
          <section key={group.status} id={`group-${group.status}`} aria-labelledby={`heading-${group.status}`} className="flex scroll-mt-4 flex-col gap-3">
            <div className="flex items-center gap-3">
              <IconTile icon={group.icon} tone={group.tone} />
              <div className="flex min-w-0 flex-col">
                <h2 id={`heading-${group.status}`} className="font-display text-[22px] leading-snug">
                  {group.heading} <span className="font-sans text-lg font-semibold text-muted tabular-nums">({items.length})</span>
                </h2>
                <p className="text-sm text-muted">{STATUS_HELP[group.status]}</p>
              </div>
            </div>
            {items.map((requirement) => (
              <RequirementCard
                key={requirement.id}
                requirement={requirement}
                sources={research.sources}
                standing={standings.get(requirement.id)!}
                inquiry={writtenInquiry({ title: requirement.title, questions: requirement.whatToAsk, profile, place })}
                jurisdiction={jurisdictionName(requirement.level, basisPlace)}
              />
            ))}
          </section>
        );
      })}

      <div className="flex flex-col gap-3">
        {ruledOut.length ? (
          <StepGroup
            level={2}
            id="ruled-out"
            title="Not for the structure you chose"
            help="If you change your structure, these come back."
            icon="minus"
            count={ruledOut.length}
          >
            <ul className="flex list-disc flex-col gap-1 pl-5 text-rule marker:text-faint">
              {ruledOut.map((requirement) => (
                <li key={requirement.id}>{requirement.title}</li>
              ))}
            </ul>
          </StepGroup>
        ) : null}

        {research.conflicts.length ? (
          <StepGroup
            level={2}
            id="conflicts"
            title="Where official pages disagree or leave a gap"
            help="Read each one before you rely on it."
            icon="alert"
            tone="warn"
            count={research.conflicts.length}
            open
          >
            <p className="flex items-center gap-2 text-sm text-muted">
              <ActorChip actor="ai" /> found these
            </p>
            <ul className="mt-2 flex flex-col gap-4">
              {research.conflicts.map((conflict, index) => (
                <li key={index} className="flex flex-col gap-1.5">
                  <p className="font-semibold">{conflict.about}</p>
                  <p className="text-rule">{conflict.explanation}</p>
                  <div className="text-sm">
                    <SourceLinks sources={conflict.sourceIds.flatMap((key) => sourceIds.get(key) ?? [])} />
                  </div>
                </li>
              ))}
            </ul>
          </StepGroup>
        ) : null}

        {hasQuestions ? (
          <StepGroup
            level={2}
            id="still-to-find-out"
            title="Still to find out"
            help="First Sale couldn’t settle these. Each one says who can tell you, with a message you can send."
            icon="question"
            tone="warn"
            count={research.openQuestions.length}
            open
          >
            <ul className="flex flex-col gap-2.5">
              {research.openQuestions.map((item, index) => (
                <li key={index} className="flex flex-col gap-1 rounded-xl border border-line bg-soft px-3.5 py-3">
                  <span className="font-semibold">{item.question}</span>
                  {item.whoToCall ? (
                    <span className="flex items-center gap-1.5 text-sm text-rule">
                      <Icon name="office" size="xs" className="text-faint" />
                      <span>
                        <span className="font-semibold">Who can tell you:</span> {item.whoToCall}
                      </span>
                    </span>
                  ) : null}
                  <details className="group/ask">
                    <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-accent hover:text-accent-ink [&::-webkit-details-marker]:hidden">
                      <Icon name="chevron" size="sm" className="transition-transform group-open/ask:rotate-90 motion-reduce:transition-none" />
                      Ask in writing
                    </summary>
                    <div className="mt-1 text-[15px]">
                      <WrittenInquiry
                        inquiry={writtenInquiry({ title: "a question about my business’s requirements", questions: [item.question], profile, place })}
                        office={item.whoToCall}
                        link={null}
                      />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </StepGroup>
        ) : null}

        {research.assumptions.length ? (
          <Fold title="What we assumed" summary="These guesses about your business shaped the list" icon="lightbulb">
            <p className="flex items-center gap-2 text-sm text-muted">
              <ActorChip actor="ai" /> If one is wrong, correct your answers, then re-check.
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-faint">
              {research.assumptions.map((assumption, index) => (
                <li key={index}>{assumption}</li>
              ))}
            </ul>
            <Link href="/business/edit" className={SECONDARY_LINK}>
              <Icon name="pencil" size="sm" />
              Correct your answers
            </Link>
          </Fold>
        ) : null}

        <Fold title="What we checked" summary="A gap means we couldn’t check, not that there’s no rule" icon="search">
          {research.coverage.length ? <CoverageList cells={research.coverage} /> : <p className="text-muted">Re-check to see what each part covered.</p>}
        </Fold>
      </div>

      <Card title="How this was checked" icon="info" id="how-checked">
        <HowChecked research={research} />
        <p className="text-muted">
          Checked <LocalDate iso={research.checkedAt.toISOString()} /> from {research.sources.length} official {research.sources.length === 1 ? "page" : "pages"}.
        </p>
        <details className="group/src">
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-accent hover:text-accent-ink [&::-webkit-details-marker]:hidden">
            <Icon name="chevron" size="sm" className="transition-transform group-open/src:rotate-90 motion-reduce:transition-none" />
            See the {research.sources.length} official {research.sources.length === 1 ? "page" : "pages"}
          </summary>
          <div className="mt-1 text-sm">
            <SourceLinks sources={research.sources} />
          </div>
        </details>
        {research.unreadSources.length ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-semibold">Pages we couldn’t read this time</p>
            <ul className="flex flex-col gap-1">
              {research.unreadSources.map((source) => (
                <li key={source.key}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                    {source.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                  : <span className="text-muted">{source.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {changes.length || unknownChange ? null : <CheckRequirementsButton label="Re-check sources" variant="secondary" />}
      </Card>
    </>
  );
}
