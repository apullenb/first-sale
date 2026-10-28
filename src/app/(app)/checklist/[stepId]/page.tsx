import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { ROLE_LABELS, roleOf } from "@/lib/documents/library";
import { FilingSteps } from "@/components/plan/filing-steps";
import { AgreementCard } from "@/components/documents/agreement-card";
import { type FormDoc, OfficialFormCard } from "@/components/plan/official-form-card";
import { RecordUpload } from "@/components/plan/record-upload";
import { StepStateLabel, stepStates } from "@/components/plan/step-state";
import { StepStatus } from "@/components/plan/step-status";
import { StructureDecision } from "@/components/plan/structure-decision";
import { PracticeBanner } from "@/components/practice-banner";
import { StatusChip } from "@/components/requirements/requirement-card";
import { RequirementStatusChip } from "@/components/requirements/requirement-status";
import { WrittenInquiry } from "@/components/requirements/written-inquiry";
import { CARD, EYEBROW, PAGE_TITLE, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import type { StoredDocument } from "@/lib/data/documents";
import { getMyBusiness, getMyDetails, getMyStep, listMyDocuments } from "@/lib/data/my-business";
import { autofillContext, autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { filedForm, formsFor } from "@/lib/documents/form-catalog";
import { agreementName, agreementStepKey, agreementStructure } from "@/lib/documents/owners-agreement";
import { ACCEPTED_TYPES } from "@/lib/documents/upload";
import { LEVEL_LABELS, TOPIC_LABELS } from "@/lib/labels";
import { jurisdictionName, placeOf, structureOf } from "@/lib/research/applicability";
import { writtenInquiry } from "@/lib/research/inquiry";
import { filingSteps } from "@/lib/rules/filing";
import { followingSteps } from "@/lib/rules/plan";

export const metadata: Metadata = { title: "Startup plan step" };

type Params = Promise<{ stepId: string }>;

export default function StepPage({ params }: { params: Params }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/checklist" className={`flex min-h-11 w-fit items-center gap-1.5 ${TEXT_LINK}`}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Your startup plan
      </Link>
      <Suspense fallback={<p className="text-muted">Loading this step…</p>}>
        <StepDetail params={params} />
      </Suspense>
    </div>
  );
}

const LINK_ITEM = "flex min-h-11 w-fit items-center font-semibold underline underline-offset-4";

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
  const unresolved = !sourced || conditions.length > 0 || step.requirementStatus !== "verified";

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className={EYEBROW}>
          {TOPIC_LABELS[step.topic]} · {LEVEL_LABELS[step.level]}
          {place ? `: ${jurisdictionName(step.level, place)}` : ""}
        </p>
        <h1 className={PAGE_TITLE}>{step.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <RequirementStatusChip status={step.requirementStatus} />
          <StatusChip sourced={sourced} />
          <StepStateLabel state={states.get(step.key)} />
        </div>
        {step.timing === "later" ? <p className="text-sm text-muted">This comes later: you don’t need it before your first sale.</p> : null}
      </div>

      {step.simulated ? <PracticeBanner what="This step came from practice results." /> : null}
      {ruledOut ? (
        <p className="rounded-xl bg-check-tint px-4 py-3 text-check">
          This step isn’t for the business structure you chose. <Link href="/checklist" className="font-semibold underline underline-offset-4">Update your plan</Link> to see the changes.
        </p>
      ) : null}
      {step.retired ? (
        <p className="rounded-xl bg-rule-tint px-4 py-3 text-rule">
          A later check of your requirements left this step out of your plan. You’d already finished it, so it stays here for your records.
        </p>
      ) : null}

      <section aria-labelledby="why-heading" className={`flex flex-col gap-2 ${CARD}`}>
        <h2 id="why-heading" className={SECTION_TITLE}>
          Why it may apply to you
        </h2>
        {step.why ? <p>{step.why}</p> : null}
        {conditions.length ? (
          <div className="flex flex-col gap-1 rounded-xl bg-rule-tint/60 px-3.5 py-2.5">
            <p className="font-semibold">It depends on</p>
            <ul className="flex list-disc flex-col gap-0.5 pl-5">
              {conditions.map((condition, index) => (
                <li key={index}>{condition}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {step.alreadyHave ? <p className="rounded-xl bg-accent-tint px-3.5 py-2.5 text-accent-ink">{step.alreadyHave}</p> : null}
        {step.uncertainty.length ? (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-rule">
            {step.uncertainty.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <FilingSteps
        steps={filingSteps({
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
        })}
      />

      {step.retired
        ? null
        : cards.map((card) => (
            <OfficialFormCard key={card.form.key} stepId={step.id} form={card.form} original={card.original} guide={card.guide} reviewed={card.reviewed} />
          ))}
      {agreementHere && profile ? (
        <AgreementCard
          name={agreementName(agreementFor, profile.location.state === "TX")}
          owners={profile.owners.count}
          doc={agreement}
          outdated={agreement ? outdatedFacts(agreement.factsUsed, facts) : []}
        />
      ) : null}
      {missing.length ? (
        <Link href="/business" className={SECONDARY_LINK}>
          Add missing details to your business
        </Link>
      ) : null}

      {unresolved && profile && place ? (
        <section aria-labelledby="ask-heading" className="flex flex-col gap-2.5 rounded-2xl bg-check-tint/60 p-5 ring-1 ring-check/15">
          <h2 id="ask-heading" className={`${SECTION_TITLE} text-check`}>
            Not sure it applies? Ask in writing
          </h2>
          <WrittenInquiry
            inquiry={writtenInquiry({ title: step.title, questions: step.whatToAsk, profile, place })}
            office={step.whoToCall || step.agency}
            link={step.links[0] ? { title: step.links[0].title, url: step.links[0].url } : null}
          />
        </section>
      ) : null}

      {step.topic === "structure" ? (
        <StructureDecision key={step.id} current={details.find((detail) => detail.key === "structure_choice")?.value ?? null} />
      ) : null}

      {before.length || after.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {before.length ? (
            <section aria-labelledby="before-heading" className={`flex flex-col gap-1.5 ${CARD}`}>
              <h2 id="before-heading" className={SECTION_TITLE}>
                Finish first
              </h2>
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
            <section aria-labelledby="after-heading" className={`flex flex-col gap-1.5 ${CARD}`}>
              <h2 id="after-heading" className={SECTION_TITLE}>
                What comes next
              </h2>
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
      ) : null}

      <section aria-labelledby="documents-heading" className={`flex flex-col gap-2.5 ${CARD}`}>
        <h2 id="documents-heading" className={SECTION_TITLE}>
          Documents for this step
        </h2>
        {linked.length ? <LinkedDocuments docs={linked} /> : <p className="text-muted">No documents are linked to this step yet.</p>}
        {step.retired ? null : (
          <details className="group">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center font-semibold text-accent-ink underline underline-offset-4">
              Save a receipt or approval
            </summary>
            <div className="mt-2">
              <RecordUpload stepId={step.id} accept={Object.keys(ACCEPTED_TYPES).join(",")} />
            </div>
          </details>
        )}
        <Link href={`/documents?step=${encodeURIComponent(step.id)}`} className={SECONDARY_LINK}>
          Get help with another form for this step
        </Link>
      </section>

      {step.retired ? null : (
        <section aria-labelledby="progress-heading" className={`flex flex-col gap-3 ${CARD}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id="progress-heading" className={SECTION_TITLE}>
              Your progress
            </h2>
            <ActorChip actor="owner" />
          </div>
          <StepStatus
            key={`${step.id}-${step.status}`}
            stepId={step.id}
            status={step.status}
            note={step.evidenceNote}
            completedAt={step.completedAt?.toISOString() ?? null}
            submittedAt={step.submittedAt?.toISOString() ?? null}
            submissionNote={step.submissionNote}
            filing={filing}
          />
        </section>
      )}
    </>
  );
}

function LinkedDocuments({ docs }: { docs: StoredDocument[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {docs.map((doc) => (
        <li key={doc.id} className="flex flex-col">
          <Link href={`/documents/${doc.id}`} className={LINK_ITEM}>
            {doc.title}
          </Link>
          <span className="text-sm text-muted">
            {ROLE_LABELS[roleOf(doc)]}
            {doc.version > 1 ? ` · version ${doc.version}` : ""} · <LocalDate iso={doc.createdAt.toISOString()} />
          </span>
        </li>
      ))}
    </ul>
  );
}
