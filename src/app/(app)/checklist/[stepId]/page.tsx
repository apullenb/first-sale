import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AgreementCard } from "@/components/documents/agreement-card";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { AlreadyDone } from "@/components/plan/already-done";
import { FilingPaths, MissingDetails, usesPaths } from "@/components/plan/filing-paths";
import { FilingLines, FilingSteps } from "@/components/plan/filing-steps";
import { type FormDoc, OfficialFormCard } from "@/components/plan/official-form-card";
import { RecordUpload } from "@/components/plan/record-upload";
import { PenCheck, TOPIC_ICONS } from "@/components/plan/step-row";
import { StepStatus } from "@/components/plan/step-status";
import { StructureDecision } from "@/components/plan/structure-decision";
import { PracticeBanner } from "@/components/practice-banner";
import { StatusChip } from "@/components/requirements/sources";
import { RequirementStatusChip } from "@/components/requirements/requirement-status";
import { WrittenInquiry } from "@/components/requirements/written-inquiry";
import { ACTION_ITEM, PAGE_TITLE, PRIMARY_LINK, SECONDARY, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { ActionKicker, Chip, Fact, Fold, Note, ResourceLink } from "@/components/ui";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import type { StoredDocument } from "@/lib/data/documents";
import type { PlanStep } from "@/lib/data/plan";
import { getMyBusiness, getMyDetails, getMyPaperwork, getMyStep, listMyDocuments } from "@/lib/data/my-business";
import { autofillContext, autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { filedForm, formsFor } from "@/lib/documents/form-catalog";
import { ROLE_LABELS, roleOf } from "@/lib/documents/library";
import { agreementName, agreementStepKey, agreementStructure } from "@/lib/documents/owners-agreement";
import { formatFee } from "@/lib/documents/startup-plan";
import { ACCEPTED_TYPES } from "@/lib/documents/upload";
import { LEVEL_LABELS, TOPIC_LABELS } from "@/lib/labels";
import type { BusinessProfile } from "@/lib/domain";
import { jurisdictionName, type Place, placeGap, placeOf, structureOf } from "@/lib/research/applicability";
import { writtenInquiry } from "@/lib/research/inquiry";
import { explainTerms, termsIn } from "@/lib/plain-words";
import { type FilingStep, filingPaths, filingSteps } from "@/lib/rules/filing";
import { choosesStructure } from "@/lib/rules/plan";
import { nextTaskAfter, type Standing, stepLinks } from "@/lib/rules/paperwork";
import { formatMinutes, stepMinutes } from "@/lib/rules/progress";

export const metadata: Metadata = { title: "Paperwork step" };

type Params = Promise<{ stepId: string }>;

export default function StepPage({ params }: { params: Params }) {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Suspense fallback={<p className="text-muted">Loading this step…</p>}>
        <StepDetail params={params} />
      </Suspense>
    </div>
  );
}

const LINK_ITEM = "flex min-h-11 w-fit items-center font-semibold underline decoration-line-strong underline-offset-4 hover:text-accent hover:decoration-accent";
const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });
// The one main card on a step: what the owner does here
const STATE_CARD = "flex flex-col gap-4 rounded-2xl border border-line p-4 sm:px-6 sm:py-[22px]";
const KICKER = "flex items-center gap-2.5 text-[13.5px] font-bold uppercase tracking-[0.08em]";
const STATE_TITLE = "font-display text-[23px] leading-snug";

