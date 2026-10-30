import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { StepGroup } from "@/components/plan/next-actions";
import { GroupFacts } from "@/components/plan/paperwork";
import { ReviewChanges } from "@/components/plan/review-changes";
import { PracticeBanner } from "@/components/practice-banner";
import { CheckRequirementsButton } from "@/components/requirements/check-button";
import { AnswerButtons, ChangeAnswer, UndoAnswer } from "@/components/requirements/condition-answer";
import { CoverageList } from "@/components/requirements/coverage-list";
import { FollowUpButton } from "@/components/requirements/follow-up-button";
import { SourceLinks } from "@/components/requirements/sources";
import { ResearchRunStatus } from "@/components/requirements/research-run";
import { WrittenInquiry } from "@/components/requirements/written-inquiry";
import { PRIMARY_LINK, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, Chip, Fold, IconTile, Note, PageHead } from "@/components/ui";
import { getMyBusiness, getMyPaperwork, getMyResearch, lastMyRun, type MyPaperwork } from "@/lib/data/my-business";
import type { PlanStep } from "@/lib/data/plan";
import type { ResearchSnapshot } from "@/lib/data/research";
import type { BusinessProfile } from "@/lib/domain";
import { classify, type Place, placeLabel, placeOf, STRUCTURE_NAMES } from "@/lib/research/applicability";
import { answerChanges } from "@/lib/research/changes";
import { followUpCandidates } from "@/lib/research/follow-up";
import { writtenInquiry } from "@/lib/research/inquiry";
import { profileKey } from "@/lib/research/requirements";
import { type PaperworkGroup, type Standing, summaryOf } from "@/lib/rules/paperwork";
import { CHECK_MINUTES, formatMinutes, MAX_SITTING_MINUTES } from "@/lib/rules/progress";
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
            Start your business · Step 3
          </span>
        }
        title="What applies to you"
        lead={`First Sale checks official government sites for the rules that fit your business. Then a few quick questions settle the ones that depend on you. About ${formatMinutes(CHECK_MINUTES)}.`}
      />
      <Suspense fallback={<p className="text-muted">Loading what applies to you…</p>}>
        <Requirements />
      </Suspense>
    </div>
  );
}

