"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { EYEBROW, PAGE_TITLE, TEXT_LINK } from "@/components/styles";
import { groupRows, type Marks, type StepId, type SummaryRow } from "@/lib/intake/answers";
import type { ProfileImpact } from "@/lib/intake/impact";
import { MarkBadge } from "./question-block";

// The business summary to check before anything is researched or suggested:
// confirmed answers, answers filled in for the owner, and open questions, each shown apart.

export function IntakeReview({
  editing,
  rows,
  marks,
  impact,
  headingRef,
  onEdit,
  disabled,
}: {
  editing: boolean;
  rows: SummaryRow[];
  marks: Marks;
  impact: ProfileImpact | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onEdit: (step: StepId) => void;
  disabled: boolean;
}) {
  const { check, open, confirmed } = groupRows(rows, marks);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>{editing ? "Your business" : "Last step"}</p>
        <h1 ref={headingRef} tabIndex={-1} className={PAGE_TITLE}>
          {editing ? "Check your changes" : "Check your business summary"}
        </h1>
        <p className="text-lg text-muted">
          Your requirements, structure suggestions and plan all start from this. Fix anything that’s off before you confirm.
        </p>
      </div>

      {editing && impact ? <ImpactPanel impact={impact} /> : null}

      {check.length ? (
        <RowGroup
          title="Filled in for you: check these"
          note="These came from your other answers or your description. Change anything that’s wrong. Confirming accepts them."
          tone="ai"
          rows={check}
          marks={marks}
          onEdit={onEdit}
          disabled={disabled}
        />
      ) : null}
      {open.length ? (
        <RowGroup
          title="Still open"
          note="We won’t guess these. They stay open questions, so your requirements show what depends on them."
          tone="open"
          rows={open}
          marks={marks}
          onEdit={onEdit}
          disabled={disabled}
        />
      ) : null}
      <RowGroup title="Your answers" tone="plain" rows={confirmed} marks={marks} onEdit={onEdit} disabled={disabled} />
    </div>
  );
}

const TONES = {
  ai: "bg-ai-tint/50 ring-ai/20",
  open: "bg-check-tint/50 ring-check/20",
  plain: "bg-surface ring-ink/5",
} as const;

function RowGroup({
  title,
  note,
  tone,
  rows,
  marks,
  onEdit,
  disabled,
}: {
  title: string;
  note?: string;
  tone: keyof typeof TONES;
  rows: SummaryRow[];
  marks: Marks;
  onEdit: (step: StepId) => void;
  disabled: boolean;
}) {
  if (!rows.length) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {note ? <p className="text-rule">{note}</p> : null}
      <dl className={`rounded-2xl px-5 ring-1 ${TONES[tone]}`}>
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule-tint py-3 last:border-b-0">
            <dt className="w-44 font-semibold text-rule">{row.label}</dt>
            <dd className={`flex min-w-0 flex-1 basis-56 flex-wrap items-center gap-2 ${row.value ? "" : "text-muted"}`}>
              {row.value || "Not answered"}
              {row.unsure ? <span className="rounded-full bg-check-tint px-2.5 py-0.5 text-[13px] font-bold text-check">Not sure yet</span> : null}
              <MarkBadge mark={row.fields.map((field) => marks[field]).find(Boolean)} />
            </dd>
            <button
              type="button"
              onClick={() => onEdit(row.step)}
              disabled={disabled}
              aria-label={`Change ${row.label.toLowerCase()}`}
              className="min-h-11 rounded-lg border border-field bg-surface px-3.5 text-sm font-semibold hover:border-muted disabled:opacity-60"
            >
              Change
            </button>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ImpactPanel({ impact }: { impact: ProfileImpact }) {
  if (!impact.changes.length) {
    return <p className="rounded-xl bg-rule-tint px-4 py-3 text-rule">You haven’t changed any answers yet.</p>;
  }
  return (
    <section aria-labelledby="impact-heading" className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-2 ring-accent/30">
      <h2 id="impact-heading" className="font-display text-xl font-bold">
        What these changes affect
      </h2>
      <ul className="flex flex-col gap-1.5">
        {impact.changes.map((change) => (
          <li key={change.label} className="text-[15px]">
            <span className="font-semibold">{change.label}:</span> <span className="text-muted line-through">{change.before}</span>{" "}
            <span aria-hidden="true">→</span>
            <span className="sr-only">changes to</span> {change.after}
          </li>
        ))}
      </ul>
      {impact.effects.length ? (
        <>
          <h3 className="font-bold">After you confirm</h3>
          <ul className="flex flex-col gap-2">
            {impact.effects.map((effect) => (
              <li key={`${effect.title}-${effect.href}`} className="rounded-xl bg-ground px-3.5 py-2.5">
                <Link href={effect.href} className={TEXT_LINK}>
                  {effect.title}
                </Link>
                <p className="text-[15px] text-rule">{effect.detail}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-rule">Nothing else in your plan depends on these answers.</p>
      )}
      <p className="text-sm text-muted">Your earlier answers are kept in your business history.</p>
    </section>
  );
}
