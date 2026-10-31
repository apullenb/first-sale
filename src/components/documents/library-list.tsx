import Link from "next/link";
import { explainReceivedAction } from "@/app/(app)/documents/actions";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import type { StoredDocument } from "@/lib/data/documents";
import type { OutdatedFact } from "@/lib/documents/autofill";
import { type DocumentRole, families, isKept, ROLE_LABELS, roleOf } from "@/lib/documents/library";
import { fileHref, formatBytes } from "./labels";
import { DocIcon, docIcon, Tag } from "./parts";
import { ResourceLink } from "@/components/ui";

const VIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

// Draft, reviewed or record: kept apart, so a prepared copy never reads as filed
export function documentStatus(
  doc: StoredDocument,
  outdated: readonly OutdatedFact[],
  versions: readonly StoredDocument[] = [],
): { label: string; tone: "ok" | "check" | "plain" } {
  const role = roleOf(doc);
  if (outdated.length) return { label: "Outdated: your details changed", tone: "check" };
  if (role === "mail") return doc.guide?.received ? { label: "Letter or notice, explained", tone: "ok" } : { label: "Letter or notice, not explained yet", tone: "check" };
  const reviewed = versions.find((version) => roleOf(version) === "reviewed");
  if (role === "receipt" || role === "approval") return { label: "Record of filing", tone: "ok" };
  if (role === "reviewed") return { label: "Reviewed copy, not filed", tone: "plain" };
  if (role === "prepared" || role === "supporting") return { label: ROLE_LABELS[role], tone: "plain" };
  const answers = Object.values(doc.answers);
  const toCheck = answers.filter((answer) => answer.state === "suggested").length;
  if (toCheck) return { label: `Draft: ${toCheck} ${toCheck === 1 ? "answer" : "answers"} to check`, tone: "check" };
  if (reviewed) return { label: `Reviewed copy saved (version ${reviewed.version}), not filed`, tone: "ok" };
  if (answers.some((answer) => answer.state === "confirmed")) return { label: "Answers confirmed, ready for a reviewed copy", tone: "ok" };
  return { label: role === "original" ? "Unchanged original, not started" : "Not started", tone: "plain" };
}

const TONES = { ok: "accent", check: "warn", plain: "gray" } as const;

// Compact row buttons, 44px tall
const ROW_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-line-strong bg-surface px-2.5 text-[15px] font-semibold text-ink shadow-soft transition hover:border-muted hover:bg-soft sm:px-3";

interface Props {
  documents: StoredDocument[];
  steps: { id: string; title: string }[];
  outdated: ReadonlyMap<string, OutdatedFact[]>;
}

