import Link from "next/link";
import { getOfficialFormAction, prepareAnswerGuideAction, refreshDraftAction } from "@/app/(app)/documents/form-actions";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { CARD, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import type { StoredDocument } from "@/lib/data/documents";
import type { OutdatedFact } from "@/lib/documents/autofill";
import type { OfficialForm } from "@/lib/documents/form-catalog";
import { FormButton } from "./form-button";

export interface FormDoc {
  doc: StoredDocument;
  outdated: OutdatedFact[];
}

// The official form or application for a step: get it, see how far the draft is, and spot outdated answers
export function OfficialFormCard({ stepId, form, original, guide, reviewed }: { stepId: string; form: OfficialForm; original: FormDoc | null; guide: FormDoc | null; reviewed: StoredDocument[] }) {
  return (
    <section aria-labelledby="form-heading" className={`flex flex-col gap-3 ${CARD}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id="form-heading" className={SECTION_TITLE}>
          {form.pdfUrl ? "The official form" : "Your answers for the application"}
        </h2>
        <ActorChip actor="rule" />
      </div>
      <p className="font-semibold">{form.title}</p>
      {form.whoFor ? <p className="text-[15px] text-rule">{form.whoFor}.</p> : null}
      {form.kept ? <p className="rounded-lg bg-rule-tint px-3 py-2.5 text-[15px] text-rule">{form.kept.text}</p> : null}
      <p className="text-sm text-muted">
        {form.agency} ·{" "}
        <a href={form.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2">
          {form.pageTitle}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>{" "}
        · checked <LocalDate iso={`${form.checkedOn}T12:00:00.000Z`} />
      </p>

      {form.pdfUrl ? (
        original ? (
          <DraftSummary label="Official form, kept unchanged, with your drafted answers" item={original} />
        ) : (
          <>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-rule">
              <li>Downloaded from {form.domain}, the agency’s own site, and checked that it’s {form.formNumber ? `Form ${form.formNumber}` : "the form"}{form.revision ? `, ${form.revision}` : ""}.</li>
              <li>The original is saved unchanged in your documents.</li>
              <li>Blanks your details answer are filled in for you to check. ID numbers and signatures stay blank for you.</li>
            </ul>
            <FormButton
              action={getOfficialFormAction}
              stepId={stepId}
              formKey={form.key}
              label="Get the official form"
              pendingLabel="Getting the form…"
              pendingStatus="Downloading the form from the official site and checking it. This takes a few seconds."
              primary
            />
          </>
        )
      ) : null}

      {form.onlineUrl || !form.pdfUrl ? (
        guide ? (
          <DraftSummary label="Answers prepared for the online application" item={guide} />
        ) : (
          <>
            <p className="text-[15px] text-rule">
              {form.pdfUrl ? "Applying online instead? " : ""}First Sale prepares your answers from your details, so you can copy them in. You review each one first.
            </p>
            <FormButton
              action={prepareAnswerGuideAction}
              stepId={stepId}
              formKey={form.key}
              label="Prepare my answers"
              pendingLabel="Preparing…"
              primary={!form.pdfUrl}
            />
          </>
        )
      ) : null}

      {form.selfDownload ? (
        <div className="flex flex-col gap-1.5 text-[15px] text-rule">
          <p>
            Prefer the paper form? The agency’s site doesn’t let First Sale download it. Download it yourself, then upload it here for help filling it in.
          </p>
          <a href={form.selfDownload.url} target="_blank" rel="noopener noreferrer" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
            {form.selfDownload.label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <p className="text-sm text-muted">
            Link checked by hand on <LocalDate iso={`${form.checkedOn}T12:00:00.000Z`} /> on the agency’s forms page.
          </p>
          <Link href={`/documents?step=${encodeURIComponent(stepId)}`} className={SECONDARY_LINK}>
            Upload the form
          </Link>
        </div>
      ) : null}

      {reviewed.length ? (
        <div className="flex flex-col gap-1">
          <p className="font-semibold">Reviewed copies (not filed)</p>
          <ul className="flex flex-col">
            {reviewed.map((doc) => (
              <li key={doc.id}>
                <Link href={`/documents/${encodeURIComponent(doc.id)}`} className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
                  Version {doc.version}, made <LocalDate iso={doc.createdAt.toISOString()} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {form.notes.map((note, index) => (
        <p key={index} className="text-sm text-muted">
          {note}
        </p>
      ))}
    </section>
  );
}

function DraftSummary({ label, item }: { label: string; item: FormDoc }) {
  const answers = Object.values(item.doc.answers);
  const confirmed = answers.filter((answer) => answer.state === "confirmed").length;
  const toCheck = answers.filter((answer) => answer.state === "suggested").length;
  const blank = item.doc.content.fields.length - confirmed - toCheck;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-ground px-3.5 py-3">
      <p className="font-semibold">{label}</p>
      <p className="text-[15px] text-rule">
        {confirmed} confirmed · {toCheck} drafted for you to check · {blank} for you to fill in
      </p>
      {item.doc.verification && !item.doc.verification.ok ? (
        <p className="text-[15px] text-check">
          This download didn’t pass every check, so First Sale didn’t fill it in. Open it to see which check failed.
        </p>
      ) : null}
      {item.outdated.length ? (
        <div className="flex flex-col gap-2 rounded-lg bg-check-tint px-3 py-2.5 text-check">
          <p>
            <span className="font-semibold">Outdated:</span> your {item.outdated.map((each) => each.label.toLowerCase()).join(", ")} changed since these answers were drafted.
          </p>
          <ActionButton action={refreshDraftAction.bind(null, item.doc.id)} label="Update the answers" pendingLabel="Updating…" />
        </div>
      ) : null}
      <Link href={`/documents/${encodeURIComponent(item.doc.id)}`} className={SECONDARY_LINK}>
        Review the answers
      </Link>
    </div>
  );
}
