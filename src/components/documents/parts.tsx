import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import type { StoredDocument } from "@/lib/data/documents";
import type { GeneratedKind } from "@/lib/domain";
import { roleOf } from "@/lib/documents/library";
import type { DocumentContent } from "@/lib/documents/types";

// Pieces shared by the library and its document pages

export function BackToLibrary() {
  return (
    <Link href="/documents" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-accent">
      <Icon name="back" size="sm" />
      <span className="sr-only">Back to </span>
      Documents
    </Link>
  );
}

// Short notes on what happens on this page
const KIND_ICONS: Record<GeneratedKind, IconName> = {
  business_plan: "book",
  filled_form: "filecheck",
  answer_sheet: "filecheck",
  startup_plan: "checklist",
  website_copy: "globe",
  answer_guide: "checklist",
  owners_agreement: "scale",
  marketing_plan: "megaphone",
  logo_guide: "palette",
};

export function docIcon(doc: StoredDocument): IconName {
  if (doc.generatedKind) return KIND_ICONS[doc.generatedKind];
  switch (roleOf(doc)) {
    case "mail":
      return "mail";
    case "receipt":
      return "receipt";
    case "approval":
      return "badge";
    case "supporting":
      return "paperclip";
    case "reviewed":
      return "filecheck";
    case "answer_guide":
      return "checklist";
    case "form":
      return "clipboard";
    default:
      return "file";
  }
}

// A paper-shaped tile for a document's type
export function DocIcon({ icon }: { icon: IconName }) {
  return (
    <span aria-hidden="true" className="grid h-[46px] w-[38px] shrink-0 place-items-center rounded-md border border-line bg-soft text-muted">
      <Icon name={icon} size="sm" />
    </span>
  );
}

const TAGS = {
  plain: "border-line bg-surface text-rule",
  gray: "border-line bg-wash text-rule",
  accent: "border-accent-ring bg-accent-tint text-accent-ink",
  warn: "border-check-ring bg-check-tint text-check",
} as const;

// Like Chip, but long labels wrap instead of pushing the page sideways
export function Tag({ tone = "plain", icon, children }: { tone?: keyof typeof TAGS; icon?: IconName; children: ReactNode }) {
  return (
    <span className={`inline-flex w-fit max-w-full items-start gap-1.5 rounded-lg border px-2.5 py-1 text-[13.5px] font-semibold leading-snug ${TAGS[tone]}`}>
      {icon ? <Icon name={icon} size="xs" className="mt-[3px]" /> : null}
      <span className="min-w-0">{children}</span>
    </span>
  );
}

// The text read from a document, page by page, folded away
export function ReadText({ pages }: { pages: DocumentContent["pages"] }) {
  return (
    <SubFold
      summary={
        <>
          <span className="group-open:hidden">See the text we read</span>
          <span className="hidden group-open:inline">Hide the text</span>
        </>
      }
    >
      {pages.map((page) => (
        <div key={page.number} className="flex flex-col gap-1">
          <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-muted">Page {page.number}</p>
          <p className="whitespace-pre-wrap break-words text-[15px] text-rule">{page.text || "No text on this page."}</p>
        </div>
      ))}
    </SubFold>
  );
}

// A small fold inside a card, such as "Help with each blank"
export function SubFold({ summary, children, className = "" }: { summary: ReactNode; children: ReactNode; className?: string }) {
  return (
    <details className={`group rounded-xl border border-line bg-surface ${className}`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 py-2 font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <Icon name="chevron" size="sm" className="text-faint transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="flex flex-col gap-2.5 border-t border-line px-3.5 py-3">{children}</div>
    </details>
  );
}

// Old → new values for details that changed
export function ChangedFacts({ facts }: { facts: { label: string; before: string; now: string | null }[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {facts.map((fact) => (
        <li key={fact.label}>
          <span className="font-semibold">{fact.label}:</span> {fact.before || "not set"} → {fact.now ?? "removed"}
        </li>
      ))}
    </ul>
  );
}

// Links to a document's other versions, newest first
export function VersionList({ versions }: { versions: { id: string; label: string; createdAt: Date }[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {versions.map((version) => (
        <li key={version.id}>
          <Link
            href={`/documents/${encodeURIComponent(version.id)}`}
            className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2 shadow-soft transition hover:border-line-strong hover:shadow-card"
          >
            <Icon name="file" size="sm" className="text-faint" />
            <span className="min-w-0 flex-1 font-semibold text-ink">
              {version.label}
              <span className="font-normal text-muted">
                , <LocalDate iso={version.createdAt.toISOString()} />
              </span>
            </span>
            <Icon name="chevron" size="sm" className="text-faint" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
