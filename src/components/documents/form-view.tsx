import Link from "next/link";
import {
  answerSheetAction,
  deleteDocumentAction,
  explainDocumentAction,
  fillCopyAction,
  readAgainAction,
} from "@/app/(app)/documents/actions";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { CARD, EYEBROW, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import type { StoredDocument } from "@/lib/data/documents";
import { CUT_OFF_MESSAGE, type RunState } from "@/lib/data/workflow-runs";
import type { DocumentGuide } from "@/lib/documents/types";
import { AnchorNote } from "./anchor-note";
import { AnswersEditor, type EditorField } from "./answers-editor";
import { AskForm } from "./ask-form";
import { DocumentTitle } from "./document-title";
import { fileHref, isReadable, originSentence, READ_METHOD_LABELS } from "./labels";
import { RunNotice } from "./run-notice";
import { StepLink } from "./step-link";

export interface FormViewProps {
  doc: StoredDocument;
  steps: { id: string; title: string }[];
  runs: { read: RunState | null; explain: RunState | null; draft: RunState | null };
  editorFields: EditorField[];
  answersSignature: string;
  sourceLabels: Record<string, string>;
  detailOptions: { key: string; label: string }[];
  draftBlocked: string | null;
  maxQuestion: number;
}

export function FormView(props: FormViewProps) {
  const { doc, steps } = props;
  const simulated = doc.content.simulated || Boolean(doc.guide?.simulated);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/documents" className={`${TEXT_LINK} flex min-h-11 w-fit items-center`}>
          Back to your documents
        </Link>
        <p className={EYEBROW}>Start your business · Step 5</p>
        <DocumentTitle key={doc.title} documentId={doc.id} title={doc.title} />
        <p className="text-rule">
          {originSentence(doc.origin)} on <LocalDate iso={doc.createdAt.toISOString()} />.
          {doc.origin === "official_form" && doc.sourceUrl ? (
            <>
              {" "}
              <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                See it on the official website<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          ) : null}
        </p>
        {steps.length ? <StepLink key={doc.taskId ?? ""} documentId={doc.id} stepId={doc.taskId} steps={steps} /> : null}
        <div className="flex flex-wrap items-start gap-2">
          {doc.hasFile ? (
            <a href={fileHref(doc.id)} className={SECONDARY_LINK}>
              Download the original
            </a>
          ) : null}
          <ActionButton
            action={deleteDocumentAction.bind(null, doc.id)}
            label="Delete"
            pendingLabel="Deleting…"
            variant="danger"
            confirm={`Delete “${doc.title}”? This removes the file, its text, the explanation and your drafted answers. Details you saved to your business stay. This can’t be undone.`}
            doneHref="/documents"
          />
        </div>
      </div>

      {simulated ? <PracticeBanner what="This form was read and explained in practice mode." /> : null}

      <Reading {...props} />
      {isReadable(doc.content) ? (
        <>
          <Explain doc={doc} run={props.runs.explain} />
          <Ask doc={doc} maxQuestion={props.maxQuestion} />
        </>
      ) : null}
      {isReadable(doc.content) || doc.content.fields.length ? <Answers {...props} /> : null}
      {doc.content.fields.length ? <Prepared doc={doc} /> : null}
    </div>
  );
}

