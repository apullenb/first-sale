import Link from "next/link";
import { LocalDate } from "@/components/local-date";
import { SECONDARY_LINK } from "@/components/styles";
import type { StoredDocument } from "@/lib/data/documents";
import { fileHref, formatBytes, formKindLabel, GENERATED_LABELS } from "./labels";

interface Props {
  id: string;
  heading: string;
  empty: string;
  documents: StoredDocument[];
  stepTitles: ReadonlyMap<string, string>;
}

export function DocumentList({ id, heading, empty, documents, stepTitles }: Props) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5">
      <h2 id={id} className="font-display text-xl font-bold">
        {heading}
      </h2>
      {documents.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {documents.map((doc) => (
            <DocumentItem key={doc.id} doc={doc} stepTitle={doc.taskId ? (stepTitles.get(doc.taskId) ?? null) : null} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentItem({ doc, stepTitle }: { doc: StoredDocument; stepTitle: string | null }) {
  const kind = doc.generatedKind ? GENERATED_LABELS[doc.generatedKind] : formKindLabel(doc.origin, doc.mimeType);
  const facts = [kind, doc.byteSize > 0 ? formatBytes(doc.byteSize) : null].filter(Boolean).join(" · ");

  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-4 ring-1 ring-ink/5 sm:px-5">
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-[17px] font-bold leading-snug break-words">{doc.title}</h3>
        <p className="text-sm text-muted">
          {facts} · Added <LocalDate iso={doc.createdAt.toISOString()} />
        </p>
        {stepTitle ? (
          <p className="text-sm text-rule">
            <span className="font-semibold">Plan step:</span> {stepTitle}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/documents/${encodeURIComponent(doc.id)}`} className={SECONDARY_LINK}>
          Open<span className="sr-only"> {doc.title}</span>
        </Link>
        {doc.hasFile ? (
          <a href={fileHref(doc.id)} className={SECONDARY_LINK}>
            Download<span className="sr-only"> {doc.title}</span>
          </a>
        ) : null}
      </div>
    </li>
  );
}
