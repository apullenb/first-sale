import Link from "next/link";
import { deleteDocumentAction, explainReceivedAction, linkStepAction } from "@/app/(app)/documents/actions";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { CARD, EYEBROW, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import type { StoredDocument } from "@/lib/data/documents";
import type { RunState } from "@/lib/data/workflow-runs";
import type { TaskStatus } from "@/lib/domain";
import { ROLE_LABELS, roleOf } from "@/lib/documents/library";
import type { ReceivedGuide } from "@/lib/documents/types";
import { AnchorNote } from "./anchor-note";
import { DocumentTitle } from "./document-title";
import { fileHref, isReadable } from "./labels";
import { ReplaceFile } from "./replace-file";
import { RunNotice } from "./run-notice";
import { StepLink } from "./step-link";

const ON = "On the document";
const MISSING = "We couldn’t point to this on the document";

interface Props {
  doc: StoredDocument;
  steps: { id: string; title: string }[];
  run: RunState | null;
  // The plan step the explanation says it's the record of
  matched: { id: string; title: string; status: TaskStatus } | null;
  // Other versions of the same document, newest first
  versions: StoredDocument[];
  acceptedTypes: string;
}

// A letter, notice or record the owner already has: kept as uploaded, explained when they ask
export function ReceivedView({ doc, steps, run, matched, versions, acceptedTypes }: Props) {
  const received = doc.guide?.received ?? null;
  const simulated = Boolean(doc.guide?.simulated) || (doc.content.simulated && isReadable(doc.content));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/documents" className={`${TEXT_LINK} flex min-h-11 w-fit items-center`}>
          Back to your documents
        </Link>
        <p className={EYEBROW}>Start your business · Step 5</p>
        <DocumentTitle key={doc.title} documentId={doc.id} title={doc.title} />
        <p className="text-rule">
          {ROLE_LABELS[roleOf(doc)]}. You uploaded it on <LocalDate iso={doc.createdAt.toISOString()} />.
        </p>
        {steps.length ? <StepLink key={doc.taskId ?? ""} documentId={doc.id} stepId={doc.taskId} steps={steps} /> : null}
        <div className="flex flex-wrap items-start gap-2">
          {doc.hasFile ? (
            <>
              <a href={fileHref(doc.id, true)} target="_blank" rel="noopener noreferrer" className={SECONDARY_LINK}>
                Preview<span className="sr-only"> (opens in a new tab)</span>
              </a>
              <a href={fileHref(doc.id)} className={SECONDARY_LINK}>
                Download
              </a>
            </>
          ) : null}
          <ActionButton
            action={deleteDocumentAction.bind(null, doc.id)}
            label="Delete"
            pendingLabel="Deleting…"
            variant="danger"
            confirm={`Delete “${doc.title}”? This removes the file and its explanation. This can’t be undone.`}
            doneHref="/documents"
          />
        </div>
      </div>

      {simulated ? <PracticeBanner what="This document was explained in practice mode." /> : null}

      <section aria-labelledby="explain-heading" className={`${CARD} flex flex-col gap-4`}>
        <h2 id="explain-heading" className={SECTION_TITLE}>
          What this document is
        </h2>
        <ul className="flex flex-col gap-2 text-sm text-rule">
          <li className="flex items-start gap-2.5">
            <ActorChip actor="ai" />
            <span>AI explains it in plain words, using only what the document says.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <ActorChip actor="rule" />
            <span>Quotes, deadlines and amounts are checked against its text, and web addresses against the official .gov list.</span>
          </li>
        </ul>
        <RunNotice run={run} what="Explaining this document" />
        {received ? (
          <Explanation received={received} flags={doc.guide?.flags ?? []} explainedAt={doc.guide?.createdAt ?? null} matched={matched} doc={doc} />
        ) : (
          <div className="flex flex-col gap-1.5 text-rule">
            <p>Not sure what this is? Get a plain-language explanation: what it is, who sent it, what it means for your business, and anything you need to do.</p>
            <p className="text-sm text-muted">It goes to the AI service only when you click. Social Security, tax ID and card numbers are left out of the explanation.</p>
          </div>
        )}
        <ActionButton
          action={explainReceivedAction.bind(null, doc.id)}
          label={received ? "Explain it again" : "Explain this document"}
          pendingLabel="Explaining…"
          pendingStatus="Reading it and writing an explanation… this can take a minute"
          variant={received ? "secondary" : "ai"}
        />
      </section>

      <section aria-labelledby="versions-heading" className={`${CARD} flex flex-col gap-2.5`}>
        <h2 id="versions-heading" className={SECTION_TITLE}>
          Versions
        </h2>
        <p className="text-[15px] text-rule">
          This is version {doc.version}, added <LocalDate iso={doc.createdAt.toISOString()} />.
        </p>
        {versions.length ? (
          <ul className="flex flex-col">
            {versions.map((version) => (
              <li key={version.id}>
                <Link href={`/documents/${encodeURIComponent(version.id)}`} className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
                  Version {version.version}, <LocalDate iso={version.createdAt.toISOString()} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <ReplaceFile documentId={doc.id} accept={acceptedTypes} />
      </section>

      {isReadable(doc.content) ? (
        <details className={`group ${CARD}`}>
          <summary className="flex min-h-11 w-fit cursor-pointer items-center font-semibold text-accent-ink underline underline-offset-4">
            <span className="group-open:hidden">See the text we read</span>
            <span className="hidden group-open:inline">Hide the text</span>
          </summary>
          <div className="mt-1 flex flex-col gap-3">
            {doc.content.pages.map((page) => (
              <div key={page.number} className="flex flex-col gap-1 rounded-xl bg-ground px-3.5 py-3">
                <p className="text-sm font-semibold text-muted">Page {page.number}</p>
                <p className="whitespace-pre-wrap break-words text-sm text-rule">{page.text || "No text on this page."}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

interface ExplanationProps {
  received: ReceivedGuide;
  flags: string[];
  explainedAt: string | null;
  matched: Props["matched"];
  doc: StoredDocument;
}

function Explanation({ received, flags, explainedAt, matched, doc }: ExplanationProps) {
  return (
    <div className="flex flex-col gap-5">
      {flags.length ? (
        <ul className="flex flex-col gap-1 rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
          {flags.map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="font-display text-xl font-bold leading-snug">{received.whatItIs}</p>
        <AnchorNote anchor={received.whatItIsAnchor} on={ON} missing={MISSING} />
      </div>

      {received.notGovernment ? (
        <div className="flex flex-col gap-1.5 rounded-xl bg-check-tint px-4 py-3 text-check">
          <p className="font-semibold">It says it isn’t from a government office</p>
          <AnchorNote anchor={received.notGovernment} on={ON} />
          <p className="text-sm">Mail like this can look official. Before you pay, look the office up yourself and check with them directly.</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <h3 className="font-bold">Who sent it</h3>
        <p className="text-rule">{received.from}</p>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="font-bold">What it means for you</h3>
        <p className="text-rule">{received.meaning}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-bold">What to do</h3>
        {received.todo.length ? (
          <ul className="flex flex-col gap-2.5">
            {received.todo.map((entry, index) => (
              <li key={index} className="flex flex-col gap-1 border-l-2 border-line pl-3">
                <span>{entry.text}</span>
                {entry.deadline || entry.amount ? (
                  <span className="flex flex-wrap gap-2 text-sm">
                    {entry.deadline ? <span className="rounded-full bg-check-tint px-2.5 py-0.5 font-semibold text-check">Deadline: {entry.deadline}</span> : null}
                    {entry.amount ? <span className="rounded-full bg-rule-tint px-2.5 py-0.5 font-semibold text-rule">Amount: {entry.amount}</span> : null}
                  </span>
                ) : null}
                <AnchorNote anchor={entry.anchor} on={ON} missing={MISSING} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-rule">The explanation found nothing this document asks you to do.</p>
        )}
      </div>

      {received.sites.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">Websites on it</h3>
          <ul className="flex flex-col gap-1.5">
            {received.sites.map((site) => (
              <li key={site.host} className="text-[15px] text-rule">
                <span className="font-semibold break-all">{site.host}</span>
                {site.government
                  ? `: an official government website (${site.government}).`
                  : ": not on the official .gov list. Some real offices still use older addresses, so look the office up yourself before you pay or share anything."}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {matched ? (
        <div className="flex flex-col gap-2 rounded-xl bg-accent-tint px-4 py-3">
          <h3 className="font-bold text-accent-ink">In your plan</h3>
          <p className="text-accent-ink">
            This looks like the record for your step{" "}
            <Link href={`/checklist/${matched.id}`} className="font-semibold underline underline-offset-4">
              {matched.title}
            </Link>
            .{matched.status === "done" ? " That step is already marked done." : ""}
          </p>
          <div className="flex flex-wrap items-start gap-2">
            {doc.taskId !== matched.id ? (
              <ActionButton action={linkStepAction.bind(null, { documentId: doc.id, stepId: matched.id })} label="Save it to that step" pendingLabel="Saving…" />
            ) : null}
            {matched.status !== "done" ? (
              <Link href={`/checklist/${matched.id}#progress-heading`} className={SECONDARY_LINK}>
                Open the step to mark it done
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="text-sm text-muted">
        {explainedAt ? (
          <>
            Explained <LocalDate iso={explainedAt} />.{" "}
          </>
        ) : null}
        Check anything important against the document itself, or with the office that sent it.
      </p>
    </div>
  );
}
