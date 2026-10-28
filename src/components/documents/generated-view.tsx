import Link from "next/link";
import { deleteDocumentAction } from "@/app/(app)/documents/actions";
import { ActionButton } from "@/components/action-button";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { CARD, EYEBROW, PRIMARY_LINK, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import type { StoredDocument } from "@/lib/data/documents";
import { NOT_FILED } from "@/lib/documents/fill";
import { DocumentTitle } from "./document-title";
import { fileHref, formatBytes, GENERATED_LABELS } from "./labels";

interface Props {
  doc: StoredDocument;
  // The form it was made from; null when there isn't one or it was deleted
  from: { id: string; title: string } | null;
  stepTitle: string | null;
  // Details used in this copy that have changed since it was made
  outdated?: { label: string; before: string; now: string | null }[];
}

export function GeneratedView({ doc, from, stepTitle, outdated = [] }: Props) {
  const kind = doc.generatedKind ? GENERATED_LABELS[doc.generatedKind] : "Prepared document";
  const isPlan = doc.generatedKind === "business_plan";
  const isAgreement = doc.generatedKind === "owners_agreement";
  const prepared = doc.generatedKind === "filled_form" || doc.generatedKind === "answer_sheet";

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/documents" className={`${TEXT_LINK} flex min-h-11 w-fit items-center`}>
          Back to your documents
        </Link>
        <p className={EYEBROW}>Start your business · Step 5</p>
        <DocumentTitle key={doc.title} documentId={doc.id} title={doc.title} />
        <p className="text-rule">
          {kind}, prepared by First Sale on <LocalDate iso={doc.createdAt.toISOString()} />
          {doc.hasFile && doc.byteSize ? ` · ${formatBytes(doc.byteSize)}` : null}
        </p>
        {doc.fromDocumentId ? (
          <p className="text-rule">
            <span className="font-semibold">Made from:</span>{" "}
            {from ? (
              <Link href={`/documents/${encodeURIComponent(from.id)}`} className={TEXT_LINK}>
                {from.title}
              </Link>
            ) : (
              "a form you’ve since deleted"
            )}
          </p>
        ) : null}
        {stepTitle ? (
          <p className="text-rule">
            <span className="font-semibold">Plan step:</span> {stepTitle}
          </p>
        ) : null}
      </div>

      {isPlan && doc.draft?.simulated ? <PracticeBanner what="This business plan was drafted in practice mode." /> : null}
      {outdated.length ? (
        <section aria-labelledby="outdated-copy" className="flex flex-col gap-1.5 rounded-2xl bg-check-tint p-5 text-check">
          <h2 id="outdated-copy" className="font-display text-xl font-bold">
            Made before your details changed
          </h2>
          <ul className="flex flex-col gap-0.5">
            {outdated.map((fact) => (
              <li key={fact.label}>
                <span className="font-semibold">{fact.label}:</span> {fact.before || "not set"} → {fact.now ?? "removed"}
              </li>
            ))}
          </ul>
          <p>{isAgreement ? "Prepare the agreement again from your new details." : "Update the answers on the form, then save a new reviewed copy. This one stays as a record."}</p>
        </section>
      ) : null}

      <section aria-label="Open or download" className={`${CARD} flex flex-col gap-3`}>
        {prepared ? (
          <p className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
            {NOT_FILED} {doc.generatedKind === "filled_form" ? "It contains only the answers you confirmed." : null}
          </p>
        ) : null}
        {doc.hasFile ? (
          <div className="flex flex-wrap gap-2">
            <a href={fileHref(doc.id, true)} target="_blank" rel="noopener noreferrer" className={PRIMARY_LINK}>
              Open<span className="sr-only"> {doc.title} (opens in a new tab)</span>
            </a>
            <a href={fileHref(doc.id)} className={SECONDARY_LINK}>
              Download<span className="sr-only"> {doc.title}</span>
            </a>
          </div>
        ) : (
          <p className="text-rule">
            {isPlan ? "There’s no PDF yet. Approve your plan to make one." : isAgreement ? "There’s no PDF yet. Approve your agreement to make one." : "There’s no file for this document."}
          </p>
        )}
        {isPlan ? (
          <Link href="/documents/business-plan" className={SECONDARY_LINK}>
            Edit your business plan
          </Link>
        ) : null}
        {isAgreement ? (
          <Link href="/documents/agreement" className={SECONDARY_LINK}>
            Review or change your agreement
          </Link>
        ) : null}
      </section>

      <ActionButton
        action={deleteDocumentAction.bind(null, doc.id)}
        label="Delete"
        pendingLabel="Deleting…"
        variant="danger"
        confirm={
          isPlan
            ? `Delete “${doc.title}”? This removes the plan, your answers to its questions and its PDF. This can’t be undone.`
            : isAgreement
              ? `Delete “${doc.title}”? This removes the agreement, your answers and its PDF from First Sale. Copies you’ve printed or signed aren’t affected. This can’t be undone.`
              : `Delete “${doc.title}”? This removes the file. This can’t be undone.`
        }
        doneHref="/documents"
      />
    </div>
  );
}
