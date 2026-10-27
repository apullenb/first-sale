import Link from "next/link";
import { refreshDraftAction } from "@/app/(app)/documents/form-actions";
import { ActionButton } from "@/components/action-button";
import { LocalDate } from "@/components/local-date";
import { CARD, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import type { StoredDocument } from "@/lib/data/documents";
import type { OutdatedFact } from "@/lib/documents/autofill";
import { ROLE_LABELS, roleOf } from "@/lib/documents/library";
import { ReplaceFile } from "./replace-file";

interface Props {
  doc: StoredDocument;
  outdated: OutdatedFact[];
  // Other versions of this document, newest first
  versions: StoredDocument[];
  acceptedTypes: string;
}

// Where the form came from and how it was checked, whether its draft is outdated, and its versions
export function FormStatus({ doc, outdated, versions, acceptedTypes }: Props) {
  const check = doc.verification;
  return (
    <>
      {check ? (
        <section aria-labelledby="checked-heading" className={`${CARD} flex flex-col gap-2`}>
          <h2 id="checked-heading" className={SECTION_TITLE}>
            {check.ok ? "Checked: this is the official form" : "This download didn’t pass every check"}
          </h2>
          <ul className="flex flex-col gap-1">
            {check.checks.map((item) => (
              <li key={item.label} className="flex items-start gap-2.5">
                <span aria-hidden="true" className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.ok ? "bg-accent-tint text-accent-ink" : "bg-check-tint text-check"}`}>
                  {item.ok ? "✓" : "!"}
                </span>
                <span>
                  <span className="sr-only">{item.ok ? "Passed: " : "Failed: "}</span>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Downloaded from {check.government} on <LocalDate iso={check.checkedAt} />. The original is kept exactly as downloaded
            {doc.sha256 ? ` (fingerprint ${doc.sha256.slice(0, 12)})` : ""}.
          </p>
          {check.ok ? null : (
            <p className="text-[15px] text-check">
              It may be a newer version than the one First Sale checked, so its blanks weren’t filled in automatically. You can still draft answers below and make an answer sheet.
            </p>
          )}
        </section>
      ) : null}

      {outdated.length ? (
        <section aria-labelledby="outdated-heading" className="flex flex-col gap-2.5 rounded-2xl bg-check-tint p-5">
          <h2 id="outdated-heading" className={`${SECTION_TITLE} text-check`}>
            Some answers are out of date
          </h2>
          <ul className="flex flex-col gap-1">
            {outdated.map((fact) => (
              <li key={fact.id}>
                <span className="font-semibold">{fact.label}:</span> {fact.before || "not set"} → {fact.now ?? "removed"}
              </li>
            ))}
          </ul>
          <p className="text-rule">Answers you confirmed with the old details will need checking again. Copies you already made stay as they were.</p>
          <ActionButton action={refreshDraftAction.bind(null, doc.id)} label="Update the answers" pendingLabel="Updating…" variant="primary" />
        </section>
      ) : null}

      {versions.length || doc.origin === "upload" ? (
        <section aria-labelledby="versions-heading" className={`${CARD} flex flex-col gap-2.5`}>
          <h2 id="versions-heading" className={SECTION_TITLE}>
            Versions
          </h2>
          <p className="text-[15px] text-rule">
            This is version {doc.version}: {ROLE_LABELS[roleOf(doc)].toLowerCase()}, added <LocalDate iso={doc.createdAt.toISOString()} />.
          </p>
          {versions.length ? (
            <ul className="flex flex-col">
              {versions.map((version) => (
                <li key={version.id}>
                  <Link href={`/documents/${encodeURIComponent(version.id)}`} className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
                    Version {version.version}: {ROLE_LABELS[roleOf(version)].toLowerCase()}, <LocalDate iso={version.createdAt.toISOString()} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {doc.origin === "upload" ? <ReplaceFile documentId={doc.id} accept={acceptedTypes} /> : null}
        </section>
      ) : null}
    </>
  );
}
