"use client";

import { useId, useLayoutEffect, useState } from "react";
import { saveBusinessPlanAction } from "@/app/(app)/documents/actions";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { ALERT, INPUT, PRIMARY, SECONDARY, SECONDARY_LINK } from "@/components/styles";
import type { PlanSection } from "@/lib/documents/types";
import { countPlaceholders, fileHref } from "./labels";

interface Props {
  documentId: string;
  sections: PlanSection[];
  // Changes whenever the saved plan does
  signature: string;
  approvedAt: string | null;
  hasFile: boolean;
}

type Edit = { heading: string; body: string };

function editsFrom(sections: PlanSection[]): Edit[] {
  return sections.map((section) => ({ heading: section.heading, body: section.body }));
}

// A flag stays shown while the number it quotes is still in the text
function openFlags(flags: string[], body: string): string[] {
  return flags.filter((flag) => {
    const quoted = flag.match(/“([^”]+)”/)?.[1];
    return !quoted || body.includes(quoted);
  });
}

export function PlanEditor({ documentId, sections, signature, approvedAt, hasFile }: Props) {
  const uid = useId();
  const [edits, setEdits] = useState(() => editsFrom(sections));
  const [seen, setSeen] = useState(signature);
  const [status, setStatus] = useState<"idle" | "saving" | "approving" | "saved" | "approved">("idle");
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  // A new draft or saved version from the server replaces the editor's contents
  if (seen !== signature) {
    setSeen(signature);
    setEdits(editsFrom(sections));
  }

  const dirty = edits.some((edit, index) => edit.heading !== sections[index]?.heading || edit.body !== sections[index]?.body);
  const placeholders = edits.reduce((total, edit) => total + countPlaceholders(`${edit.heading}\n${edit.body}`), 0);
  const flagCount = sections.reduce((total, section, index) => total + openFlags(section.flags, edits[index]?.body ?? "").length, 0);
  const pending = status === "saving" || status === "approving";
  const outOfDate = hasFile && (!approvedAt || dirty);

  function change(index: number, patch: Partial<Edit>) {
    setEdits((current) => current.map((edit, at) => (at === index ? { ...edit, ...patch } : edit)));
    if (status === "saved" || status === "approved") setStatus("idle");
  }

  async function save(approve: boolean) {
    if (approve && (placeholders || flagCount)) {
      const left = [
        placeholders ? `${placeholders} [bracketed] ${placeholders === 1 ? "note" : "notes"} to fill in` : "",
        flagCount ? `${flagCount} ${flagCount === 1 ? "number" : "numbers"} to check` : "",
      ]
        .filter(Boolean)
        .join(" and ");
      if (!window.confirm(`Your plan still has ${left}. Approve it anyway?`)) return;
    }
    setStatus(approve ? "approving" : "saving");
    setError(null);
    try {
      const result = await saveBusinessPlanAction({
        documentId,
        sections: sections.map((section, index) => ({ key: section.key, heading: edits[index].heading, body: edits[index].body })),
        approve,
      });
      if (!result.ok) {
        setError(result.message);
        setStatus("idle");
      } else setStatus(approve ? "approved" : "saved");
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {approvedAt && !dirty ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-accent-ring bg-accent-tint px-4 py-3.5 text-accent-ink">
          <p className="flex items-start gap-2 font-semibold">
            <Icon name="check" size="sm" className="mt-1" />
            <span>
              You approved this plan on <LocalDate iso={approvedAt} />. The PDF in your documents matches it.
            </span>
          </p>
          <FileLinks documentId={documentId} label="PDF" />
        </div>
      ) : outOfDate ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-check-ring bg-check-tint px-4 py-3.5 text-check">
          <p className="flex items-start gap-2 font-semibold">
            <Icon name="info" size="sm" className="mt-1" />
            <span>Your changes aren’t in the PDF yet. Approve the plan again to update it.</span>
          </p>
          <FileLinks documentId={documentId} label="last approved PDF" />
        </div>
      ) : null}

      <p className={`text-[14.5px] ${placeholders || flagCount ? "font-semibold text-check" : "text-muted"}`}>
        {placeholders
          ? `${placeholders} [bracketed] ${placeholders === 1 ? "note" : "notes"} left to fill in. Replace each one with your own words, or delete it.`
          : "No [bracketed] notes left to fill in."}
        {flagCount ? ` ${flagCount} ${flagCount === 1 ? "number needs" : "numbers need"} checking.` : null}
      </p>

      <ol className="flex flex-col gap-3">
        {edits.map((edit, index) => {
          const flags = openFlags(sections[index]?.flags ?? [], edit.body);
          const headingId = `${uid}-heading-${index}`;
          const bodyId = `${uid}-body-${index}`;
          return (
            <li key={sections[index]?.key ?? index} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-soft sm:p-4">
              <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-full border border-accent-ring bg-accent-tint font-display text-accent">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <label htmlFor={headingId} className="text-[14.5px] font-semibold text-muted">
                  Section {index + 1} heading
                </label>
                <input
                  id={headingId}
                  type="text"
                  maxLength={120}
                  value={edit.heading}
                  onChange={(event) => change(index, { heading: event.target.value })}
                  className={`${INPUT.replace("text-base", "text-[19px]")} font-display`}
                />
                <label htmlFor={bodyId} className="mt-1 text-[14.5px] font-semibold text-muted">
                  {edit.heading || `Section ${index + 1}`}: text
                </label>
                <textarea
                  id={bodyId}
                  rows={Math.min(14, Math.max(4, Math.ceil((sections[index]?.body.length ?? 0) / 70)))}
                  maxLength={6000}
                  value={edit.body}
                  onChange={(event) => change(index, { body: event.target.value })}
                  className={`${INPUT} resize-y`}
                />
                {flags.length ? (
                  <ul className="flex flex-col gap-1">
                    {flags.map((flag) => (
                      <li key={flag} className="rounded-lg border border-check-ring bg-check-tint px-3 py-2 text-[14.5px] text-check">
                        {flag}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col items-start gap-2 border-t border-line pt-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => save(false)} disabled={pending} className={SECONDARY}>
            {status === "saving" ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={() => save(true)} disabled={pending} className={PRIMARY}>
            <Icon name="check" size="sm" />
            {status === "approving" ? "Approving…" : "Approve and save PDF"}
          </button>
        </div>
        {dirty && !pending ? <p className="text-[14.5px] font-semibold text-check">You have changes that aren’t saved yet.</p> : null}
        <p role="status" className={status === "idle" ? "sr-only" : "text-[14.5px] text-muted"}>
          {status === "saving"
            ? "Saving your changes…"
            : status === "approving"
              ? "Approving and making the PDF…"
              : status === "saved"
                ? "Your changes are saved."
                : status === "approved"
                  ? "Approved. The PDF is in your documents."
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

function FileLinks({ documentId, label }: { documentId: string; label: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={fileHref(documentId, true)} target="_blank" rel="noopener noreferrer" className={SECONDARY_LINK}>
        <Icon name="eye" size="sm" className="text-muted" />
        Open the {label}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <a href={fileHref(documentId)} className={SECONDARY_LINK}>
        <Icon name="download" size="sm" className="text-muted" />
        Download the {label}
      </a>
    </div>
  );
}