async function StepDetail({ params }: { params: Params }) {
  const { stepId } = await params;
  const [found, documents, business, details, paper] = await Promise.all([getMyStep(stepId), listMyDocuments(), getMyBusiness(), getMyDetails(), getMyPaperwork()]);
  if (!found) notFound();
  const { step: stored, all } = found;
  const profile = business?.profile ?? null;
  // What applies now, after the owner's answers and decisions
  const standing = paper?.view.standings.find((each) => each.step.id === stored.id) ?? null;
  const task = paper?.view.tasks.find((each) => each.step.id === stored.id) ?? null;
  const group = task ? (paper?.view.groups.find((each) => each.key === task.group) ?? null) : null;
  const step = standing ? { ...stored, requirementStatus: standing.requirementStatus, conditions: standing.conditions } : stored;

  // Prerequisites by the same rules as the locks: steps that don't apply never hold this one up
  const links = paper && !stored.retired ? stepLinks(paper.view, stored, paper.context.place) : { before: [], after: [] };
  const before = links.before;
  const after = links.after.map((each) => each.step);
  const linked = documents.filter((doc) => doc.taskId === step.id);
  const sourced = step.verification === "sourced";
  // Undecided owners see every form that fits, each saying who it's for
  const forms = profile ? formsFor(OFFICIAL_FORMS, step, placeOf(profile), structureOf(profile, details).structure) : [];
  // The numbered steps follow a form only when one filed form fits; the cards say who each is for
  const form = filedForm(forms);

  const place = profile ? placeOf(profile) : null;
  const decision = profile ? structureOf(profile, details) : null;
  const conditions = step.conditions;
  const facts = profile ? autofillFacts(profile, details) : [];
  // The owners' agreement shows on the step that forms the business, once an LLC or partnership is chosen
  const agreementFor = agreementStructure(decision?.structure ?? null);
  const agreementHere = agreementFor !== null && !step.retired && agreementStepKey(all.filter((each) => !each.retired), agreementFor) === step.key;
  const agreement = documents.find((doc) => doc.generatedKind === "owners_agreement") ?? null;
  const forForm = (key: string, role: "original" | "answer_guide"): FormDoc | null => {
    const doc = documents.find((each) => each.formKey === key && each.role === role);
    return doc ? { doc, outdated: outdatedFacts(doc.factsUsed, facts) } : null;
  };
  const cards = forms.map((each) => {
    const original = forForm(each.key, "original");
    const guide = forForm(each.key, "answer_guide");
    const reviewed = documents.filter((doc) => doc.role === "reviewed" && (doc.familyId === original?.doc.id || doc.familyId === guide?.doc.id));
    return { form: each, original, guide, reviewed };
  });
  const missing =
    form && profile
      ? [
          ...new Set(
            form.fields.flatMap((rule) => {
              const filled = rule.answer(autofillContext(profile, details));
              return "missing" in filled ? [filled.missing.replace(/^(Decide your business structure first)\b.*$/, "$1.")] : [];
            }),
          ),
        ]
      : [];
  const filing = !choosesStructure(step);
  // Locks come from the same rules as the lists and the menu
  const blockers = task && step.status === "todo" ? task.blockers : [];
  const lockedBy = blockers.filter((each) => !each.office);
  const nextTask = step.retired || !paper ? null : nextTaskAfter(paper.view.tasks, step.key);
  const next = nextTask ? { ...nextTask.step, requirementStatus: nextTask.requirementStatus } : null;
  const back = group ? { href: group.href, label: group.name } : { href: "/start", label: "Start your business" };
  const accept = Object.keys(ACCEPTED_TYPES).join(",");
  // First Sale's reason, when no official page spells the rule out for this place
  const reason = sourced || task?.kind === "confirm" ? null : (step.notes?.[0]?.background ?? null);

  const minutes = formatMinutes(stepMinutes(step));
  // Two official pages that disagree are shown in the numbered steps, never settled here
  const feesDiffer = step.feeCents !== null && form?.fee != null && form.fee.cents !== step.feeCents;
  const feeCents = step.feeCents ?? form?.fee?.cents ?? null;
  const fileable = filing && cards.some((card) => !card.form.kept);
  const filed = filingSteps({
    title: step.title,
    agency: step.agency,
    feeCents: step.feeCents,
    feeCheckedAt: step.feeCheckedAt,
    deadline: step.deadline,
    renewal: step.renewal,
    links: step.links,
    prepare: step.prepare,
    doneWhen: step.doneWhen,
    waitingOn: before.filter((prerequisite) => !prerequisite.done).map((prerequisite) => prerequisite.title),
    following: after.map((following) => following.title),
    form,
    missing,
  });
  // Legal terms get plain words the first time they show on this page
  const explained = new Set<string>();
  const termContext = `${step.title} ${form?.title ?? ""}`;
  const plain = (lines: FilingStep["lines"]) => lines.map((line) => ({ ...line, text: explainTerms(line.text, explained, termContext) }));
  // A step that's ready to do shows one choice of how, with each way's own steps
  const pathForm = fileable && !step.retired && step.status === "todo" && !blockers.length && usesPaths(form) ? form : null;
  const formTerms = pathForm ? termsIn(pathForm.title, explained, termContext) : [];
  const linesOf = (kind: FilingStep["kind"]) => filed.find((each) => each.kind === kind)?.lines ?? [];
  // What comes first and what to have ready; missing details show on their own below
  const firstLines = pathForm
    ? plain([...linesOf("before").filter((line) => !line.text.startsWith("Nothing has to come first")), ...linesOf("gather").filter((line) => !line.unknown)])
    : [];
  const missingPlain = missing.map((item) => explainTerms(item, explained, termContext));
  const rawPaths = pathForm ? filingPaths(pathForm) : null;
  const paths = rawPaths
    ? {
        paper: rawPaths.paper ? { send: plain(rawPaths.paper.send) } : null,
        online: rawPaths.online ? { ...rawPaths.online, send: plain(rawPaths.online.send) } : null,
      }
    : null;
  // With the ways shown above, the read-ahead keeps only what they share
  const how = filed.filter((each) => !paths || !["before", "form", "submit", "gather"].includes(each.kind)).map((each) => ({ ...each, lines: plain(each.lines) }));
  const pathCard = pathForm ? cards.find((card) => card.form.key === pathForm.key) : undefined;
  const keptCards = cards.filter((card) => card.form.kept);
  const formsHere =
    paths || step.retired || (!cards.length && !missing.length) ? null : (
      <>
        {step.retired
          ? null
          : cards.map((card) => (
              <OfficialFormCard key={card.form.key} stepId={step.id} form={card.form} original={card.original} guide={card.guide} reviewed={card.reviewed} />
            ))}
        {missing.length ? (
          <Link href="/business" className={SECONDARY_LINK}>
            <Icon name="pencil" size="sm" />
            Add missing details to your business
          </Link>
        ) : null}
      </>
    );
  const receipt = step.retired ? null : (
    <details className="group/up">
      <summary className={`${SECONDARY} w-fit list-none text-[15px] [&::-webkit-details-marker]:hidden`}>
        <Icon name="upload" size="sm" />
        Upload your receipt
      </summary>
      <div className="mt-3 rounded-xl border border-line bg-soft p-4">
        <RecordUpload stepId={step.id} accept={accept} />
      </div>
    </details>
  );
  const steps = <FilingSteps steps={how} extras={{ form: formsHere, receipt }} label={paths ? "Before and after" : undefined} />;
  const locked = blockers.length > 0;
  const checkPlace = task?.kind === "check_place";
  const findOut = task?.kind === "confirm";
  const gap = checkPlace && paper ? placeGap(step.level, paper.context.place) : null;
  const ready = !step.retired && step.status === "todo" && !locked;
  const confirming = step.links.find((link) => link.confirms) ?? null;
  const howSourced = how.some((each) => each.lines.some((line) => line.source));
  const progress = (
    <StepStatus
      key={`${step.id}-${step.status}`}
      stepId={step.id}
      title={step.title}
      status={step.status}
      note={step.evidenceNote}
      submittedAt={step.submittedAt?.toISOString() ?? null}
      submissionNote={step.submissionNote}
      filing={filing}
    />
  );

  return (
    <>
      <Link href={back.href} className="-mb-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-accent">
        <Icon name="back" size="sm" />
        {back.label}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-[min(100%,420px)] flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="gray" icon={TOPIC_ICONS[step.topic]}>
              {TOPIC_LABELS[step.topic]}
            </Chip>
            {checkPlace ? (
              <Chip tone="warn" icon="pin">
                Add where you are
              </Chip>
            ) : findOut ? (
              <Chip tone="warn" icon="question">
                Find out for sure
              </Chip>
            ) : (
              <RequirementStatusChip status={step.requirementStatus} />
            )}
            {step.status === "done" ? (
              <Chip tone="done" icon="check">
                Done
              </Chip>
            ) : step.status === "submitted" ? (
              <Chip tone="warn" icon="hourglass">
                Waiting to hear back
              </Chip>
            ) : locked ? (
              <Chip tone="gray" icon="lock">
                Locked for now
              </Chip>
            ) : null}
            {step.timing === "later" ? (
              <Chip icon="calendar">Later</Chip>
            ) : null}
          </div>
          <h1 className={PAGE_TITLE}>{step.title}</h1>
          {step.timing === "later" ? <p className="text-[15px] text-muted">This comes later: you don’t need it before your first sale.</p> : null}
        </div>
        {step.retired ? null : <AlreadyDone key={step.status} stepId={step.id} title={step.title} accept={accept} markDone={step.status === "todo" && !choosesStructure(step)} />}
      </div>

      <div className="-mt-1 flex flex-wrap gap-2">
        <Fact icon="clock">
          <b className="font-bold text-ink">{minutes}</b> of your time
        </Fact>
        {feesDiffer ? (
          <Fact icon="coins">Official pages differ on the fee</Fact>
        ) : feeCents !== null ? (
          <Fact icon="coins">{feeCents === 0 ? "Free" : formatFee(feeCents)}</Fact>
        ) : fileable ? (
          <Fact icon="coins">Fee set by the office</Fact>
        ) : null}
        {step.agency ? <Fact icon="office">{step.agency}</Fact> : null}
        <Fact icon="pin">
          {LEVEL_LABELS[step.level]}
          {place ? `: ${jurisdictionName(step.level, place)}` : ""}
        </Fact>
        {form?.onlineUrl ? <Fact icon="globe">Online</Fact> : null}
      </div>

      {step.simulated ? <PracticeBanner what="This step came from practice results." /> : null}
      {standing && !task && !step.retired && standing.inclusion !== "structure_choice" ? <NotOnList standing={standing} /> : null}
      {step.retired ? (
        <Note icon="info" tone="quiet">
          A later check of your requirements left this step out of your plan. You’d already finished it, so it stays here for your records.
        </Note>
      ) : null}

      {step.retired ? null : step.status === "done" ? (
        <section aria-labelledby="progress-heading" className={`scroll-mt-4 ${STATE_CARD} bg-surface shadow-lift`}>
          <div className="flex items-center gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-[1.5px] border-done/25 bg-done-tint text-done">
              <PenCheck size={26} />
            </span>
            <div className="flex min-w-0 flex-col">
              <h2 id="progress-heading" className={STATE_TITLE}>
                Done{step.completedAt ? <> on <LocalDate iso={step.completedAt.toISOString()} /></> : null}
              </h2>
              <p className="text-muted">{choosesStructure(step) ? "You recorded your choice on Business structure." : filing ? "Approved or finished." : "You marked this done."}</p>
            </div>
          </div>
          {choosesStructure(step) ? <StructureDecision key={step.id} current={details.find((detail) => detail.key === "structure_choice")?.value ?? null} /> : progress}
          <NextUp next={next} back={back} />
        </section>
      ) : locked ? (
        <section aria-labelledby="progress-heading" className={`scroll-mt-4 ${STATE_CARD} items-start bg-soft shadow-soft`}>
          <p className={`${KICKER} text-muted`}>
            <Icon name="lock" size="sm" />
            Locked for now
          </p>
          <h2 id="progress-heading" className={STATE_TITLE}>
            {lockedBy.length
              ? `Do this first: ${LIST.format(lockedBy.map((each) => each.title))}`
              : `Waits on the office to approve ${LIST.format(blockers.map((each) => `“${each.title}”`))}`}
          </h2>
          <p className="text-muted">
            You can read ahead. This step opens once that’s done.
            {choosesStructure(step) ? "" : " Already did it on your own? Use “I’ve already done this” at the top."}
          </p>
          <Link href={(lockedBy[0] ?? blockers[0]).href} className={PRIMARY_LINK}>
            Take me there
            <Icon name="arrow" size="sm" />
          </Link>
        </section>
      ) : step.status === "submitted" ? (
        <section aria-labelledby="progress-heading" className={`scroll-mt-4 ${ACTION_ITEM}`}>
          <ActionKicker>Waiting to hear back</ActionKicker>
          <h2 id="progress-heading" className={STATE_TITLE}>
            Mark it when it’s approved
          </h2>
          {progress}
        </section>
      ) : (
        <section aria-labelledby="part-heading" className={ACTION_ITEM}>
          <ActionKicker>
            {checkPlace ? "Add where you are" : "Your part"} · about {minutes}
          </ActionKicker>
          {checkPlace ? (
            <>
              <h2 id="part-heading" className={STATE_TITLE}>
                Tell us where your business is
              </h2>
              {gap ? <PlaceGap gap={gap} condition={step.conditions[0] ?? ""} /> : null}
            </>
          ) : (
            <>
              {findOut && profile && place ? <AskOffice step={step} profile={profile} place={place} /> : null}
              {reason ? (
                <Note icon="lightbulb">
                  <p className="font-semibold">Why you need this</p>
                  <p>{reason}</p>
                </Note>
              ) : null}
              <h2 id="part-heading" className={STATE_TITLE}>
                {choosesStructure(step)
                  ? "Choose how your business is owned"
                  : paths?.paper && paths.online
                    ? "Choose how to do it"
                    : fileable
                      ? "First Sale fills in the blanks your details answer. You check, sign and send it yourself."
                      : "Here’s how to do it yourself"}
              </h2>
              {choosesStructure(step) ? (
                <StructureDecision key={step.id} current={details.find((detail) => detail.key === "structure_choice")?.value ?? null} />
              ) : paths && pathForm ? (
                <>
                  <div className="-mt-2 flex flex-col gap-1">
                    <p className="text-rule">{pathForm.title}</p>
                    {formTerms.map((term) => (
                      <p key={term.term} className="text-[15px] text-muted">
                        {term.plain}
                      </p>
                    ))}
                    <ResourceLink href={pathForm.pageUrl}>{pathForm.pageTitle}</ResourceLink>
                  </div>
                  {firstLines.length || keptCards.length ? (
                    <div className="flex flex-col gap-2">
                      <h3 className="font-bold">Before you start</h3>
                      {firstLines.length ? <FilingLines lines={firstLines} /> : null}
                      {keptCards.map((card) => (
                        <OfficialFormCard key={card.form.key} quiet stepId={step.id} form={card.form} original={card.original} guide={card.guide} reviewed={card.reviewed} />
                      ))}
                    </div>
                  ) : null}
                  {missing.length ? <MissingDetails items={missingPlain} /> : null}
                  <FilingPaths stepId={step.id} form={pathForm} paths={paths} original={pathCard?.original ?? null} guide={pathCard?.guide ?? null} reviewed={pathCard?.reviewed ?? []} />
                </>
              ) : (
                steps
              )}
              {choosesStructure(step) ? (
                <p id="progress-heading" className="border-t border-line pt-4 text-[15px] text-muted">
                  This step is done once you record your choice on Business structure.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-3 border-t border-line pt-4">
                    <h3 id="progress-heading" className="flex scroll-mt-4 items-center gap-2.5 font-bold">
                      Record what you did
                    </h3>
                    {progress}
                  </div>
                  <p className="text-sm text-muted">Opening a link or a form never changes this. You record what you did. First Sale never files anything for you.</p>
                </>
              )}
            </>
          )}
        </section>
      )}

      {agreementHere && profile ? (
        <AgreementCard
          name={agreementName(agreementFor, profile.location.state === "TX")}
          owners={profile.owners.count}
          doc={agreement}
          outdated={agreement ? outdatedFacts(agreement.factsUsed, facts) : []}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        {ready && !choosesStructure(step) && !checkPlace && !paths ? null : (
          <Fold
            title={paths ? "Fees, timing and what happens after" : "How to do it yourself"}
            summary={`${paths ? "The fee, your receipt and what’s next" : step.status === "done" || step.retired ? "The steps" : `Read ahead: ${how.length} steps`}${howSourced ? ", with official sources" : ""}`}
            icon="list"
          >
            {steps}
          </Fold>
        )}

        <Fold title="Why it’s on your list" summary={step.agency || jurisdictionLabel(step, place)} icon="info" open={conditions.length > 0 && step.status === "todo"}>
          {step.why ? <p>{explainTerms(step.why, explained, termContext)}</p> : null}
          {conditions.length ? (
            <Note icon="branch">
              <p className="font-semibold">It depends on</p>
              <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5">
                {conditions.map((condition, index) => (
                  <li key={index}>{condition}</li>
                ))}
              </ul>
            </Note>
          ) : null}
          {step.alreadyHave ? (
            <Note icon="check" tone="quiet">
              {step.alreadyHave}
            </Note>
          ) : null}
        </Fold>

        <Fold
          title="Official source"
          summary={confirming ? confirming.title : step.links[0] ? `A related page: ${step.links[0].title}` : "Decided by First Sale from how this works for businesses like yours"}
          icon="link"
        >
          {step.links.length ? (
            <ul className="grid gap-1.5">
              {step.links.map((link) => (
                <li key={link.url} className="flex flex-col">
                  <ResourceLink href={link.url} className="w-fit text-[15px]">
                    {link.title}
                  </ResourceLink>
                  <small className="pl-5 text-sm text-muted">
                    {link.government}
                    {link.confirms ? " · confirms this step" : " · a related page"}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-rule">The official pages First Sale read don’t spell this out for your area, so it decided from how it works for businesses like yours.</p>
          )}
          {sourced ? <StatusChip sourced /> : null}
        </Fold>

        {before.length || after.length ? (
          <Fold
            title="What comes before and after"
            summary={[
              before.length ? `Finish ${before.length} first` : null,
              after.length ? `${before.length ? "unlocks" : "Unlocks"} ${after.length}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            icon="branch"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {before.length ? (
                <section aria-labelledby="before-heading" className="flex flex-col gap-1">
                  <h3 id="before-heading" className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">
                    Finish first
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {before.map((prerequisite) => (
                      <li key={prerequisite.href} className="flex flex-col pb-1">
                        <Link href={prerequisite.href} className={LINK_ITEM}>
                          {prerequisite.title}
                        </Link>
                        <PrerequisiteState done={prerequisite.done} office={prerequisite.office} />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {after.length ? (
                <section aria-labelledby="after-heading" className="flex flex-col gap-1">
                  <h3 id="after-heading" className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">
                    This step unlocks
                  </h3>
                  <ul className="flex flex-col">
                    {after.map((following) => (
                      <li key={following.id}>
                        <Link href={`/checklist/${following.id}`} className={LINK_ITEM}>
                          {following.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </Fold>
        ) : null}

        <Fold title="Documents for this step" summary={linked.length ? `${linked.length} saved` : "None saved yet"} icon="file">
          {linked.length ? <LinkedDocuments docs={linked} /> : <p className="text-muted">No documents are linked to this step yet.</p>}
          {step.retired ? null : <p className="text-[15px] text-muted">Use “Upload a document” at the top of this page to save a receipt or approval here.</p>}
          <Link href={`/documents?step=${encodeURIComponent(step.id)}`} className={SECONDARY_LINK}>
            Get help with another form for this step
          </Link>
        </Fold>
      </div>

      {step.retired ? (
        <Link href="/start" className={SECONDARY_LINK}>
          <Icon name="back" size="sm" />
          See every step
        </Link>
      ) : step.status === "done" ? null : (
        <WhatsNext next={next} back={back} />
      )}
    </>
  );
}

function jurisdictionLabel(step: PlanStep, place: ReturnType<typeof placeOf> | null): string {
  return `${LEVEL_LABELS[step.level]}${place ? `: ${jurisdictionName(step.level, place)}` : ""}`;
}

// After a step is done: always somewhere to go, the next ready step, never back to one that points here
function NextUp({ next, back }: { next: PlanStep | null; back: { href: string; label: string } }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-soft p-4">
      {next ? (
        <>
          <ActionKicker>Up next</ActionKicker>
          <p className="font-display text-xl leading-snug">{next.title}</p>
          <p className="-mt-1 flex items-center gap-1.5 text-[15px] text-muted">
            <Icon name="clock" size="sm" />
            About {formatMinutes(stepMinutes(next))} of your time
          </p>
        </>
      ) : (
        <p className="text-rule">Nothing else is ready to do right now.</p>
      )}
      <div className="flex flex-wrap gap-2.5">
        {next ? (
          <Link href={`/checklist/${next.id}`} className={PRIMARY_LINK}>
            Go to the next step
            <Icon name="arrow" size="sm" />
          </Link>
        ) : null}
        <Link href={back.href} className={SECONDARY_LINK}>
          Back to {back.label}
        </Link>
      </div>
    </div>
  );
}

function WhatsNext({ next, back }: { next: PlanStep | null; back: { href: string; label: string } }) {
  return (
    <section aria-label="What’s next" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-soft">
      <div className="flex min-w-0 flex-col">
        <p className="text-sm font-semibold text-muted">When you’re done here</p>
        <p className="font-semibold">{next ? `Next is: ${next.title}` : "Nothing else is ready yet."}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {next ? (
          <Link href={`/checklist/${next.id}`} className={SECONDARY_LINK}>
            Go to the next step
            <Icon name="arrow" size="sm" />
          </Link>
        ) : null}
        <Link href={back.href} className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
          Back to {back.label}
        </Link>
      </div>
    </section>
  );
}

function LinkedDocuments({ docs }: { docs: StoredDocument[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {docs.map((doc) => (
        <li key={doc.id} className="flex items-start gap-3">
          <Icon name="file" className="mt-3 text-faint" />
          <span className="flex flex-col">
            <Link href={`/documents/${doc.id}`} className={LINK_ITEM}>
              {doc.title}
            </Link>
            <span className="text-sm text-muted">
              {ROLE_LABELS[roleOf(doc)]}
              {doc.version > 1 ? ` · version ${doc.version}` : ""} · <LocalDate iso={doc.createdAt.toISOString()} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// Why a step that's in the plan isn't on the owner's list, and where to change that
function NotOnList({ standing }: { standing: Standing<PlanStep> }) {
  const step = standing.step;
  const say: Partial<Record<Standing<PlanStep>["inclusion"], { text: string; href: string; action: string }>> = {
    no: { text: "From your answer about your plans, you don’t need this.", href: "/requirements#not-for-you", action: "Change your answer" },
    question: { text: `This depends on your plans: ${standing.question ?? ""}`, href: "/requirements#questions", action: "Answer on What applies to you" },
    place: { text: standing.place[0] ?? "Whether this applies depends on where you are.", href: "/business/edit", action: "Confirm your place" },
    structure: { text: "This is for some business structures only. It shows up on your list once you choose one.", href: "/structure", action: "Go to Business structure" },
    optional: { text: "This one is your choice, so it isn’t on your list.", href: "/requirements", action: "See what applies to you" },
    outside: { text: `First Sale doesn’t research this kind of rule.${step.whoToCall ? ` It’s handled by ${step.whoToCall}.` : ""}`, href: "/requirements", action: "See what applies to you" },
    other_structure: { text: "This step isn’t for the business structure you chose.", href: "/requirements", action: "See what changes" },
  };
  const note = say[standing.inclusion];
  if (!note) return null;
  return (
    <Note icon="info" tone="quiet">
      {note.text}{" "}
      <Link href={note.href} className="font-bold text-ink underline underline-offset-4">
        {note.action}
      </Link>
    </Note>
  );
}

// Where the business is isn't known yet, so it's added to the answers
function PlaceGap({ gap, condition }: { gap: NonNullable<ReturnType<typeof placeGap>>; condition: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-soft p-4">
      <p>{condition}</p>
      <Link href="/business/edit" className={`${SECONDARY_LINK} w-fit`}>
        <Icon name="pencil" size="sm" />
        {gap.action}
      </Link>
      <p className="text-sm text-muted">Your property tax bill or lease shows it. Once it’s saved, First Sale updates this step.</p>
    </div>
  );
}

function PrerequisiteState({ done, office }: { done: boolean; office: boolean }) {
  if (done) {
    return (
      <Chip tone="done" icon="check">
        Done
      </Chip>
    );
  }
  if (office) {
    return (
      <Chip tone="warn" icon="hourglass">
        Submitted, waiting to hear back
      </Chip>
    );
  }
  return (
    <span className="inline-flex w-fit items-center gap-1.5 text-sm text-muted">
      <Icon name="lock" size="xs" />
      Not done yet
    </span>
  );
}

// A rule even the deeper look couldn't settle: what First Sale found, then one message to the office that can say for sure
function AskOffice({ step, profile, place }: { step: PlanStep; profile: BusinessProfile; place: Place }) {
  const office = step.whoToCall || step.agency;
  const notes = step.notes ?? [];
  return (
    <section aria-labelledby="ask-heading" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 id="ask-heading" className={STATE_TITLE}>
        What First Sale found
      </h2>
      {notes.length ? (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.title} className="flex flex-col gap-1">
              <p className="font-semibold">{note.title}</p>
              <p className="text-rule">{note.background}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-rule">
        First Sale searched {office ? `${office}’s` : "the office’s"} official site, its code and its forms, and couldn’t say for sure how this works for your business. They can tell you in writing.
      </p>
      <WrittenInquiry
        inquiry={writtenInquiry({ title: step.title, questions: step.whatToAsk, profile, place })}
        office={office}
        link={step.links[0] ? { title: step.links[0].title, url: step.links[0].url } : null}
        contacts={step.contacts}
      />
    </section>
  );
}
