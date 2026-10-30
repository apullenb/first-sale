import Link from "next/link";
import { getOfficialFormAction, prepareAnswerGuideAction, refreshDraftAction } from "@/app/(app)/documents/form-actions";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { IconTile } from "@/components/ui";
import type { StoredDocument } from "@/lib/data/documents";
import type { OutdatedFact } from "@/lib/documents/autofill";
import { mustFillYourself } from "@/lib/documents/companion";
import type { OfficialForm } from "@/lib/documents/form-catalog";
import { FormButton } from "./form-button";

export interface FormDoc {
  doc: StoredDocument;
  outdated: OutdatedFact[];
}

// Blanks shown in the preview; the rest are a click away
const PREVIEW_ROWS = 8;

// The official form or application for a step: get it, see the drafted answers in place, and spot outdated ones
export function OfficialFormCard({ stepId, form, original, guide, reviewed }: { stepId: string; form: OfficialForm; original: FormDoc | null; guide: FormDoc | null; reviewed: StoredDocument[] }) {
  return (
    <section aria-labelledby={`form-${form.key}`} className="flex flex-col gap-3 rounded-xl border border-line bg-soft p-4">
      <div className="flex items-start gap-3">
        <IconTile icon="file" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h4 id={`form-${form.key}`} className="font-bold leading-snug">
              {form.pdfUrl ? "The official form" : "Your answers for the application"}
            </h4>
          </div>
          <p className="font-semibold text-rule">{form.title}</p>
          <p className="text-sm text-muted">
            {form.agency} ·{" "}
            <a href={form.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-accent">
              {form.pageTitle}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>{" "}
            · checked <LocalDate iso={`${form.checkedOn}T12:00:00.000Z`} />
          </p>
        </div>
      </div>
      {form.whoFor ? <p className="text-[15px] text-rule">{form.whoFor}.</p> : null}
      {form.kept ? <p className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-rule">{form.kept.text}</p> : null}

      {form.pdfUrl ? (
        original ? (
          <FormPreview label="Official form, kept unchanged, with your drafted answers" item={original} />
        ) : (
          <>
            <ul className="flex flex-col gap-1.5 text-[15px] text-rule">
              {[
                `Downloaded from ${form.domain}, the agency’s own site, and checked that it’s ${form.formNumber ? `Form ${form.formNumber}` : "the form"}${form.revision ? `, ${form.revision}` : ""}.`,
                "The original is saved unchanged in your documents.",
                "Blanks your details answer are filled in for you to check. ID numbers and signatures stay blank for you.",
              ].map((text) => (
                <li key={text} className="flex items-start gap-2">
                  <Icon name="check" size="sm" className="mt-0.5 text-accent" />
                  <span>{text}</span>
                </li>
              ))}
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
          <FormPreview label="Answers prepared for the online application" item={guide} />
        ) : (
          <>
            <p className="text-[15px] text-rule">
              {form.pdfUrl ? "Applying online instead? " : ""}First Sale prepares your answers from your details, so you can copy them in. You review each one first.
            </p>
            <FormButton action={prepareAnswerGuideAction} stepId={stepId} formKey={form.key} label="Prepare my answers" pendingLabel="Preparing…" primary={!form.pdfUrl} />
          </>
        )
      ) : null}

      {form.selfDownload ? (
        <div className="flex flex-col items-start gap-1.5 text-[15px] text-rule">
          <p>Prefer the paper form? The agency’s site doesn’t let First Sale download it. Download it yourself, then upload it here for help filling it in.</p>
          <a href={form.selfDownload.url} target="_blank" rel="noopener noreferrer" className={`flex min-h-11 w-fit items-center gap-1.5 ${TEXT_LINK}`}>
            {form.selfDownload.label}
            <Icon name="external" size="xs" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <p className="text-sm text-muted">
            Link checked by hand on <LocalDate iso={`${form.checkedOn}T12:00:00.000Z`} /> on the agency’s forms page.
          </p>
          <Link href={`/documents?step=${encodeURIComponent(stepId)}`} className={SECONDARY_LINK}>
            <Icon name="upload" size="sm" />
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

// The drafted answers on a sheet of paper, so the owner sees the filled form in place; it's never filed
function FormPreview({ label, item }: { label: string; item: FormDoc }) {
  const { doc } = item;
  const answers = Object.values(doc.answers);
  const confirmed = answers.filter((answer) => answer.state === "confirmed").length;
  const toCheck = answers.filter((answer) => answer.state === "suggested").length;
  const blank = doc.content.fields.length - confirmed - toCheck;
  const practice = doc.content.simulated || answers.some((answer) => answer.simulated);
  const all = doc.content.fields.map((field) => {
    const answer = doc.answers[field.id];
    const yours = mustFillYourself(field) || answer?.state === "fill_yourself";
    const value = !yours && answer && (answer.state === "confirmed" || answer.state === "suggested") ? answer.value : "";
    return { id: field.id, label: field.label, value, state: answer?.state, yours };
  });
  // Drafted answers first, in the form's order, then what's left for the owner
  const rows = [...all.filter((row) => row.value), ...all.filter((row) => !row.value)].slice(0, PREVIEW_ROWS);
  const more = all.length - rows.length;

  return (
    <div className="flex flex-col gap-3">
      <figure className="relative mt-2 rounded-md border border-line-strong bg-surface px-4 pt-5 pb-4 shadow-card sm:px-5">
        <span className="absolute -top-3 right-4 rounded-md bg-ink px-2 py-1 text-xs font-bold uppercase tracking-[0.06em] text-white">Not filed</span>
        <figcaption className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 border-b-[1.5px] border-ink pb-2.5 text-sm text-muted">
          <span className="min-w-0">
            <b className="block font-display text-lg font-normal leading-snug text-ink">{doc.title}</b>
            {label}
          </span>
          <span>
            Last changed <LocalDate iso={doc.updatedAt.toISOString()} />
            {practice ? " · Practice draft" : ""}
          </span>
        </figcaption>
        {rows.length ? (
          <dl className="text-[14.5px]">
            {rows.map((row) => (
              <div key={row.id} className="grid gap-0.5 border-b border-line py-2 last:border-b-0 sm:grid-cols-[minmax(120px,220px)_minmax(0,1fr)] sm:items-baseline sm:gap-3">
                <dt className="text-sm text-muted">{row.label}</dt>
                <dd className={`min-w-0 font-semibold break-words whitespace-pre-line ${row.value ? "text-accent-ink" : "text-check"}`}>
                  {row.value ? (
                    <>
                      {row.value}
                      {row.state === "suggested" ? <span className="ml-1.5 text-xs font-bold uppercase tracking-wide text-muted">Check this</span> : null}
                    </>
                  ) : row.yours ? (
                    "Left for you to fill in"
                  ) : (
                    "No answer yet"
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="pt-2.5 text-[15px] text-muted">Open it to see the form.</p>
        )}
        {more > 0 ? <p className="pt-2 text-sm text-muted">{more} more {more === 1 ? "blank" : "blanks"} on the full form.</p> : null}
      </figure>
      <p className="text-[15px] text-rule">
        {confirmed} confirmed · {toCheck} drafted for you to check · {blank} for you to fill in
      </p>
      {doc.verification && !doc.verification.ok ? (
        <p className="text-[15px] text-check">This download didn’t pass every check, so First Sale didn’t fill it in. Open it to see which check failed.</p>
      ) : null}
      {item.outdated.length ? (
        <div className="flex flex-col gap-2 rounded-xl border border-check-ring bg-check-tint px-3.5 py-3 text-check">
          <p>
            <span className="font-semibold">Outdated:</span> your {item.outdated.map((each) => each.label.toLowerCase()).join(", ")} changed since these answers were drafted.
          </p>
          <ActionButton action={refreshDraftAction.bind(null, doc.id)} label="Update the answers" pendingLabel="Updating…" />
        </div>
      ) : null}
      <Link href={`/documents/${encodeURIComponent(doc.id)}`} className={SECONDARY_LINK}>
        <Icon name="pencil" size="sm" />
        Review the answers
      </Link>
    </div>
  );
}
