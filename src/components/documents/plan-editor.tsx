"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { saveBusinessPlanAction } from "@/app/(app)/documents/actions";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { ALERT, INPUT, PRIMARY, SECONDARY, SECONDARY_LINK } from "@/components/styles";
import type { PlanSection } from "@/lib/documents/types";
import { ESTIMATES_KEY } from "@/lib/rules/plan-money";
import { countPlaceholders, fileHref } from "./labels";
import { failedMessage } from "@/lib/failure";

interface Props {
  documentId: string;
  sections: PlanSection[];
  // The saved text's version, which each save is checked against
  version: string;
  // When the PDF in Documents was last saved, if it matches this text
  savedAt: string | null;
  hasFile: boolean;
}

type Edit = { heading: string; body: string };
type Mode = { index: number; kind: "section" } | { index: number; kind: "passage"; start: number; end: number } | null;
type Picked = { index: number; start: number; end: number; top: number; left: number };

const editsFrom = (sections: PlanSection[]): Edit[] => sections.map((section) => ({ heading: section.heading, body: section.body }));
const SMALL = "min-h-11 min-w-11 px-3 text-[15px]";

// A flag stays shown while the number it quotes is still in the text
function openFlags(flags: string[], body: string): string[] {
  return flags.filter((flag) => {
    const quoted = flag.match(/“([^”]+)”/)?.[1];
    return !quoted || body.includes(quoted);
  });
}

