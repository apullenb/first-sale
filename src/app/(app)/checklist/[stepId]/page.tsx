import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActorChip } from "@/components/actor-chip";
import { AgreementCard } from "@/components/documents/agreement-card";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { AlreadyDone } from "@/components/plan/already-done";
import { FilingSteps } from "@/components/plan/filing-steps";
import { type FormDoc, OfficialFormCard } from "@/components/plan/official-form-card";
import { RecordUpload } from "@/components/plan/record-upload";
import { StepStateLabel, stepStates } from "@/components/plan/step-state";
import { PenCheck, TOPIC_ICONS } from "@/components/plan/step-row";
import { StepStatus } from "@/components/plan/step-status";
import { StructureDecision } from "@/components/plan/structure-decision";
import { PracticeBanner } from "@/components/practice-banner";
import { StatusChip } from "@/components/requirements/requirement-card";
import { RequirementStatusChip } from "@/components/requirements/requirement-status";
import { WrittenInquiry } from "@/components/requirements/written-inquiry";
import { PAGE_TITLE, PRIMARY_LINK, SECONDARY, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Chip, Fact, Fold, Note } from "@/components/ui";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import type { StoredDocument } from "@/lib/data/documents";
import { orderSteps, type PlanStep } from "@/lib/data/plan";
import { getMyBusiness, getMyDetails, getMyStep, listMyDocuments } from "@/lib/data/my-business";
import { autofillContext, autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { filedForm, formsFor } from "@/lib/documents/form-catalog";
import { ROLE_LABELS, roleOf } from "@/lib/documents/library";
import { agreementName, agreementStepKey, agreementStructure } from "@/lib/documents/owners-agreement";
import { formatFee } from "@/lib/documents/startup-plan";
import { ACCEPTED_TYPES } from "@/lib/documents/upload";
import { LEVEL_LABELS, TOPIC_LABELS } from "@/lib/labels";
import { jurisdictionName, placeOf, structureOf } from "@/lib/research/applicability";
import { writtenInquiry } from "@/lib/research/inquiry";
import { filingSteps } from "@/lib/rules/filing";
import { followingSteps } from "@/lib/rules/plan";
import { formatMinutes, nextStepAfter, stepMinutes } from "@/lib/rules/progress";

export const metadata: Metadata = { title: "Startup plan step" };

type Params = Promise<{ stepId: string }>;

export default function StepPage({ params }: { params: Params }) {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link href="/checklist" className="-mb-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-accent">
        <Icon name="back" size="sm" />
        Step 4 · Your startup plan
      </Link>
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
  const [found, documents, business, details] = await Promise.all([getMyStep(stepId), listMyDocuments(), getMyBusiness(), getMyDetails()]);
  if (!found) notFound();
  const { step, all } = found;
  const profile = business?.profile ?? null;

  const states = stepStates(all);
  const byKey = new Map(all.map((candidate) => [candidate.key, candidate]));
  const before = step.prerequisites.flatMap((key) => byKey.get(key) ?? []);
  const after = followingSteps(all.filter((candidate) => !candidate.retired), step.key);
  const linked = documents.filter((doc) => doc.taskId === step.id);
  const sourced = step.verification === "sourced";
  // Undecided owners see every form that fits, each saying who it's for
  const forms = profile ? formsFor(OFFICIAL_FORMS, step, placeOf(profile), structureOf(profile, details).structure) : [];
  // The numbered steps follow a form only when one filed form fits; the cards say who each is for
  const form = filedForm(forms);

  const place = profile ? placeOf(profile) : null;
  const decision = profile ? structureOf(profile, details) : null;
  // A structure chosen since the plan was built can rule this step out before the plan is updated
  const ruledOut = Boolean(decision?.structure && step.forStructures.length && !step.forStructures.includes(decision.structure));
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
  const filing = step.topic !== "structure";
  const state = states.get(step.key);
  const lockedBy = state?.state === "waiting" && step.status === "todo" ? state.waitingOn : [];
  const next = step.retired ? null : nextStepAfter(orderSteps(all.filter((each) => !each.retired)), step.key);
  const accept = Object.keys(ACCEPTED_TYPES).join(",");
  const unresolved = !sourced || conditions.length > 0 || step.requirementStatus !== "verified";

  const minutes = formatMinutes(stepMinutes(step));
  // Two official pages that disagree are shown in the numbered steps, never settled here
  const feesDiffer = step.feeCents !== null && form?.fee != null && form.fee.cents !== step.feeCents;
  const feeCents = step.feeCents ?? form?.fee?.cents ?? null;
  const fileable = filing && cards.some((card) => !card.form.kept);
  const how = filingSteps({
    title: step.title,
    agency: step.agency,
    feeCents: step.feeCents,
    feeCheckedAt: step.feeCheckedAt,
    deadline: step.deadline,
    renewal: step.renewal,
    links: step.links,
    prepare: step.prepare,
    doneWhen: step.doneWhen,
    waitingOn: before.filter((prerequisite) => prerequisite.status !== "done").map((prerequisite) => prerequisite.title),
    following: after.map((following) => following.title),
    form,
    missing,
  });
  const formsHere =
    step.retired || (!cards.length && !missing.length) ? null : (
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
  const steps = <FilingSteps steps={how} extras={{ form: formsHere, receipt }} />;
  const locked = lockedBy.length > 0;
  const ready = !step.retired && step.status === "todo" && !locked;
  const confirming = step.links.find((link) => link.confirms) ?? null;
  const howSourced = how.some((each) => each.lines.some((line) => line.source));
  const progress = (
    <StepStatus
      key={`${step.id}-${step.status}`}
      stepId={step.id}
      status={step.status}
      note={step.evidenceNote}
      submittedAt={step.submittedAt?.toISOString() ?? null}
      submissionNote={step.submissionNote}
      filing={filing}
    />
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-[min(100%,420px)] flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="gray" icon={TOPIC_ICONS[step.topic]}>
              {TOPIC_LABELS[step.topic]}
            </Chip>
            <RequirementStatusChip status={step.requirementStatus} />
            {sourced ? null : <StatusChip sourced={false} />}
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
        {step.retired ? null : <AlreadyDone key={step.status} stepId={step.id} accept={accept} markDone={step.status === "todo" && step.topic !== "structure"} />}
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
          <Fact icon="coins">Fee not confirmed</Fact>
        ) : null}
        {step.agency ? <Fact icon="office">{step.agency}</Fact> : null}
        <Fact icon="pin">
          {LEVEL_LABELS[step.level]}
          {place ? `: ${jurisdictionName(step.level, place)}` : ""}
        </Fact>
        {form?.onlineUrl ? <Fact icon="globe">Online</Fact> : null}
      </div>

      {step.simulated ? <PracticeBanner what="This step came from practice results." /> : null}
      {ruledOut ? (
        <Note icon="info">
          This step isn’t for the business structure you chose.{" "}
          <Link href="/checklist" className="font-bold underline underline-offset-4">
            Update your plan
          </Link>{" "}
          to see the changes.
        </Note>
      ) : null}
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
              <p className="text-muted">{filing ? "Approved or finished." : "You marked this done."}</p>
            </div>
          </div>
          {step.topic === "structure" ? <StructureDecision key={step.id} current={details.find((detail) => detail.key === "structure_choice")?.value ?? null} /> : null}
          {progress}
          <NextUp next={next} />
        </section>
      ) : locked ? (
        <section aria-labelledby="progress-heading" className={`scroll-mt-4 ${STATE_CARD} items-start bg-soft shadow-soft`}>
          <p className={`${KICKER} text-muted`}>
            <Icon name="lock" size="sm" />
            Locked for now
          </p>
          <h2 id="progress-heading" className={STATE_TITLE}>
            Do this first: {LIST.format(lockedBy.map((each) => each.title))}
          </h2>
          <p className="text-muted">
            You can read ahead. This step opens once that’s done.
            {step.topic === "structure" ? "" : " Already did it on your own? Use “I’ve already done this” at the top."}
          </p>
          <Link href={`/checklist/${lockedBy[0].id}`} className={PRIMARY_LINK}>
            Take me there
            <Icon name="arrow" size="sm" />
          </Link>
        </section>
      ) : step.status === "submitted" ? (
        <section aria-labelledby="progress-heading" className={`scroll-mt-4 ${STATE_CARD} bg-surface shadow-lift`}>
          <p className={`${KICKER} text-check`}>
            <Icon name="hourglass" size="sm" />
            Waiting to hear back
          </p>
          <h2 id="progress-heading" className={STATE_TITLE}>
            Mark it when it’s approved
          </h2>
          {progress}
        </section>
      ) : (
        <section aria-labelledby="part-heading" className={`${STATE_CARD} bg-surface shadow-lift`}>
          <p className={`${KICKER} text-accent`}>
            <Icon name={TOPIC_ICONS[step.topic]} size="sm" />
            Your part · about {minutes}
          </p>
          <h2 id="part-heading" className={STATE_TITLE}>
            {step.topic === "structure"
              ? "Choose how your business is owned"
              : fileable
                ? "First Sale fills in the blanks your details answer. You check, sign and send it yourself."
                : "Here’s how to do it yourself"}
          </h2>
          {step.topic === "structure" ? (
            <StructureDecision key={step.id} current={details.find((detail) => detail.key === "structure_choice")?.value ?? null} />
          ) : (
            steps
          )}
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <h3 id="progress-heading" className="flex scroll-mt-4 items-center gap-2.5 font-bold">
              Record what you did
              <ActorChip actor="owner" />
            </h3>
            {progress}
          </div>
          <p className="text-sm text-muted">Opening a link or a form never changes this. You record what you did. First Sale never files anything for you.</p>
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
        {ready && step.topic !== "structure" ? null : (
          <Fold
            title="How to do it yourself"
            summary={`${step.status === "done" || step.retired ? "The steps" : `Read ahead: ${how.length} steps`}${howSourced ? ", with official sources" : ""}`}
            icon="list"
          >
            {steps}
          </Fold>
        )}

        <Fold title="Why it’s on your list" summary={step.agency || jurisdictionLabel(step, place)} icon="info" open={conditions.length > 0 && step.status === "todo"}>
          {step.why ? <p>{step.why}</p> : null}
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
          {step.uncertainty.length ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-rule marker:text-faint">
              {step.uncertainty.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : null}
        </Fold>

        <Fold
          title="Official source"
          summary={confirming ? confirming.title : step.links[0] ? `A related page: ${step.links[0].title}` : "No official page confirmed this yet"}
          icon="link"
        >
          {step.links.length ? (
            <ul className="grid gap-2">
              {step.links.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-soft transition hover:border-line-strong motion-reduce:transition-none"
                  >
                    <Icon name="globe" className="text-accent" />
                    <span className="min-w-0 flex-1">
                      <b className="block font-semibold leading-snug">{link.title}</b>
                      <small className="block text-sm text-muted">
                        {link.government}
                        {link.confirms ? " · confirms this step" : " · a related page"}
                      </small>
                    </span>
                    <Icon name="external" size="sm" className="text-faint" />
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-rule">No official page confirmed this yet. That doesn’t mean it doesn’t apply.</p>
          )}
          <StatusChip sourced={sourced} />
        </Fold>

        {unresolved && profile && place ? (
          <Fold title="Not sure it applies? Ask in writing" summary="A message you can send. You never have to call." icon="mail">
            <WrittenInquiry
              inquiry={writtenInquiry({ title: step.title, questions: step.whatToAsk, profile, place })}
              office={step.whoToCall || step.agency}
              link={step.links[0] ? { title: step.links[0].title, url: step.links[0].url } : null}
            />
          </Fold>
        ) : null}

        {before.length || after.length ? (
          <Fold
            title="What comes before and after"
            summary={[before.length ? `Finish ${before.length} first` : null, after.length ? `${before.length ? "unlocks" : "Unlocks"} ${after.length}` : null].filter(Boolean).join(" · ")}
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
                      <li key={prerequisite.id} className="flex flex-col pb-1">
                        <Link href={`/checklist/${prerequisite.id}`} className={LINK_ITEM}>
                          {prerequisite.title}
                        </Link>
                        <StepStateLabel state={states.get(prerequisite.key)} />
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
        <Link href="/checklist" className={SECONDARY_LINK}>
          <Icon name="back" size="sm" />
          Back to your plan
        </Link>
      ) : step.status === "done" ? null : (
        <WhatsNext next={next} />
      )}
    </>
  );
}

function jurisdictionLabel(step: PlanStep, place: ReturnType<typeof placeOf> | null): string {
  return `${LEVEL_LABELS[step.level]}${place ? `: ${jurisdictionName(step.level, place)}` : ""}`;
}

// After a step is done: always somewhere to go, the next ready step, never back to one that points here
function NextUp({ next }: { next: PlanStep | null }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-soft p-4">
      {next ? (
        <>
          <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">Up next</p>
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
        <Link href="/checklist" className={SECONDARY_LINK}>
          Back to your plan
        </Link>
      </div>
    </div>
  );
}

function WhatsNext({ next }: { next: PlanStep | null }) {
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
        <Link href="/checklist" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
          Back to your plan
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