function Reading({ doc, runs }: FormViewProps) {
  const { content } = doc;
  const readable = isReadable(content);
  const lowCount = content.fields.filter((field) => field.confidence === "low").length;
  const readFailure = runs.read?.status === "failed" && runs.read.message !== CUT_OFF_MESSAGE ? runs.read.message : null;
  const stillReading = runs.read?.status === "running";
  const pasteHref = `/documents?add=paste${doc.taskId ? `&step=${encodeURIComponent(doc.taskId)}` : ""}#add-form`;

  return (
    <section aria-labelledby="reading-heading" className={`${CARD} flex flex-col gap-3`}>
      <h2 id="reading-heading" className={SECTION_TITLE}>
        Reading the form
      </h2>
      <RunNotice run={runs.read} what="Reading this form" />

      {stillReading && !readable ? null : readable ? (
        <>
          <p className="text-rule">
            {READ_METHOD_LABELS[content.readMethod]}. We found {content.fields.length}{" "}
            {content.fields.length === 1 ? "blank" : "blanks"} to fill in on {content.pages.length}{" "}
            {content.pages.length === 1 ? "page" : "pages"}.
          </p>
          {lowCount ? (
            <p className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
              {lowCount === 1 ? "One blank" : `${lowCount} blanks`} may have been misread. {lowCount === 1 ? "It’s" : "They’re"} marked
              in your answers below. Check {lowCount === 1 ? "it" : "them"} against the form.
            </p>
          ) : null}
          {content.unclear.length ? (
            <div className="flex flex-col gap-2 rounded-xl bg-check-tint px-4 py-3 text-check">
              <p className="font-semibold">We couldn’t read this part clearly</p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {content.unclear.map((part, index) => (
                  <li key={index}>
                    Page {part.page}, {part.where}: {part.why}
                  </li>
                ))}
              </ul>
              <p className="text-sm">Check the original, and type what it says when you fill in your answers.</p>
            </div>
          ) : null}
          <details className="group">
            <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-accent-ink underline underline-offset-4">
              <span className="group-open:hidden">See the text we read</span>
              <span className="hidden group-open:inline">Hide the text</span>
            </summary>
            <div className="mt-1 flex flex-col gap-3">
              {content.pages.map((page) => (
                <div key={page.number} className="flex flex-col gap-1 rounded-xl bg-ground px-3.5 py-3">
                  <p className="text-sm font-semibold text-muted">Page {page.number}</p>
                  <p className="whitespace-pre-wrap break-words text-sm text-rule">{page.text || "No text on this page."}</p>
                </div>
              ))}
            </div>
          </details>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-xl bg-check-tint px-4 py-3 text-check">
            <p className="font-semibold">We couldn’t read this form yet</p>
            {content.unclear.length || readFailure ? (
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {content.unclear.map((part, index) => (
                  <li key={index}>{part.why}</li>
                ))}
                {readFailure ? <li>{readFailure}</li> : null}
              </ul>
            ) : null}
          </div>
          <ActionButton
            action={readAgainAction.bind(null, doc.id)}
            label="Try reading it again"
            pendingLabel="Reading…"
            pendingStatus="Reading your form… this can take a minute"
            variant="ai"
          />
          <p className="text-rule">
            If it still can’t be read,{" "}
            <Link href={pasteHref} className={TEXT_LINK}>
              paste the form’s text instead
            </Link>
            .
          </p>
        </div>
      )}
    </section>
  );
}

function Explain({ doc, run }: { doc: StoredDocument; run: RunState | null }) {
  const guide = doc.guide;
  return (
    <section aria-labelledby="explain-heading" className={`${CARD} flex flex-col gap-4`}>
      <h2 id="explain-heading" className={SECTION_TITLE}>
        What this form is for
      </h2>
      <ul className="flex flex-col gap-2 text-sm text-rule">
        <li className="flex items-start gap-2.5">
          <ActorChip actor="ai" />
          <span>AI explains the form in plain words, using only what the form says.</span>
        </li>
        <li className="flex items-start gap-2.5">
          <ActorChip actor="rule" />
          <span>Every quote is checked against the form’s text, so you can find it on the page.</span>
        </li>
      </ul>
      <RunNotice run={run} what="Explaining this form" />
      {guide ? <Guide guide={guide} /> : <p className="text-rule">Get a plain-language explanation of this form, what to gather first, and what each blank asks for.</p>}
      <ActionButton
        action={explainDocumentAction.bind(null, doc.id)}
        label={guide ? "Explain it again" : "Explain this form"}
        pendingLabel="Explaining…"
        pendingStatus="Reading the form and writing an explanation… this can take a minute"
        variant={guide ? "secondary" : "ai"}
      />
    </section>
  );
}

// Numbers the explanation gives that the form doesn't contain
function NumberFlags({ flags }: { flags?: string[] }) {
  if (!flags?.length) return null;
  return (
    <ul className="flex flex-col gap-1 rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
      {flags.map((flag) => (
        <li key={flag}>{flag}</li>
      ))}
    </ul>
  );
}