// Paragraphs split on blank lines, with where each starts in the section's text
export function paragraphsOf(body: string): { start: number; text: string }[] {
  const parts: { start: number; text: string }[] = [];
  const gap = /\n\s*\n/g;
  let last = 0;
  for (let match = gap.exec(body); match; match = gap.exec(body)) {
    if (match.index > last) parts.push({ start: last, text: body.slice(last, match.index) });
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push({ start: last, text: body.slice(last) });
  return parts;
}

// The selected stretch of one section's text, trimmed of space at either end
export function trimRange(body: string, start: number, end: number): { start: number; end: number } | null {
  let from = Math.max(0, start);
  let to = Math.min(body.length, end);
  while (from < to && /\s/.test(body[from])) from++;
  while (to > from && /\s/.test(body[to - 1])) to--;
  return to > from ? { start: from, end: to } : null;
}

export function PlanEditor({ documentId, sections, version, savedAt, hasFile }: Props) {
  const uid = useId();
  // The page remounts the editor for each new draft; within one, this copy is the latest text
  const [edits, setEdits] = useState(() => editsFrom(sections));
  const [mode, setMode] = useState<Mode>(null);
  const [draftText, setDraftText] = useState<Edit>({ heading: "", body: "" });
  const [picked, setPicked] = useState<Picked | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [pdf, setPdf] = useState<{ status: "idle" | "saving"; savedAt: string | null }>({ status: "idle", savedAt });
  const [error, setError] = useState<string | null>(null);
  const paper = useRef<HTMLDivElement>(null);
  const latest = useRef(edits);
  const base = useRef(version);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  useLayoutEffect(() => () => setError(null), []);

  // Watches for text selected inside one section
  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | undefined;
    function onSelection() {
      const container = paper.current;
      const selection = document.getSelection();
      clearTimeout(hide);
      const range = selection && !selection.isCollapsed && selection.rangeCount ? selection.getRangeAt(0) : null;
      const found = container && range ? pickedIn(container, range, latest.current) : null;
      // A short wait, so a tap on the button lands before it hides
      if (found) setPicked(found);
      else hide = setTimeout(() => setPicked(null), 250);
    }
    document.addEventListener("selectionchange", onSelection);
    return () => {
      clearTimeout(hide);
      document.removeEventListener("selectionchange", onSelection);
    };
  }, []);

  function save(pdfToo: boolean) {
    const run = chain.current.then(async () => {
      const snapshot = latest.current;
      return saveBusinessPlanAction({
        documentId,
        version: base.current,
        sections: sections.map((section, index) => ({ key: section.key, heading: snapshot[index].heading, body: snapshot[index].body })),
        pdf: pdfToo,
      });
    });
    chain.current = run.catch(() => undefined);
    return run.then((result) => {
      if (result.ok) base.current = result.value.version;
      return result;
    });
  }

  async function persist(next: Edit[]) {
    setMode(null);
    if (next.every((edit, index) => edit.heading === latest.current[index].heading && edit.body === latest.current[index].body)) return;
    latest.current = next;
    setEdits(next);
    setPdf((current) => ({ ...current, savedAt: null }));
    setSaving("saving");
    setError(null);
    try {
      const result = await save(false);
      if (!result.ok) {
        setError(result.message);
        setSaving("idle");
      } else setSaving("saved");
    } catch {
      setError("Your last change wasn’t saved. Check your connection and try again.");
      setSaving("idle");
    }
  }

  function change(index: number, patch: Partial<Edit>) {
    persist(latest.current.map((edit, at) => (at === index ? { ...edit, ...patch } : edit)));
  }

  function openPassage(choice: Picked) {
    const body = latest.current[choice.index].body;
    setMode({ index: choice.index, kind: "passage", start: choice.start, end: choice.end });
    setDraftText({ heading: "", body: body.slice(choice.start, choice.end) });
    setPicked(null);
    document.getSelection()?.removeAllRanges();
  }

  // Nothing changes while the PDF is being made, so it matches the text on screen
  const busy = pdf.status === "saving";
  const placeholders = edits.reduce((total, edit) => total + countPlaceholders(`${edit.heading}\n${edit.body}`), 0);
  const flagCount = sections.reduce((total, section, index) => total + openFlags(section.flags, edits[index]?.body ?? "").length, 0);

  async function savePdf() {
    if (placeholders || flagCount) {
      const left = [
        placeholders ? `${placeholders} ${placeholders === 1 ? "note" : "notes"} in [brackets] to fill in` : "",
        flagCount ? `${flagCount} ${flagCount === 1 ? "number" : "numbers"} to check` : "",
      ]
        .filter(Boolean)
        .join(" and ");
      if (!window.confirm(`Your plan still has ${left}. Save it as a PDF anyway?`)) return;
    }
    setPdf((current) => ({ ...current, status: "saving" }));
    setError(null);
    try {
      const result = await save(true);
      if (!result.ok) {
        setError(result.message);
        setPdf((current) => ({ ...current, status: "idle" }));
      } else setPdf({ status: "idle", savedAt: result.value.savedAt });
    } catch {
      setError(failedMessage());
      setPdf((current) => ({ ...current, status: "idle" }));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-soft px-4 py-3 text-[15px] text-rule">
        <p className="flex items-start gap-2">
          <Icon name="pencil" size="sm" className="mt-[3px] text-accent" />
          <span>
            <b className="font-semibold text-ink">Select any words</b> to change them, or use <b className="font-semibold text-ink">Edit section</b> to rewrite a
            whole section. Changes save as you go.
          </span>
        </p>
        <p className={`pl-6 ${placeholders || flagCount ? "font-semibold text-check" : "text-muted"}`}>
          {placeholders
            ? `${placeholders} ${placeholders === 1 ? "note" : "notes"} in [brackets] to replace with your own details.`
            : "No notes in [brackets] left to fill in."}
          {flagCount ? ` ${flagCount} ${flagCount === 1 ? "number needs" : "numbers need"} checking.` : null}
        </p>
      </div>

      <div ref={paper} className="relative sm:rounded-xl sm:border sm:border-line sm:bg-surface sm:px-8 sm:py-7 sm:shadow-soft">
        <div className="flex flex-col gap-7">
          {edits.map((edit, index) => {
            const section = sections[index];
            const flags = openFlags(section?.flags ?? [], edit.body);
            const headingId = `${uid}-h-${index}`;
            const editingSection = mode?.index === index && mode.kind === "section";
            const passage = mode?.index === index && mode.kind === "passage" ? mode : null;
            // Worked out in code from the money estimates, so not edited as text
            const locked = section?.key === ESTIMATES_KEY;
            return (
              <section key={section?.key ?? index} aria-labelledby={headingId} className="flex flex-col gap-3">
                {editingSection ? (
                  <SectionForm
                    initial={edit}
                    number={index + 1}
                    onDone={(next) => change(index, next)}
                    onCancel={() => setMode(null)}
                    headingId={headingId}
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b border-line pb-2">
                      <h3 id={headingId} className="min-w-0 flex-1 font-display text-[21px] leading-snug sm:text-[23px]">
                        <span className="text-faint">{index + 1}.</span> {edit.heading}
                      </h3>
                      {locked ? (
                        <span className="text-[14px] text-muted">Change it under Money estimates</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMode({ index, kind: "section" })}
                          className={`${SECONDARY} ${SMALL} -mt-0.5`}
                          aria-label={`Edit section ${index + 1}: ${edit.heading}`}
                          disabled={Boolean(mode) || busy}
                        >
                          <Icon name="pencil" size="sm" className="text-muted" />
                          <span className="hidden sm:inline">Edit section</span>
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-3 text-[16.5px] leading-[1.7] text-ink">
                      {paragraphsOf(edit.body).map((part) => (
                        <p key={part.start} data-para={locked ? undefined : ""} data-section={index} data-start={part.start} className="whitespace-pre-line break-words">
                          {passage ? highlighted(part, passage.start, passage.end) : withNotes(part.text)}
                        </p>
                      ))}
                    </div>
                    {passage ? (
                      <PassageForm
                        text={draftText.body}
                        onText={(body) => setDraftText({ heading: "", body })}
                        onReplace={() => {
                          const body = latest.current[index].body;
                          change(index, { body: body.slice(0, passage.start) + draftText.body.trim() + body.slice(passage.end) });
                        }}
                        onCancel={() => setMode(null)}
                      />
                    ) : null}
                  </>
                )}
                {flags.length ? (
                  <ul className="flex flex-col gap-1">
                    {flags.map((flag) => (
                      <li key={flag} className="flex items-start gap-2 rounded-lg border border-check-ring bg-check-tint px-3 py-2 text-[14.5px] text-check">
                        <Icon name="alert" size="sm" className="mt-0.5" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>

        {picked && !mode && !busy ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => openPassage(picked)}
            style={{ top: picked.top, left: picked.left }}
            className="absolute z-10 inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-accent bg-accent px-3.5 text-[15px] font-bold text-white shadow-lift transition hover:bg-accent-ink"
          >
            <Icon name="pencil" size="sm" />
            Edit selected text
          </button>
        ) : null}
      </div>

      <p role="status" className="text-[14.5px] text-muted">
        {saving === "saving" ? "Saving your changes…" : saving === "saved" ? "All changes saved." : ""}
      </p>

      <SaveArea documentId={documentId} pdf={pdf} hasFile={hasFile} editing={Boolean(mode)} onSave={savePdf} />

      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Where the selection sits in the plan's text, and where to show the button; null unless it's inside one section
function pickedIn(container: HTMLElement, range: Range, edits: Edit[]): Picked | null {
  if (!container.contains(range.commonAncestorContainer)) return null;
  const paras = [...container.querySelectorAll<HTMLElement>("[data-para]")].filter((para) => range.intersectsNode(para));
  if (!paras.length) return null;
  const index = Number(paras[0].dataset.section);
  if (paras.some((para) => Number(para.dataset.section) !== index) || !edits[index]) return null;
  const first = paras[0];
  const last = paras[paras.length - 1];
  const offset = (para: HTMLElement, node: Node, at: number) => {
    const before = document.createRange();
    before.setStart(para, 0);
    before.setEnd(node, at);
    return Number(para.dataset.start) + before.toString().length;
  };
  const start = first.contains(range.startContainer) ? offset(first, range.startContainer, range.startOffset) : Number(first.dataset.start);
  const end = last.contains(range.endContainer) ? offset(last, range.endContainer, range.endOffset) : Number(last.dataset.start) + (last.textContent ?? "").length;
  const trimmed = trimRange(edits[index].body, start, end);
  if (!trimmed) return null;
  const box = container.getBoundingClientRect();
  const rect = range.getBoundingClientRect();
  const width = 190;
  return {
    index,
    ...trimmed,
    top: rect.bottom - box.top + 8,
    left: Math.max(8, Math.min(rect.left - box.left, box.width - width - 8)),
  };
}

// Notes in [brackets] stand out for the owner to replace
function withNotes(text: string): ReactNode {
  return text.split(/(\[[^\[\]\n]{2,200}\])/).map((part, index) =>
    index % 2 ? (
      <mark key={index} className="rounded bg-check-tint px-0.5 text-check">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function highlighted(part: { start: number; text: string }, start: number, end: number): ReactNode {
  const from = Math.max(start, part.start) - part.start;
  const to = Math.min(end, part.start + part.text.length) - part.start;
  if (from >= to) return part.text;
  return (
    <>
      {part.text.slice(0, from)}
      <mark className="rounded bg-ai-tint px-0.5 text-ink outline-2 outline-ai/30">{part.text.slice(from, to)}</mark>
      {part.text.slice(to)}
    </>
  );
}

function PassageForm({ text, onText, onReplace, onCancel }: { text: string; onText: (text: string) => void; onReplace: () => void; onCancel: () => void }) {
  const uid = useId();
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-ai/25 bg-ai-tint/50 p-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        onReplace();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <label htmlFor={`${uid}-text`} className="text-[15px] font-semibold">
        Change the highlighted words
      </label>
      <textarea
        id={`${uid}-text`}
        autoFocus
        rows={Math.min(8, Math.max(2, Math.ceil(text.length / 70)))}
        maxLength={8000}
        value={text}
        onChange={(event) => onText(event.target.value)}
        className={`${INPUT} resize-y`}
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={`${PRIMARY} min-h-11!`}>
          <Icon name="check" size="sm" />
          Replace
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function SectionForm({ initial, number, headingId, onDone, onCancel }: { initial: Edit; number: number; headingId: string; onDone: (edit: Edit) => void; onCancel: () => void }) {
  const uid = useId();
  const [edit, setEdit] = useState(initial);
  return (
    <form
      className="flex flex-col gap-2.5 rounded-xl border border-accent-ring bg-accent-tint/40 p-3.5"
      aria-labelledby={headingId}
      onSubmit={(event) => {
        event.preventDefault();
        onDone({ heading: edit.heading.trim() || initial.heading, body: edit.body.trim() });
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <h3 id={headingId} className="text-[15px] font-bold">
        Editing section {number}
      </h3>
      <label htmlFor={`${uid}-heading`} className="text-[14.5px] font-semibold text-muted">
        Heading
      </label>
      <input
        id={`${uid}-heading`}
        type="text"
        maxLength={120}
        value={edit.heading}
        onChange={(event) => setEdit({ ...edit, heading: event.target.value })}
        className={`${INPUT} font-display text-[19px]!`}
      />
      <label htmlFor={`${uid}-body`} className="text-[14.5px] font-semibold text-muted">
        Text <span className="font-normal">(leave a blank line between paragraphs)</span>
      </label>
      <textarea
        id={`${uid}-body`}
        autoFocus
        rows={Math.min(16, Math.max(5, Math.ceil(initial.body.length / 70)))}
        maxLength={8000}
        value={edit.body}
        onChange={(event) => setEdit({ ...edit, body: event.target.value })}
        className={`${INPUT} resize-y leading-relaxed`}
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={`${PRIMARY} min-h-11!`}>
          <Icon name="check" size="sm" />
          Done
        </button>
        <button type="button" onClick={onCancel} className={SECONDARY}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function SaveArea({
  documentId,
  pdf,
  hasFile,
  editing,
  onSave,
}: {
  documentId: string;
  pdf: { status: "idle" | "saving"; savedAt: string | null };
  hasFile: boolean;
  editing: boolean;
  onSave: () => void;
}) {
  const current = Boolean(pdf.savedAt);
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      {current ? (
        <div className="flex flex-col gap-3 rounded-xl border border-accent-ring bg-accent-tint px-4 py-3.5 text-accent-ink">
          <p className="flex items-start gap-2 font-semibold">
            <Icon name="check" size="sm" className="mt-1" />
            <span>
              Saved to Documents on <LocalDate iso={pdf.savedAt!} />. The PDF matches the plan above.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/documents/${encodeURIComponent(documentId)}`} className={SECONDARY_LINK}>
              <Icon name="book" size="sm" className="text-muted" />
              See it in Documents
            </Link>
            <a href={fileHref(documentId, true)} target="_blank" rel="noopener noreferrer" className={SECONDARY_LINK}>
              <Icon name="eye" size="sm" className="text-muted" />
              Open the PDF
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      ) : hasFile ? (
        <p className="flex items-start gap-2 rounded-xl border border-check-ring bg-check-tint px-4 py-3 text-[15px] font-semibold text-check">
          <Icon name="info" size="sm" className="mt-1" />
          <span>You’ve changed the plan since its PDF was saved. Save it again to update the copy in Documents.</span>
        </p>
      ) : (
        <p className="text-[15px] text-muted">When it reads the way you want, save it. The PDF goes in Documents, replacing any earlier copy.</p>
      )}
      <button type="button" data-writes onClick={onSave} disabled={pdf.status === "saving" || editing} className={`${PRIMARY} w-fit`}>
        <Icon name="filecheck" size="sm" />
        {pdf.status === "saving" ? "Saving your business plan…" : "Save my business plan"}
      </button>
      {editing ? <p className="text-[14.5px] text-muted">Finish or cancel the change you’re making above first.</p> : null}
    </div>
  );
}
