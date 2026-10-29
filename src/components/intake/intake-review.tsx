"use client";

import Link from "next/link";
import { type ReactNode, type RefObject, useId } from "react";
import { Icon, type IconName } from "@/components/icons";
import { EYEBROW, LEAD, PAGE_TITLE, TEXT_LINK } from "@/components/styles";
import { Chip, IconTile } from "@/components/ui";
import { groupRows, type Marks, type StepId, type SummaryRow } from "@/lib/intake/answers";
import type { ProfileImpact } from "@/lib/intake/impact";
import { rowsByChapter } from "./chapters";
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
  children,
}: {
  editing: boolean;
  rows: SummaryRow[];
  marks: Marks;
  impact: ProfileImpact | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onEdit: (step: StepId) => void;
  disabled: boolean;
  // Save buttons and messages, at the foot of the card
  children?: ReactNode;
}) {
  const { check, open, confirmed } = groupRows(rows, marks);
  const shared = { marks, onEdit, disabled };
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-8 rounded-2xl border border-line bg-surface px-4 py-5 shadow-card sm:p-7">
      <div className="flex flex-col gap-2">
        <p className={EYEBROW}>{editing ? "Your business" : "Last step"}</p>
        <h1 id={titleId} ref={headingRef} tabIndex={-1} className={PAGE_TITLE}>
          {editing ? "Check your changes" : "Check your business summary"}
        </h1>
        <p className={LEAD}>Your requirements, structure suggestions and plan all start from this. Fix anything that’s off before you confirm.</p>
      </div>

      {editing && impact ? <ImpactPanel impact={impact} /> : null}

      {check.length ? (
        <RowGroup
          title="Filled in for you: check these"
          note="These came from your other answers or your description. Change anything that’s wrong. Confirming accepts them."
          icon="sparkles"
          tone="ai"
        >
          <Rows rows={check} {...shared} />
        </RowGroup>
      ) : null}
      {open.length ? (
        <RowGroup
          title="Still open"
          note="We won’t guess these. They stay open questions, so your requirements show what depends on them."
          icon="question"
          tone="warn"
        >
          <Rows rows={open} {...shared} />
        </RowGroup>
      ) : null}
      {confirmed.length ? (
        <RowGroup title="Your answers" icon="check" tone="accent">
          {rowsByChapter(confirmed).map(({ chapter, rows: chapterRows }) => (
            <div key={chapter.label} className="flex flex-col">
              <h3 className="pt-2 text-[13.5px] font-bold uppercase tracking-[0.08em] text-muted">{chapter.label}</h3>
              <Rows rows={chapterRows} {...shared} />
            </div>
          ))}
        </RowGroup>
      ) : null}

      {children ? <div className="flex flex-col gap-3">{children}</div> : null}
    </section>
  );
}

function RowGroup({
  title,
  note,
  icon,
  tone,
  children,
}: {
  title: string;
  note?: string;
  icon: IconName;
  tone: "ai" | "warn" | "accent";
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <IconTile icon={icon} tone={tone} />
        <h2 className="text-[17.5px] font-bold leading-snug">{title}</h2>
      </div>
      {note ? <p className="text-[15px] text-muted">{note}</p> : null}
      {children}
    </section>
  );
}

function Rows({ rows, marks, onEdit, disabled }: { rows: SummaryRow[]; marks: Marks; onEdit: (step: StepId) => void; disabled: boolean }) {
  return (
    <dl className="flex flex-col">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-2.5 last:border-b-0">
          <dt className="w-full text-[15px] text-muted sm:w-48">{row.label}</dt>
          <dd className={`flex min-w-0 flex-1 basis-48 flex-wrap items-center gap-2 ${row.value ? "font-semibold" : "text-muted"}`}>
            {row.value || "Not answered"}
            {row.unsure ? <Chip tone="warn">Not sure yet</Chip> : null}
            <MarkBadge mark={row.fields.map((field) => marks[field]).find(Boolean)} />
          </dd>
          <button
            type="button"
            onClick={() => onEdit(row.step)}
            disabled={disabled}
            aria-label={`Change ${row.label.toLowerCase()}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[15px] font-semibold text-accent transition hover:bg-accent-tint hover:text-accent-ink disabled:opacity-60"
          >
            <Icon name="pencil" size="sm" />
            Change
          </button>
        </div>
      ))}
    </dl>
  );
}

function ImpactPanel({ impact }: { impact: ProfileImpact }) {
  if (!impact.changes.length) {
    return (
      <p className="flex items-center gap-2.5 rounded-xl border border-line bg-soft px-4 py-3 text-rule">
        <Icon name="info" className="text-faint" />
        You haven’t changed any answers yet.
      </p>
    );
  }
  return (
    <section
      aria-labelledby="impact-heading"
      className="flex flex-col gap-3 rounded-2xl border border-accent-ring bg-surface p-5 shadow-[0_0_0_4px_var(--color-accent-tint)]"
    >
      <div className="flex items-center gap-3">
        <IconTile icon="refresh" />
        <h2 id="impact-heading" className="font-display text-[22px] leading-snug">
          What these changes affect
        </h2>
      </div>
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
              <li key={`${effect.title}-${effect.href}`} className="rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-soft">
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