function Guide({ guide }: { guide: DocumentGuide }) {
  return (
    <div className="flex flex-col gap-4">
      <NumberFlags flags={guide.flags} />
      <div className="flex flex-col gap-1">
        <p>{guide.purpose}</p>
        <AnchorNote anchor={guide.purposeAnchor} />
      </div>
      {guide.whoFilesIt ? (
        <div className="flex flex-col gap-1">
          <h3 className="font-bold">Who fills it in and where it goes</h3>
          <p className="text-rule">{guide.whoFilesIt}</p>
        </div>
      ) : null}
      {guide.gather.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="font-bold">What to have ready</h3>
          <ul className="flex flex-col gap-2">
            {guide.gather.map((entry, index) => (
              <li key={index} className="flex flex-col gap-0.5 border-l-2 border-line pl-3">
                <span>{entry.item}</span>
                <AnchorNote anchor={entry.anchor} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {guide.fieldHelp.length ? (
        <details className="group">
          <summary className="flex min-h-11 w-fit cursor-pointer items-center font-semibold text-accent-ink underline underline-offset-4">
            Help with each blank ({guide.fieldHelp.length})
          </summary>
          <ul className="mt-1 flex flex-col gap-2.5">
            {guide.fieldHelp.map((help) => (
              <li key={help.fieldId} className="flex flex-col gap-0.5 rounded-xl bg-ground px-3.5 py-3">
                <span className="font-semibold">{help.label}</span>
                <span className="text-rule">{help.explanation}</span>
                <AnchorNote anchor={help.anchor} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {guide.guidance.length ? (
        <div className="flex flex-col gap-2 rounded-xl bg-rule-tint px-4 py-3">
          <p className="font-semibold">From your startup plan: researched guidance, not printed on this form</p>
          <ul className="flex flex-col gap-2 text-sm">
            {guide.guidance.map((item, index) => (
              <li key={index} className="flex flex-col gap-0.5">
                <span className="text-rule">{item.text}</span>
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} w-fit`}>
                  {item.sourceTitle}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Ask({ doc, maxQuestion }: { doc: StoredDocument; maxQuestion: number }) {
  const fields = doc.content.fields.map((field) => ({ id: field.id, label: field.label, page: field.page }));
  return (
    <section aria-labelledby="ask-heading" className={`${CARD} flex flex-col gap-4`}>
      <h2 id="ask-heading" className={SECTION_TITLE}>
        Ask about this form
      </h2>
      <AskForm documentId={doc.id} fields={fields} maxQuestion={maxQuestion} />
      {doc.questions.length ? (
        <div className="flex flex-col gap-2.5">
          <h3 className="font-bold">Your questions</h3>
          <ul className="flex flex-col gap-2.5">
            {doc.questions.map((entry, index) => (
              <li key={`${entry.askedAt}-${index}`} className="flex flex-col gap-1.5 rounded-xl bg-ground px-3.5 py-3">
                <p className="font-semibold">{entry.question}</p>
                <p className="flex items-start gap-2.5">
                  <ActorChip actor="ai" />
                  <span className="whitespace-pre-wrap">{entry.answer}</span>
                </p>
                <AnchorNote anchor={entry.anchor} missing="The form doesn’t say this directly." />
                <NumberFlags flags={entry.flags} />
                {entry.guidance ? (
                  <p className="text-sm text-rule">
                    From your startup plan, not printed on this form:{" "}
                    <a href={entry.guidance.sourceUrl} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                      {entry.guidance.sourceTitle}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </p>
                ) : null}
                <p className="text-sm text-muted">
                  Asked <LocalDate iso={entry.askedAt} />
                  {entry.simulated ? " · Practice answer" : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function Answers({ doc, runs, editorFields, answersSignature, sourceLabels, detailOptions, draftBlocked }: FormViewProps) {
  return (
    <section aria-labelledby="answers-heading" className={`${CARD} flex flex-col gap-4`}>
      <h2 id="answers-heading" className={SECTION_TITLE}>
        Your answers
      </h2>
      <RunNotice run={runs.draft} what="Drafting answers" />
      {doc.content.fields.length ? (
        <AnswersEditor
          documentId={doc.id}
          fields={editorFields}
          signature={answersSignature}
          sourceLabels={sourceLabels}
          detailOptions={detailOptions}
          draftBlocked={draftBlocked}
          practice={Object.values(doc.answers).some((answer) => answer.simulated)}
        />
      ) : (
        <p className="text-rule">
          We didn’t find any blanks to fill in on this form. You can still ask questions about it above.
        </p>
      )}
    </section>
  );
}

function Prepared({ doc }: { doc: StoredDocument }) {
  const canFill = doc.mimeType === "application/pdf" && doc.hasFile && doc.content.fields.some((field) => field.fillable);
  return (
    <section aria-labelledby="prepared-heading" className={`${CARD} flex flex-col gap-4`}>
      <h2 id="prepared-heading" className={SECTION_TITLE}>
        Make a prepared copy
      </h2>
      <p className="text-rule">
        Prepared copies aren’t filed. You check them, sign them, and file them yourself.
        {canFill ? " The filled copy contains only the answers you’ve confirmed." : null}
      </p>
      <div className="flex flex-wrap items-start gap-3">
        {canFill ? (
          <ActionButton
            action={fillCopyAction.bind(null, doc.id)}
            label="Make a filled copy"
            pendingLabel="Making the copy…"
            variant="primary"
            openDocument
          />
        ) : null}
        <ActionButton
          action={answerSheetAction.bind(null, doc.id)}
          label="Make an answer sheet"
          pendingLabel="Making the sheet…"
          variant={canFill ? "secondary" : "primary"}
          openDocument
        />
      </div>
      <p className="text-sm text-muted">
        An answer sheet lists every blank with your answer and where it came from, to copy onto the form or an online
        application.
      </p>
    </section>
  );
}