async function Requirements() {
  const [business, research, run, paper] = await Promise.all([getMyBusiness(), getMyResearch(), lastMyRun("research", null), getMyPaperwork()]);

  if (!business?.profile || !paper) {
    return (
      <Card>
        <p>
          {business
            ? "Some of your answers need updating before we can look up what applies to you."
            : "Tell us about your business first. Your answers decide which rules apply."}
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
      {research ? <Results profile={business.profile} research={research} paper={paper} /> : <FirstCheck place={place} paper={paper} />}
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

function FirstCheck({ place, paper }: { place: Place; paper: MyPaperwork }) {
  const structure = paper.context.decision.structure;
  return (
    <Card title={`Find what applies to you in ${place.stateName}`} icon="search" id="first-check" bodyClassName="gap-4">
      <HowChecked />
      <p className="text-[15px] text-rule">
        {structure ? (
          `The check uses your business structure: ${STRUCTURE_NAMES[structure]}.`
        ) : (
          <>
            You haven’t chosen a business structure yet, so filings that depend on it wait until you do.{" "}
            <Link href="/structure" className={TEXT_LINK}>
              Business structure
            </Link>
          </>
        )}
      </p>
      <CheckRequirementsButton label="Find what applies to me" variant="primary" />
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

function Results({ profile, research, paper }: { profile: BusinessProfile; research: ResearchSnapshot; paper: MyPaperwork }) {
  const { view, context } = paper;
  const decision = context.decision;
  // Any change to the answers needs a new search; until then, what applies follows the answers that were checked
  const recheck = profileKey(profile) !== research.profileKey;
  const changes = answerChanges(research.profile, profile, (research.structure as typeof decision.structure) ?? null, decision.structure);
  // A change no watched answer explains, or a snapshot saved before answers were kept, can only say that something changed
  const unknownChange = recheck && !changes.some((change) => change.recheck);
  const sourceIds = new Map(research.sources.map((source) => [source.key, source]));
  const place = context.place;

  const by = (inclusion: Standing<PlanStep>["inclusion"]) => view.standings.filter((standing) => standing.inclusion === inclusion);
  const questions = by("question");
  const answered = view.standings.filter((standing) => standing.answer === "yes" || standing.answer === "unsure");
  const said = by("no");
  // Unknown places are steps to find out; being outside city limits is listed, not asked
  const places = [...by("check_place"), ...by("place")];
  const structureWait = by("structure");
  const optional = by("optional");
  const outside = by("outside");
  // Ruled out by the chosen structure: left in the plan until the owner updates it, or already left out of it
  const otherStructure = [
    ...by("other_structure").map((standing) => standing.step.title),
    ...research.requirements
      .filter((requirement) => !classify(requirement, context.profile, place, decision).fitsStructure)
      .map((requirement) => requirement.title)
      .filter((title) => !view.standings.some((standing) => standing.step.title === title)),
  ];
  const groupOf = (key: string) => view.groups.find((group) => group.tasks.some((task) => task.step.key === key)) ?? null;
  const open = view.open.length;
  const applies = view.tasks.length;
  // Saved without the deeper look, such as a check from before it existed
  const unsettled = followUpCandidates(research.requirements).length;

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
          <p className="text-rule">Nothing in your steps changes until you review it. Steps you’ve finished stay finished.</p>
          {recheck ? (
            <CheckRequirementsButton label="Check again" variant="primary" />
          ) : (
            <ActionButton action={replanAction} label="Show what changes" pendingLabel="Working it out…" variant="primary" />
          )}
        </section>
      ) : null}

      {paper.plan.proposal ? (
        <div id="review" className="scroll-mt-4">
          <ReviewChanges
            key={paper.plan.proposal.checkedAt.toISOString()}
            checkedAt={paper.plan.proposal.checkedAt.toISOString()}
            changes={paper.plan.proposal.changes}
            from={paper.plan.proposal.from}
          />
        </div>
      ) : null}

      {!recheck && !research.followedUpAt && unsettled ? (
        <section aria-labelledby="deeper-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-3">
            <IconTile icon="search" tone="ai" />
            <h2 id="deeper-heading" className="font-display text-[22px] leading-snug">
              Some rules aren’t settled yet
            </h2>
          </div>
          <p className="text-rule">
            Official pages from your check didn’t settle {unsettled === 1 ? "one rule" : `${unsettled} rules`}. First Sale can search each office’s own site, explain what usually decides each one, and find who to write to about the rest, with one message per office.
          </p>
          <FollowUpButton count={unsettled} />
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="accent" icon="check">
          {applies} {applies === 1 ? "applies" : "apply"} to you
        </Chip>
        <Chip tone={open ? "warn" : "done"} icon={open ? "question" : "check"}>
          {open ? `${open} ${open === 1 ? "question" : "questions"} left` : "Every question answered"}
        </Chip>
        {said.length ? <Chip icon="minus">{said.length} you said don’t apply</Chip> : null}
        <span className="text-sm text-muted">
          Checked <LocalDate iso={research.checkedAt.toISOString()} />
        </span>
      </div>

      <section id="questions" aria-labelledby="questions-heading" className="flex scroll-mt-4 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="questions-heading" className="font-display text-[24px] leading-snug">
            Quick questions
          </h2>
          <p className="text-[15px] text-muted">
            Each one decides whether a rule applies to you. “Not sure” is a fine answer: finding out becomes a step, with a message you can send.
          </p>
        </div>
        {questions.length ? (
          <ol className="flex flex-col gap-3">
            {questions.map((standing) => (
              <QuestionCard key={standing.step.id} standing={standing} />
            ))}
          </ol>
        ) : open ? null : (
          <Note icon="check" tone="quiet">
            No questions left. Everything that applies to you is in your paperwork below.
          </Note>
        )}
        {places.length ? (
          <Card title="Depends on where you are" icon="pin" id="place-rules" headingLevel={3}>
            <ul className="flex flex-col gap-2.5">
              {places.map((standing) => (
                <li key={standing.step.id} className="flex flex-col gap-0.5">
                  {standing.inclusion === "check_place" ? (
                    <Link href={`/checklist/${standing.step.id}`} className={`w-fit ${TEXT_LINK}`}>
                      {standing.step.title}
                    </Link>
                  ) : (
                    <span className="font-semibold">{standing.step.title}</span>
                  )}
                  <span className="text-[15px] text-rule">{standing.place[0]}</span>
                  {standing.inclusion === "check_place" ? (
                    <span className="text-sm text-muted">Added to your paperwork as a step to find out where you are.</span>
                  ) : null}
                </li>
              ))}
            </ul>
            {places.some((standing) => standing.inclusion === "check_place") ? (
              <Link href="/business/edit" className={SECONDARY_LINK}>
                <Icon name="pencil" size="sm" />
                Confirm your place
              </Link>
            ) : null}
          </Card>
        ) : null}
        {structureWait.length ? (
          <Card title="Depends on your business structure" icon="scale" id="structure-rules" headingLevel={3}>
            <p className="text-[15px] text-rule">These are for some structures only. Which ones you need shows up once you choose.</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 marker:text-faint">
              {structureWait.map((standing) => (
                <li key={standing.step.id}>{standing.step.title}</li>
              ))}
            </ul>
            <Link href="/structure" className={SECONDARY_LINK}>
              <Icon name="scale" size="sm" />
              Go to Business structure
            </Link>
          </Card>
        ) : null}
        {answered.length ? (
          <Fold title={`Your answers (${answered.length})`} summary="What you said applies, or aren’t sure about" icon="check">
            <ul className="flex flex-col divide-y divide-line">
              {answered.map((standing) => (
                <AnsweredRow key={standing.step.id} standing={standing} group={groupOf(standing.step.key)} />
              ))}
            </ul>
          </Fold>
        ) : null}
      </section>

      <Paperwork groups={view.groups} open={open} />

      <div className="flex flex-col gap-3">
        {said.length ? (
          <StepGroup level={2} id="not-for-you" title="Doesn’t apply to you" help="You said no. Undo one to be asked again." icon="minus" count={said.length}>
            <ul className="flex flex-col divide-y divide-line">
              {said.map((standing) => (
                <li key={standing.step.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="flex min-w-0 flex-1 basis-64 flex-col">
                    <span className="font-semibold">{standing.step.title}</span>
                    <span className="text-sm text-muted">You said no to: {standing.question}</span>
                  </span>
                  <UndoAnswer stepKey={standing.step.key} condition={standing.question ?? ""} title={standing.step.title} />
                </li>
              ))}
            </ul>
          </StepGroup>
        ) : null}

        {optional.length ? (
          <Fold title={`Worth knowing (${optional.length})`} summary="Your choice, not required" icon="lightbulb">
            <ShortList items={optional.map((standing) => ({ key: standing.step.id, title: standing.step.title, detail: summaryOf(standing.step), href: `/checklist/${standing.step.id}` }))} />
          </Fold>
        ) : null}

        {outside.length ? (
          <Fold title={`Outside what First Sale checks (${outside.length})`} summary="Rules First Sale doesn’t research, and who does" icon="external">
            <ShortList
              items={outside.map((standing) => ({
                key: standing.step.id,
                title: standing.step.title,
                detail: standing.step.whoToCall ? `Ask ${standing.step.whoToCall}.` : summaryOf(standing.step),
                href: `/checklist/${standing.step.id}`,
              }))}
            />
          </Fold>
        ) : null}

        {otherStructure.length ? (
          <Fold title={`Not for the structure you chose (${otherStructure.length})`} summary="If you change your structure, these come back" icon="minus">
            <ul className="flex list-disc flex-col gap-1 pl-5 text-rule marker:text-faint">
              {otherStructure.map((title) => (
                <li key={title}>{title}</li>
              ))}
            </ul>
          </Fold>
        ) : null}

        {research.conflicts.length ? (
          <Fold title={`Where official pages disagree (${research.conflicts.length})`} summary="Read each one before you rely on it" icon="alert">
            <p className="flex items-center gap-2 text-sm text-muted">
              <ActorChip actor="ai" /> found these
            </p>
            <ul className="flex flex-col gap-4">
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
          </Fold>
        ) : null}

        {research.openQuestions.length ? (
          <Fold title={`Still to find out (${research.openQuestions.length})`} summary="Gaps in what First Sale could check, each with a message you can send" icon="question">
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
                        inquiry={writtenInquiry({ title: "a question about my business’s requirements", questions: [item.question], profile, place: placeOf(profile) })}
                        office={item.whoToCall}
                        link={null}
                      />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </Fold>
        ) : null}

        {research.assumptions.length ? (
          <Fold title="What we assumed" summary="These guesses about your business shaped the list" icon="lightbulb">
            <p className="flex items-center gap-2 text-sm text-muted">
              <ActorChip actor="ai" /> If one is wrong, correct your answers, then check again.
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
          {research.coverage.length ? <CoverageList cells={research.coverage} /> : <p className="text-muted">Check again to see what each part covered.</p>}
        </Fold>

        <Fold title="How this was checked" summary={`${research.sources.length} official ${research.sources.length === 1 ? "page" : "pages"}, and who decided what`} icon="info">
          <HowChecked research={research} />
          <div className="text-sm">
            <SourceLinks sources={research.sources} />
          </div>
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
        </Fold>
      </div>

      {changes.length || unknownChange ? null : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">Rules change. Checking again keeps your answers to these questions unless a question’s wording changes.</p>
          <CheckRequirementsButton label="Check again" variant="secondary" />
        </div>
      )}
    </>
  );
}

function QuestionCard({ standing }: { standing: Standing<PlanStep> }) {
  const id = `q-${standing.step.id}`;
  const why = summaryOf(standing.step);
  return (
    <li className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-4 shadow-card sm:p-5">
      <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">Does this apply to you?</p>
      <p id={id} className="font-display text-[20px] leading-snug">
        {standing.question}
      </p>
      <p className="text-[15px] text-muted">
        <span className="font-semibold text-rule">About: {standing.step.title}.</span> {why}
      </p>
      <AnswerButtons stepKey={standing.step.key} condition={standing.question ?? ""} labelledBy={id} />
    </li>
  );
}

function AnsweredRow({ standing, group }: { standing: Standing<PlanStep>; group: PaperworkGroup<PlanStep> | null }) {
  const id = `a-${standing.step.id}`;
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <span className="flex min-w-0 flex-1 basis-64 flex-col">
          <span id={id} className="font-semibold">
            {standing.step.title}
          </span>
          <span className="text-sm text-muted">{standing.question}</span>
        </span>
        <Chip tone={standing.answer === "yes" ? "accent" : "warn"} icon={standing.answer === "yes" ? "check" : "question"}>
          {standing.answer === "yes" ? "You said yes" : "You’re not sure"}
        </Chip>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]">
        {group ? (
          <Link href={`/checklist/${standing.step.id}`} className={TEXT_LINK}>
            {standing.answer === "unsure" ? "Find out if this applies" : "Open this step"}, in {group.name}
          </Link>
        ) : null}
        <ChangeAnswer stepKey={standing.step.key} condition={standing.question ?? ""} current={standing.answer!} labelledBy={id} />
      </div>
    </li>
  );
}

// What applies, in the groups the menu shows; each step is listed once, on its group's page
function Paperwork({ groups, open }: { groups: PaperworkGroup<PlanStep>[]; open: number }) {
  if (!groups.length) return null;
  const first = groups.find((group) => group.state === "todo") ?? groups[0];
  return (
    <Card title="Your paperwork" icon="checklist" id="paperwork-heading">
      <p className="text-[15px] text-muted">What applies to you, grouped and in order. Each part takes {formatMinutes(MAX_SITTING_MINUTES)} or less.</p>
      <ul className="flex flex-col divide-y divide-line">
        {groups.map((group) => (
          <li key={group.key} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
            <Link href={group.href} className={`w-fit ${TEXT_LINK}`}>
              {group.name}
            </Link>
            <GroupFacts group={group} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2.5">
        <Link href={first.href} className={open ? SECONDARY_LINK : PRIMARY_LINK}>
          {open ? "Start your paperwork" : `Go to ${first.name}`}
          <Icon name="arrow" size="sm" />
        </Link>
        <Link href="/start" className={`flex min-h-11 items-center ${TEXT_LINK}`}>
          See every step
        </Link>
      </div>
    </Card>
  );
}

function ShortList({ items }: { items: { key: string; title: string; detail: string; href: string }[] }): ReactNode {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
          <Link href={item.href} className={`w-fit ${TEXT_LINK}`}>
            {item.title}
          </Link>
          {item.detail ? <span className="text-sm text-muted">{item.detail}</span> : null}
        </li>
      ))}
    </ul>
  );
}
