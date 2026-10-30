import Link from "next/link";
import { deleteDocumentAction, explainReceivedAction, linkStepAction } from "@/app/(app)/documents/actions";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { SECONDARY_LINK } from "@/components/styles";
import { Card, Fold, Note } from "@/components/ui";
import type { StoredDocument } from "@/lib/data/documents";
import type { RunState } from "@/lib/data/workflow-runs";
import type { TaskStatus } from "@/lib/domain";
import { ROLE_LABELS, roleOf } from "@/lib/documents/library";
import type { ReceivedGuide } from "@/lib/documents/types";
import { AnchorNote } from "./anchor-note";
import { DocumentHead } from "./document-head";
import { fileHref, isReadable } from "./labels";
import { docIcon, Tag, VersionList, WhoDoesWhat } from "./parts";
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
      <DocumentHead documentId={doc.id} title={doc.title}>
        <p>
          {ROLE_LABELS[roleOf(doc)]}. You uploaded it on <LocalDate iso={doc.createdAt.toISOString()} />.
        </p>
      </DocumentHead>

      <Card title="This document" icon={docIcon(doc)} tone="gray" id="document-heading">
        {steps.length ? <StepLink key={doc.taskId ?? ""} documentId={doc.id} stepId={doc.taskId} steps={steps} /> : null}
        <div className={`flex flex-wrap items-start justify-between gap-2 ${steps.length ? "border-t border-line pt-4" : ""}`}>
          {doc.hasFile ? (
            <div className="flex flex-wrap gap-2">
              <a href={fileHref(doc.id, true)} target="_blank" rel="noopener noreferrer" className={SECONDARY_LINK}>
                <Icon name="eye" size="sm" className="text-muted" />
                Preview<span className="sr-only"> (opens in a new tab)</span>
              </a>
              <a href={fileHref(doc.id)} className={SECONDARY_LINK}>
                <Icon name="download" size="sm" className="text-muted" />
                Download
              </a>
            </div>
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
      </Card>

      {simulated ? <PracticeBanner what="This document was explained in practice mode." /> : null}

      <Card title="What this document is" icon="lightbulb" id="explain-heading">
        <WhoDoesWhat
          items={[
            ["ai", "AI explains it in plain words, using only what the document says."],
            ["rule", "Quotes, deadlines and amounts are checked against its text, and web addresses against the official .gov list."],
          ]}
        />
        <RunNotice run={run} what="Explaining this document" />
        {received ? (
          <Explanation received={received} flags={doc.guide?.flags ?? []} explainedAt={doc.guide?.createdAt ?? null} matched={matched} doc={doc} />
        ) : (
          <div className="flex flex-col gap-1.5 text-rule">
            <p>Not sure what this is? Get a plain-language explanation: what it is, who sent it, what it means for your business, and anything you need to do.</p>
            <p className="text-[14.5px] text-muted">It goes to the AI service only when you click. Social Security, tax ID and card numbers are left out of the explanation.</p>
          </div>
        )}
        <ActionButton
          action={explainReceivedAction.bind(null, doc.id)}
          label={received ? "Explain it again" : "Explain this document"}
          pendingLabel="Explaining…"
          pendingStatus="Reading it and writing an explanation… this can take a minute"
          variant={received ? "secondary" : "ai"}
          ai
        />
      </Card>

      <Card title="Versions" icon="clock" tone="gray" id="versions-heading">
        <p className="text-[15px] text-rule">
          This is version {doc.version}, added <LocalDate iso={doc.createdAt.toISOString()} />.
        </p>
        {versions.length ? (
          <VersionList versions={versions.map((version) => ({ id: version.id, label: `Version ${version.version}`, createdAt: version.createdAt }))} />
        ) : null}
        <ReplaceFile documentId={doc.id} accept={acceptedTypes} />
      </Card>

      {isReadable(doc.content) ? (
        <Fold title="The text we read" summary={doc.content.pages.length === 1 ? "1 page, as First Sale read it" : `${doc.content.pages.length} pages, as First Sale read it`} icon="search">
          {doc.content.pages.map((page) => (
            <div key={page.number} className="flex flex-col gap-1 border-t border-line pt-3 first:border-0 first:pt-0">
              <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-muted">Page {page.number}</p>
              <p className="whitespace-pre-wrap break-words text-[15px] text-rule">{page.text || "No text on this page."}</p>
            </div>
          ))}
        </Fold>
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
    <div className="flex flex-col gap-5 border-t border-line pt-4">
      {flags.length ? (
        <Note>
          <ul className="flex flex-col gap-1">
            {flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </Note>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="font-display text-[22px] leading-snug">{received.whatItIs}</p>
        <AnchorNote anchor={received.whatItIsAnchor} on={ON} missing={MISSING} />
      </div>

      {received.notGovernment ? (
        <Note>
          <p className="font-semibold">It says it isn’t from a government office</p>
          <AnchorNote anchor={received.notGovernment} on={ON} />
          <p className="mt-1 text-[14.5px]">Mail like this can look official. Before you pay, look the office up yourself and check with them directly.</p>
        </Note>
      ) : null}

      <dl className="flex flex-col">
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 border-b border-line py-2.5">
          <dt className="w-44 shrink-0 text-[15px] text-muted">Who sent it</dt>
          <dd className="min-w-0 flex-1 basis-56 font-semibold">{received.from}</dd>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 py-2.5">
          <dt className="w-44 shrink-0 text-[15px] text-muted">What it means for you</dt>
          <dd className="min-w-0 flex-1 basis-56">{received.meaning}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2.5">
        <h3 className="font-bold">What to do</h3>
        {received.todo.length ? (
          <ol className="flex flex-col gap-2.5">
            {received.todo.map((entry, index) => (
              <li key={index} className="grid grid-cols-[30px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-line bg-surface p-3.5">
                <span aria-hidden="true" className="grid size-[30px] place-items-center rounded-full border border-accent-ring bg-accent-tint font-display text-accent">
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="font-semibold leading-snug">{entry.text}</span>
                  {entry.deadline || entry.amount ? (
                    <span className="flex flex-wrap gap-1.5">
                      {entry.deadline ? (
                        <Tag tone="warn" icon="calendar">
                          Deadline: {entry.deadline}
                        </Tag>
                      ) : null}
                      {entry.amount ? (
                        <Tag tone="gray" icon="dollar">
                          Amount: {entry.amount}
                        </Tag>
                      ) : null}
                    </span>
                  ) : null}
                  <AnchorNote anchor={entry.anchor} on={ON} missing={MISSING} />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-rule">The explanation found nothing this document asks you to do.</p>
        )}
      </div>

      {received.sites.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">Websites on it</h3>
          <ul className="flex flex-col gap-2">
            {received.sites.map((site) => (
              <li key={site.host} className="flex items-start gap-2.5 text-[15px] text-rule">
                <Icon name={site.government ? "badge" : "info"} size="sm" className={`mt-0.5 ${site.government ? "text-done" : "text-check"}`} />
                <span className="min-w-0">
                  <span className="font-semibold break-all text-ink">{site.host}</span>
                  {site.government
                    ? `: an official government website (${site.government}).`
                    : ": not on the official .gov list. Some real offices still use older addresses, so look the office up yourself before you pay or share anything."}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {matched ? (
        <div className="flex flex-col gap-2 rounded-xl border border-accent-ring bg-accent-tint px-4 py-3.5">
          <h3 className="flex items-center gap-2 font-bold text-accent-ink">
            <Icon name="flag" size="sm" />
            In your plan
          </h3>
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

      <p className="text-[14.5px] text-muted">
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
