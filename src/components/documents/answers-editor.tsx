"use client";

import { type ReactNode, useId, useLayoutEffect, useState } from "react";
import { draftAnswersAction, saveAnswersAction } from "@/app/(app)/documents/actions";
import { refreshDraftAction } from "@/app/(app)/documents/form-actions";
import { ActorChip } from "@/components/actor-chip";
import { AI_BUTTON, ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import type { FieldKind } from "@/lib/documents/types";

export interface EditorField {
  id: string;
  label: string;
  page: number;
  kind: FieldKind;
  options: string[];
  printedText: string;
  lowConfidence: boolean;
  fillYourself: boolean;
  // Why it's left for the owner
  note: string;
  // As saved
  value: string;
  source: string;
  confirmed: boolean;
}

interface Props {
  // Drafted in practice mode by word matching
  practice?: boolean;
  // A checked official form: its blanks are filled by fixed rules, not the AI
  rules?: boolean;
  documentId: string;
  fields: EditorField[];
  // Changes whenever the saved answers do
  signature: string;
  sourceLabels: Record<string, string>;
  detailOptions: { key: string; label: string }[];
  // Why drafting isn't possible yet, if it isn't
  draftBlocked: string | null;
}

interface Row {
  value: string;
  confirmed: boolean;
  saveAs: string;
}

function rowsFrom(fields: EditorField[]): Record<string, Row> {
  return Object.fromEntries(fields.map((field) => [field.id, { value: field.value, confirmed: field.confirmed, saveAs: "" }]));
}

const LONG_LABEL = /address|describe|description|purpose|explain|activities|nature of/i;

export function AnswersEditor({ documentId, fields, signature, sourceLabels, detailOptions, draftBlocked, practice, rules }: Props) {
  const uid = useId();
  const [rows, setRows] = useState(() => rowsFrom(fields));
  const [seen, setSeen] = useState(signature);
  const [status, setStatus] = useState<"idle" | "drafting" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  // New saved answers from the server replace the form's contents
  if (seen !== signature) {
    setSeen(signature);
    setRows(rowsFrom(fields));
  }

  const rowOf = (field: EditorField): Row => rows[field.id] ?? { value: field.value, confirmed: field.confirmed, saveAs: "" };
  const editable = fields.filter((field) => !field.fillYourself);
  const dirty = editable.some((field) => {
    const row = rowOf(field);
    return row.value !== field.value || row.confirmed !== field.confirmed || row.saveAs !== "";
  });
  const answered = editable.filter((field) => rowOf(field).value.trim()).length;
  const confirmed = editable.filter((field) => rowOf(field).value.trim() && rowOf(field).confirmed).length;
  const drafted = fields.some((field) => field.source || field.fillYourself);
  const pending = status === "drafting" || status === "saving";

  function update(field: EditorField, patch: Partial<Row>) {
    setRows((current) => ({ ...current, [field.id]: { ...rowOf(field), ...current[field.id], ...patch } }));
    if (status === "saved") setStatus("idle");
  }

  function typed(field: EditorField): boolean {
    const value = rowOf(field).value.trim();
    return Boolean(value) && !(value === field.value && field.source && field.source !== "owner");
  }

  async function draft() {
    if (dirty && !window.confirm("Drafting replaces changes you haven’t saved. Answers you saved or confirmed stay. Continue?")) return;
    await run("drafting", () => (rules ? refreshDraftAction(documentId) : draftAnswersAction(documentId)));
  }

  async function save() {
    const answers = Object.fromEntries(
      editable.map((field) => [field.id, { value: rowOf(field).value, confirmed: rowOf(field).confirmed && Boolean(rowOf(field).value.trim()) }]),
    );
    const saveDetails = editable.flatMap((field) => (typed(field) && rowOf(field).saveAs ? [{ fieldId: field.id, key: rowOf(field).saveAs }] : []));
    await run("saving", () => saveAnswersAction({ documentId, answers, saveDetails }));
  }

  async function run(next: "drafting" | "saving", action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setStatus(next);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        setStatus("idle");
      } else setStatus(next === "saving" ? "saved" : "idle");
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2 text-sm text-rule">
        <li className="flex items-start gap-2.5">
          {practice || rules ? <ActorChip actor="rule" /> : <ActorChip actor="ai" />}
          <span>
            {rules
              ? "First Sale’s checked rules for this form filled blanks from your business details. Nothing is guessed, and blanks your details don’t answer stay empty."
              : practice
                ? "Practice mode matched blanks to your business details with simple word matching, not AI. Check every one closely."
                : "AI matched blanks to your business details. It never makes up an answer."}
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <ActorChip actor="owner" />
          <span>You check and confirm each one. Only confirmed answers go into a filled copy.</span>
        </li>
      </ul>

      {draftBlocked ? (
        <p className="text-sm text-muted">{draftBlocked}</p>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <button type="button" onClick={draft} disabled={pending} className={rules ? SECONDARY : AI_BUTTON}>
            {status === "drafting"
              ? "Drafting answers…"
              : rules
                ? "Fill in again from my details"
                : drafted
                  ? "Draft answers again"
                  : "Draft answers from my business details"}
          </button>
        </div>
      )}

      <p className="text-sm text-muted">
        {answered} of {editable.length} {editable.length === 1 ? "blank" : "blanks"} answered, {confirmed} confirmed. Leave
        Social Security and tax id numbers for the form itself: First Sale doesn’t store them.
      </p>

      <ol className="flex flex-col gap-3">
        {fields.map((field) => (
          <FieldRow
            key={field.id}
            uid={uid}
            field={field}
            row={rowOf(field)}
            typed={typed(field)}
            sourceLabel={sourceLabels[field.source] ?? null}
            detailOptions={detailOptions}
            onChange={(patch) => update(field, patch)}
          />
        ))}
      </ol>

      <div className="flex flex-col items-start gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              for (const field of editable) if (rowOf(field).value.trim()) update(field, { confirmed: true });
            }}
            className={SECONDARY}
          >
            Confirm all filled answers
          </button>
          <button type="button" onClick={save} disabled={pending} className={PRIMARY}>
            {status === "saving" ? "Saving…" : "Save answers"}
          </button>
        </div>
        {dirty && status !== "saving" ? <p className="text-sm text-check">You have changes that aren’t saved yet.</p> : null}
        <p role="status" className={status === "idle" ? "sr-only" : "text-sm text-muted"}>
          {status === "drafting"
            ? "Matching the form’s blanks to your business details. This can take a minute."
            : status === "saving"
              ? "Saving your answers…"
              : status === "saved"
                ? "Your answers are saved."
                : ""}
        </p>
        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface RowProps {
  uid: string;
  field: EditorField;
  row: Row;
  typed: boolean;
  sourceLabel: string | null;
  detailOptions: { key: string; label: string }[];
  onChange: (patch: Partial<Row>) => void;
}

