import Link from "next/link";
import {
  answerSheetAction,
  deleteDocumentAction,
  explainDocumentAction,
  fillCopyAction,
  readAgainAction,
} from "@/app/(app)/documents/actions";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, Note } from "@/components/ui";
import type { StoredDocument } from "@/lib/data/documents";
import { CUT_OFF_MESSAGE, type RunState } from "@/lib/data/workflow-runs";
import { officialForm } from "@/data/official-forms";
import type { DocumentGuide } from "@/lib/documents/types";
import { AnchorNote } from "./anchor-note";
import { AnswersEditor, type EditorField } from "./answers-editor";
import { AskForm } from "./ask-form";
import { DocumentHead } from "./document-head";
import { fileHref, isReadable, originSentence, READ_METHOD_LABELS } from "./labels";
import { docIcon, ReadText, SubFold } from "./parts";
import { RunNotice } from "./run-notice";
import { StepLink } from "./step-link";

export interface FormViewProps {
  doc: StoredDocument;
  // Checks, outdated answers and versions, shown under the title
  status?: React.ReactNode;
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
      <DocumentHead documentId={doc.id} title={doc.title}>
        <p>
          {originSentence(doc.origin, doc.role)} on <LocalDate iso={doc.createdAt.toISOString()} />.
          {doc.origin === "official_form" && doc.sourceUrl ? (
            <>
              {" "}
              <a href={doc.sourceUrl} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                {doc.role === "answer_guide" ? "Open the official application" : "See it on the official website"}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          ) : null}
        </p>
      </DocumentHead>

