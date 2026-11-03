import Link from "next/link";
import { deleteDocumentAction } from "@/app/(app)/documents/actions";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { PRIMARY_LINK, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, Note } from "@/components/ui";
import type { StoredDocument } from "@/lib/data/documents";
import { NOT_FILED } from "@/lib/documents/fill";
import { DocumentHead } from "./document-head";
import { fileHref, formatBytes, GENERATED_LABELS } from "./labels";
import { ChangedFacts, docIcon } from "./parts";

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
      <DocumentHead documentId={doc.id} title={doc.title}>
        <p>
          {kind}, prepared by SnapStart on <LocalDate iso={doc.createdAt.toISOString()} />
          {doc.hasFile && doc.byteSize ? ` · ${formatBytes(doc.byteSize)}` : null}
        </p>
      </DocumentHead>

      {isPlan && doc.draft?.simulated ? <PracticeBanner what="This business plan was drafted in practice mode." /> : null}
      {outdated.length ? (
        <Card title="Made before your details changed" icon="info" tone="warn" id="outdated-copy" className="border-check-ring!">
          <ChangedFacts facts={outdated} />
          <p className="text-rule">
            {isAgreement ? "Prepare the agreement again from your new details." : "Update the answers on the form, then save a new reviewed copy. This one stays as a record."}
          </p>
        </Card>
      ) : null}

      <Card title="This document" icon={docIcon(doc)} tone="gray" id="document-heading">
        {prepared ? (
          <Note>
            {NOT_FILED} {doc.generatedKind === "filled_form" ? "It contains only the answers you confirmed." : null}
          </Note>
        ) : null}
        {doc.fromDocumentId || stepTitle ? (
          <dl className="flex flex-col">
            {doc.fromDocumentId ? (
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-line py-2.5 last:border-0">
                <dt className="w-32 shrink-0 text-[15px] text-muted">Made from</dt>
                <dd className="min-w-0 flex-1 basis-56 font-semibold">
                  {from ? (
                    <Link href={`/documents/${encodeURIComponent(from.id)}`} className={TEXT_LINK}>
                      {from.title}
                    </Link>
                  ) : (
                    "a form you’ve since deleted"
                  )}
                </dd>
              </div>
            ) : null}
            {stepTitle ? (
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 py-2.5">
                <dt className="w-32 shrink-0 text-[15px] text-muted">Plan step</dt>
                <dd className="min-w-0 flex-1 basis-56 font-semibold">{stepTitle}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {doc.hasFile ? (
          <div className="flex flex-wrap gap-2">
            <a href={fileHref(doc.id, true)} target="_blank" rel="noopener noreferrer" className={PRIMARY_LINK}>
              <Icon name="eye" size="sm" />
              Open<span className="sr-only"> {doc.title} (opens in a new tab)</span>
            </a>
            <a href={fileHref(doc.id)} className={SECONDARY_LINK}>
              <Icon name="download" size="sm" className="text-muted" />
              Download<span className="sr-only"> {doc.title}</span>
            </a>
          </div>
        ) : (
          <p className="text-rule">
            {isPlan ? "There’s no PDF yet. Save your business plan to make one." : isAgreement ? "There’s no PDF yet. Approve your agreement to make one." : "There’s no file for this document."}
          </p>
        )}
        {isPlan ? (
          <Link href="/documents/business-plan" className={SECONDARY_LINK}>
            <Icon name="pencil" size="sm" className="text-muted" />
            Edit your business plan
          </Link>
        ) : null}
        {isAgreement ? (
          <Link href="/documents/agreement" className={SECONDARY_LINK}>
            <Icon name="pencil" size="sm" className="text-muted" />
            Review or change your agreement
          </Link>
        ) : null}
        <div className="border-t border-line pt-4">
          <ActionButton
            action={deleteDocumentAction.bind(null, doc.id)}
            label="Delete"
            pendingLabel="Deleting…"
            variant="danger"
            confirm={
              isPlan
                ? `Delete “${doc.title}”? This removes the plan, your answers to its questions and its PDF. This can’t be undone.`
                : isAgreement
                  ? `Delete “${doc.title}”? This removes the agreement, your answers and its PDF from SnapStart. Copies you’ve printed or signed aren’t affected. This can’t be undone.`
                  : `Delete “${doc.title}”? This removes the file. This can’t be undone.`
            }
            doneHref="/documents"
          />
        </div>
      </Card>
    </div>
  );
}
