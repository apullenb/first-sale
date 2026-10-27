import Link from "next/link";
import { LocalDate } from "@/components/local-date";
import { SECONDARY_LINK, SECTION_TITLE } from "@/components/styles";
import type { StoredDocument } from "@/lib/data/documents";
import type { OutdatedFact } from "@/lib/documents/autofill";
import { type DocumentRole, families, ROLE_LABELS, roleOf } from "@/lib/documents/library";
import { fileHref, formatBytes } from "./labels";

const VIEWABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);

// Draft, reviewed or record: kept apart, so a prepared copy never reads as filed
export function documentStatus(
  doc: StoredDocument,
  outdated: readonly OutdatedFact[],
  versions: readonly StoredDocument[] = [],
): { label: string; tone: "ok" | "check" | "plain" } {
  const role = roleOf(doc);
  if (outdated.length) return { label: "Outdated: your details changed", tone: "check" };
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

const TONES = { ok: "bg-accent-tint text-accent-ink", check: "bg-check-tint text-check", plain: "bg-rule-tint text-rule" } as const;

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

  if (!sections.length) return <p className="text-muted">No documents yet.</p>;
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <section key={section.id || "none"} aria-labelledby={`lib-${section.id || "none"}`} className="flex flex-col gap-2.5">
          <h2 id={`lib-${section.id || "none"}`} className={SECTION_TITLE}>
            {section.id ? (
              <Link href={`/checklist/${encodeURIComponent(section.id)}`} className="underline underline-offset-4">
                {section.title}
              </Link>
            ) : (
              section.title
            )}
          </h2>
          <ul className="flex flex-col gap-2.5">
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
  const facts = [ROLE_LABELS[role], root.byteSize > 0 ? formatBytes(root.byteSize) : null].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-4 ring-1 ring-ink/5 sm:px-5">
      <div className="flex min-w-0 flex-col gap-1">
        <span className={`w-fit rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${TONES[status.tone]}`}>{status.label}</span>
        <h3 className="text-[17px] font-bold leading-snug break-words">{root.title}</h3>
        <p className="text-sm text-muted">
          {facts} · {root.obtainedAt ? "Downloaded" : "Added"} <LocalDate iso={(root.obtainedAt ?? root.createdAt).toISOString()} />
        </p>
        {root.sourceUrl && role === "original" ? (
          <p className="text-sm text-muted">
            From{" "}
            <a href={root.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2">
              {new URL(root.sourceUrl).hostname}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            {root.verification ? (root.verification.ok ? ", checked as the right form" : ", didn’t pass every check") : null}
          </p>
        ) : null}
      </div>
      <Actions doc={root} />
      {versions.length ? (
        <details className="group">
          <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-accent-ink underline underline-offset-4">
            {versions.length === 1 ? "1 later version" : `${versions.length} later versions`}
          </summary>
          <ul className="mt-1 flex flex-col gap-2">
            {versions.map((doc) => (
              <li key={doc.id} className="flex flex-col gap-1.5 rounded-xl bg-ground px-3.5 py-3">
                <p className="font-semibold">
                  Version {doc.version}: {ROLE_LABELS[roleOf(doc)]}
                </p>
                <p className="text-sm text-muted">
                  Made <LocalDate iso={doc.createdAt.toISOString()} />
                  {(outdated.get(doc.id) ?? []).length ? " · made before your details changed" : ""}
                </p>
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
    <div className="flex flex-wrap gap-2">
      <Link href={`/documents/${encodeURIComponent(doc.id)}`} className={SECONDARY_LINK}>
        Open<span className="sr-only"> {doc.title}</span>
      </Link>
      {doc.hasFile && VIEWABLE.has(doc.mimeType) ? (
        <a href={fileHref(doc.id, true)} target="_blank" rel="noopener noreferrer" className={SECONDARY_LINK}>
          Preview<span className="sr-only"> {doc.title} (opens in a new tab)</span>
        </a>
      ) : null}
      {doc.hasFile ? (
        <a href={fileHref(doc.id)} className={SECONDARY_LINK}>
          Download<span className="sr-only"> {doc.title}</span>
        </a>
      ) : null}
    </div>
  );
}