// Every document, grouped by the plan step it belongs to, each with its versions
export function LibraryList({ documents, steps, outdated }: Props) {
  const groups = families(documents);
  const stepIds = new Set(steps.map((step) => step.id));
  const sections = [
    ...steps.map((step) => ({ id: step.id, title: step.title, groups: groups.filter((group) => group.root.taskId === step.id) })),
    { id: "", title: "Not linked to a step", groups: groups.filter((group) => !group.root.taskId || !stepIds.has(group.root.taskId)) },
  ].filter((section) => section.groups.length);

  if (!sections.length) {
    return (
      <div className="flex flex-col items-center gap-3 px-2 py-6 text-center text-muted">
        <span aria-hidden="true" className="flex gap-2">
          <DocIcon icon="file" />
          <DocIcon icon="filecheck" />
        </span>
        <p>No documents yet. Forms you add, papers you upload and documents First Sale prepares land here.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.id || "none"} aria-labelledby={`lib-${section.id || "none"}`} className="flex flex-col gap-2.5">
          <h3 id={`lib-${section.id || "none"}`} className="flex min-h-11 items-center gap-2 text-[15.5px] font-bold">
            <Icon name="flag" size="sm" className="text-accent" />
            {section.id ? (
              <Link href={`/checklist/${encodeURIComponent(section.id)}`} className="inline-flex min-h-11 min-w-0 items-center underline decoration-line-strong decoration-[1.5px] underline-offset-4 hover:text-accent hover:decoration-accent">
                {section.title}
              </Link>
            ) : (
              section.title
            )}
          </h3>
          <ul className="flex flex-col gap-2">
            {section.groups.map((group) => (
              <Family key={group.root.id} root={group.root} versions={group.versions} outdated={outdated} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Family({ root, versions, outdated }: { root: StoredDocument; versions: StoredDocument[]; outdated: ReadonlyMap<string, OutdatedFact[]> }) {
  const status = documentStatus(root, outdated.get(root.id) ?? [], versions);
  const role: DocumentRole = roleOf(root);
  const roleLabel = ROLE_LABELS[role];
  return (
    <li className="rounded-xl border border-line bg-surface shadow-soft">
      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-3.5">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <DocIcon icon={docIcon(root)} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h4 className="font-bold leading-snug break-words">{root.title}</h4>
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag>{roleLabel}</Tag>
              {status.label !== roleLabel ? (
                <Tag tone={TONES[status.tone]} icon={status.tone === "check" ? "info" : status.tone === "ok" ? "check" : undefined}>
                  {status.label}
                </Tag>
              ) : null}
            </div>
            <p className="text-[14.5px] text-muted">
              {root.obtainedAt ? "Downloaded" : "Added"} <LocalDate iso={(root.obtainedAt ?? root.createdAt).toISOString()} />
              {root.byteSize > 0 ? ` · ${formatBytes(root.byteSize)}` : null}
              {root.sourceUrl && role === "original" ? (
                <>
                  {" · From "}
                  <ResourceLink href={root.sourceUrl}>{new URL(root.sourceUrl).hostname}</ResourceLink>
                  {root.verification ? (root.verification.ok ? ", checked as the right form" : ", didn’t pass every check") : null}
                </>
              ) : null}
            </p>
          </div>
        </div>
        <Actions doc={root} />
      </div>
      {versions.length ? (
        <details className="group rounded-b-[11px] border-t border-line bg-soft">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 text-[15px] font-semibold text-accent-ink [&::-webkit-details-marker]:hidden">
            <Icon name="chevron" size="sm" className="transition-transform group-open:rotate-90" />
            {versions.length === 1 ? "1 later version" : `${versions.length} later versions`}
          </summary>
          <ul className="flex flex-col">
            {versions.map((doc) => (
              <li key={doc.id} className="flex flex-col gap-2 border-t border-line px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4 sm:pl-[66px]">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="font-semibold">
                    Version {doc.version}: {ROLE_LABELS[roleOf(doc)]}
                  </p>
                  <p className="text-[14.5px] text-muted">
                    Made <LocalDate iso={doc.createdAt.toISOString()} />
                    {(outdated.get(doc.id) ?? []).length ? " · made before your details changed" : ""}
                  </p>
                </div>
                <Actions doc={doc} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function Actions({ doc }: { doc: StoredDocument }) {
  return (
    <div className="flex shrink-0 flex-wrap items-start gap-1.5 sm:gap-2">
      {isKept(doc) && !doc.guide?.received ? (
        <ActionButton
          action={explainReceivedAction.bind(null, doc.id)}
          label="Explain this document"
          pendingLabel="Explaining…"
          pendingStatus="Reading it and writing an explanation… this can take a minute"
          variant="ai"
          doneHref={`/documents/${encodeURIComponent(doc.id)}#explain-heading`}
        />
      ) : null}
      <Link href={`/documents/${encodeURIComponent(doc.id)}`} className={ROW_BUTTON}>
        Open<span className="sr-only"> {doc.title}</span>
      </Link>
      {doc.hasFile && VIEWABLE.has(doc.mimeType) ? (
        <a href={fileHref(doc.id, true)} target="_blank" rel="noopener noreferrer" className={ROW_BUTTON}>
          <Icon name="eye" size="sm" className="text-muted" />
          Preview<span className="sr-only"> {doc.title} (opens in a new tab)</span>
        </a>
      ) : null}
      {doc.hasFile ? (
        <a href={fileHref(doc.id)} className={ROW_BUTTON}>
          <Icon name="download" size="sm" className="text-muted" />
          Download<span className="sr-only"> {doc.title}</span>
        </a>
      ) : null}
    </div>
  );
}