function FieldRow({ uid, field, row, typed, sourceLabel, detailOptions, onChange }: RowProps) {
  const inputId = `${uid}-${field.id}`;
  const empty = !row.value.trim();

  return (
    <li className="flex flex-col gap-2 rounded-xl bg-ground px-3.5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {field.fillYourself ? (
          <p className="font-semibold">{field.label}</p>
        ) : (
          <label htmlFor={inputId} className="font-semibold">
            {field.label}
          </label>
        )}
        <span className="text-sm text-muted">Page {field.page}</span>
      </div>
      {field.printedText && field.printedText !== field.label ? (
        <p className="text-sm text-muted">On the form: “{field.printedText}”</p>
      ) : null}
      {field.lowConfidence ? (
        <p className="rounded-lg bg-check-tint px-3 py-2 text-sm text-check">We may have misread this blank. Check it against the form.</p>
      ) : null}

      {field.fillYourself ? (
        <SourceChip tone="rule">Fill in yourself: {field.note}</SourceChip>
      ) : (
        <>
          {empty ? (
            <SourceChip tone="check">Not answered yet: add it</SourceChip>
          ) : typed ? (
            <SourceChip tone="owner">You typed this</SourceChip>
          ) : (
            <SourceChip tone="ai">From your business details: {sourceLabel ?? "a saved detail"}</SourceChip>
          )}
          <ValueInput id={inputId} field={field} value={row.value} onChange={(value) => onChange({ value })} />
          <label className="flex min-h-11 w-fit items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-accent"
              checked={row.confirmed && !empty}
              disabled={empty}
              onChange={(event) => onChange({ confirmed: event.target.checked })}
            />
            <span>
              Confirm<span className="sr-only"> {field.label}</span>
            </span>
          </label>
          {typed && detailOptions.length ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${inputId}-save`} className="text-sm font-semibold">
                Also save to my business details as… <span className="font-normal text-muted">(optional)</span>
              </label>
              <select id={`${inputId}-save`} value={row.saveAs} onChange={(event) => onChange({ saveAs: event.target.value })} className={INPUT}>
                <option value="">Don’t save it</option>
                {detailOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted">Saved details can be used on your other forms. You can change them later.</p>
            </div>
          ) : null}
        </>
      )}
    </li>
  );
}

function ValueInput({ id, field, value, onChange }: { id: string; field: EditorField; value: string; onChange: (value: string) => void }) {
  if (field.kind === "checkbox") {
    const known = ["", "Yes", "No"].includes(value);
    return (
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={INPUT}>
        <option value="">Not answered</option>
        <option value="Yes">Yes, tick the box</option>
        <option value="No">No, leave it unticked</option>
        {known ? null : <option value={value}>{value}</option>}
      </select>
    );
  }
  if (field.kind === "choice" && field.options.length) {
    return (
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={INPUT}>
        <option value="">Not answered</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        {value && !field.options.includes(value) ? <option value={value}>{value}</option> : null}
      </select>
    );
  }
  // Decided from the saved answer, so typing doesn't swap the box under the cursor
  const long = field.value.length > 60 || field.value.includes("\n") || LONG_LABEL.test(`${field.label} ${field.printedText}`);
  return long ? (
    <textarea id={id} rows={3} maxLength={1000} value={value} onChange={(event) => onChange(event.target.value)} className={INPUT} />
  ) : (
    <input id={id} type="text" maxLength={1000} value={value} onChange={(event) => onChange(event.target.value)} className={INPUT} />
  );
}

const TONES = {
  ai: "bg-ai-tint text-ai-ink",
  owner: "bg-accent-tint text-accent-ink",
  check: "bg-check-tint text-check",
  rule: "bg-rule-tint text-rule",
};

function SourceChip({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <p className={`w-fit rounded-lg px-2.5 py-1 text-sm font-semibold ${TONES[tone]}`}>{children}</p>;
}