      <Card title="This document" icon={docIcon(doc)} tone="gray" id="document-heading">
        {steps.length ? <StepLink key={doc.taskId ?? ""} documentId={doc.id} stepId={doc.taskId} steps={steps} /> : null}
        <div className={`flex flex-wrap items-start justify-between gap-2 ${steps.length ? "border-t border-line pt-4" : ""}`}>
          {doc.hasFile ? (
            <a href={fileHref(doc.id)} className={SECONDARY_LINK}>
              <Icon name="download" size="sm" className="text-muted" />
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
      </Card>

      {simulated ? <PracticeBanner what="This form was read and explained in practice mode." /> : null}
      {props.status}

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
    <Card title="Reading the form" icon="search" id="reading-heading">
      <RunNotice run={runs.read} what="Reading this form" />

      {stillReading && !readable ? null : readable ? (
        <>
          <p className="text-rule">
            {READ_METHOD_LABELS[content.readMethod]}. We found {content.fields.length} {content.fields.length === 1 ? "blank" : "blanks"} to fill in on{" "}
            {content.pages.length} {content.pages.length === 1 ? "page" : "pages"}.
          </p>
          {lowCount ? (
            <Note>
              {lowCount === 1 ? "One blank" : `${lowCount} blanks`} may have been misread. {lowCount === 1 ? "It’s" : "They’re"} marked in your answers below. Check{" "}
              {lowCount === 1 ? "it" : "them"} against the form.
            </Note>
          ) : null}
          {content.unclear.length ? (
            <Note>
              <p className="font-semibold">We couldn’t read this part clearly</p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-[14.5px]">
                {content.unclear.map((part, index) => (
                  <li key={index}>
                    Page {part.page}, {part.where}: {part.why}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[14.5px]">Check the original, and type what it says when you fill in your answers.</p>
            </Note>
          ) : null}
          <ReadText pages={content.pages} />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <Note>
            <p className="font-semibold">We couldn’t read this form yet</p>
            {content.unclear.length || readFailure ? (
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-[14.5px]">
                {content.unclear.map((part, index) => (
                  <li key={index}>{part.why}</li>
                ))}
                {readFailure ? <li>{readFailure}</li> : null}
              </ul>
            ) : null}
          </Note>
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
    </Card>
  );
}

function Explain({ doc, run }: { doc: StoredDocument; run: RunState | null }) {
  const guide = doc.guide;
  return (
    <Card title="What this form is for" icon="lightbulb" id="explain-heading">
      <RunNotice run={run} what="Explaining this form" />
      {guide ? <Guide guide={guide} /> : <p className="text-rule">Get a plain-language explanation of this form, what to gather first, and what each blank asks for.</p>}
      <ActionButton
        action={explainDocumentAction.bind(null, doc.id)}
        label={guide ? "Explain it again" : "Explain this form"}
        pendingLabel="Explaining…"
        pendingStatus="Reading the form and writing an explanation… this can take a minute"
        variant={guide ? "secondary" : "ai"}
        ai
      />
    </Card>
  );
}

// Numbers the explanation gives that the form doesn't contain
function NumberFlags({ flags }: { flags?: string[] }) {
  if (!flags?.length) return null;
  return (
    <Note>
      <ul className="flex flex-col gap-1">
        {flags.map((flag) => (
          <li key={flag}>{flag}</li>
        ))}
      </ul>
    </Note>
  );
}

function Guide({ guide }: { guide: DocumentGuide }) {
  return (
    <div className="flex flex-col gap-5 border-t border-line pt-4">
      <NumberFlags flags={guide.flags} />
      <div className="flex flex-col gap-1">
        <p className="text-[17px]">{guide.purpose}</p>
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
          <ul className="flex flex-col gap-2.5">
            {guide.gather.map((entry, index) => (
              <li key={index} className="flex flex-col gap-0.5 border-l-[3px] border-accent-ring pl-3.5">
                <span>{entry.item}</span>
                <AnchorNote anchor={entry.anchor} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {guide.fieldHelp.length ? (
        <SubFold summary={`Help with each blank (${guide.fieldHelp.length})`}>
          <ul className="flex flex-col divide-y divide-line">
            {guide.fieldHelp.map((help) => (
              <li key={help.fieldId} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
                <span className="font-semibold">{help.label}</span>
                <span className="text-rule">{help.explanation}</span>
                <AnchorNote anchor={help.anchor} />
              </li>
            ))}
          </ul>
        </SubFold>
      ) : null}
      {guide.guidance.length ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-soft px-4 py-3">
          <p className="font-semibold">From your check of what applies to you: guidance, not printed on this form</p>
          <ul className="flex flex-col gap-2 text-[15px]">
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
    <Card title="Ask about this form" icon="question" id="ask-heading">
      <AskForm documentId={doc.id} fields={fields} maxQuestion={maxQuestion} />
      {doc.questions.length ? (
        <div className="flex flex-col gap-2.5 border-t border-line pt-4">
          <h3 className="font-bold">Your questions</h3>
          <ul className="flex flex-col gap-2.5">
            {doc.questions.map((entry, index) => (
              <li key={`${entry.askedAt}-${index}`} className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-soft">
                <p className="font-semibold">{entry.question}</p>
                <p className="flex items-start gap-2.5">
                  <span className="min-w-0 whitespace-pre-wrap">{entry.answer}</span>
                </p>
                <AnchorNote anchor={entry.anchor} missing="The form doesn’t say this directly." />
                <NumberFlags flags={entry.flags} />
                {entry.guidance ? (
                  <p className="text-[14.5px] text-rule">
                    From your check of what applies to you, not printed on this form:{" "}
                    <a href={entry.guidance.sourceUrl} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                      {entry.guidance.sourceTitle}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </p>
                ) : null}
                <p className="text-[14.5px] text-muted">
                  Asked <LocalDate iso={entry.askedAt} />
                  {entry.simulated ? " · Practice answer" : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function Answers({ doc, runs, editorFields, answersSignature, sourceLabels, detailOptions, draftBlocked }: FormViewProps) {
  return (
    <Card title="Your answers" icon="pencil" id="answers-heading">
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
          rules={Boolean(doc.formKey && (doc.role === "answer_guide" || (doc.verification?.ok && rulesFor(doc.formKey))))}
        />
      ) : (
        <p className="text-rule">
          We didn’t find any blanks to fill in on this form. You can still ask questions about it above.
        </p>
      )}
    </Card>
  );
}

function Prepared({ doc }: { doc: StoredDocument }) {
  const canFill = doc.mimeType === "application/pdf" && doc.hasFile && doc.content.fields.some((field) => field.fillable);
  return (
    <Card title="Save your reviewed version" icon="filecheck" id="prepared-heading">
      <p className="text-rule">
        It’s saved as a new version next to this one, which stays as it is. Reviewed copies aren’t filed: you check them, sign them, and file them yourself.
        {canFill ? " The filled copy contains only the answers you’ve confirmed." : null}
      </p>
      <div className="flex flex-wrap items-start gap-2">
        {canFill ? (
          <ActionButton
            action={fillCopyAction.bind(null, doc.id)}
            label="Save a filled copy"
            pendingLabel="Making the copy…"
            variant="primary"
            openDocument
          />
        ) : null}
        <ActionButton
          action={answerSheetAction.bind(null, doc.id)}
          label={doc.role === "answer_guide" ? "Save my answers as a guide" : "Save an answer sheet"}
          pendingLabel="Making the sheet…"
          variant={canFill ? "secondary" : "primary"}
          openDocument
        />
      </div>
      <p className="text-[14.5px] text-muted">
        An answer sheet lists every blank with your answer and where it came from, to copy onto the form or an online application.
      </p>
    </Card>
  );
}

// Forms whose blanks the catalog maps by hand; others are drafted by matching
function rulesFor(formKey: string): boolean {
  return (officialForm(formKey)?.fields.length ?? 0) > 0;
}
