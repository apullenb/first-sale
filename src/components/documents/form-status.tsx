import { refreshDraftAction } from "@/app/(app)/documents/form-actions";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { Card } from "@/components/ui";
import type { StoredDocument } from "@/lib/data/documents";
import type { OutdatedFact } from "@/lib/documents/autofill";
import { ROLE_LABELS, roleOf } from "@/lib/documents/library";
import { ChangedFacts, VersionList } from "./parts";
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
        <Card
          title={check.ok ? "Checked: this is the official form" : "This download didn’t pass every check"}
          icon={check.ok ? "badge" : "info"}
          tone={check.ok ? "done" : "warn"}
          id="checked-heading"
        >
          <ul className="flex flex-col gap-2">
            {check.checks.map((item) => (
              <li key={item.label} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-xs font-bold ${item.ok ? "border-done/25 bg-done-tint text-done" : "border-check-ring bg-check-tint text-check"}`}
                >
                  {item.ok ? <Icon name="check" size="xs" strokeWidth={2.4} /> : "!"}
                </span>
                <span>
                  <span className="sr-only">{item.ok ? "Passed: " : "Failed: "}</span>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[14.5px] text-muted">
            Downloaded from {check.government} on <LocalDate iso={check.checkedAt} />. The original is kept exactly as downloaded
            {doc.sha256 ? ` (fingerprint ${doc.sha256.slice(0, 12)})` : ""}.
          </p>
          {check.ok ? null : (
            <p className="text-[15px] text-check">
              It may be a newer version than the one First Sale checked, so its blanks weren’t filled in automatically. You can still draft answers below and make an answer sheet.
            </p>
          )}
        </Card>
      ) : null}

      {outdated.length ? (
        <Card title="Some answers are out of date" icon="info" tone="warn" id="outdated-heading" className="border-check-ring!">
          <ChangedFacts facts={outdated} />
          <p className="text-rule">Answers you confirmed with the old details will need checking again. Copies you already made stay as they were.</p>
          <ActionButton action={refreshDraftAction.bind(null, doc.id)} label="Update the answers" pendingLabel="Updating…" variant="primary" />
        </Card>
      ) : null}

      {versions.length || doc.origin === "upload" ? (
        <Card title="Versions" icon="clock" tone="gray" id="versions-heading">
          <p className="text-[15px] text-rule">
            This is version {doc.version}: {ROLE_LABELS[roleOf(doc)].toLowerCase()}, added <LocalDate iso={doc.createdAt.toISOString()} />.
          </p>
          {versions.length ? (
            <VersionList
              versions={versions.map((version) => ({
                id: version.id,
                label: `Version ${version.version}: ${ROLE_LABELS[roleOf(version)].toLowerCase()}`,
                createdAt: version.createdAt,
              }))}
            />
          ) : null}
          {doc.origin === "upload" ? <ReplaceFile documentId={doc.id} accept={acceptedTypes} /> : null}
        </Card>
      ) : null}
    </>
  );
}
