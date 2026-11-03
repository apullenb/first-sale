import type { ReactNode } from "react";
import { Icon } from "./icons";
import { LocalDate } from "./local-date";
import { IconTile } from "./ui";

// A finished step or decision: what was chosen comes first; everything that led to it waits behind "Revisit"

export function Completed({
  eyebrow = "Your decision",
  title,
  lines = [],
  when,
  whenLabel = "Decided",
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  // The other parts of the choice, such as how it's taxed
  lines?: { label: string; value: ReactNode }[];
  when?: string | null;
  whenLabel?: string;
  // What comes next, or a note about the choice
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby="completed-heading" className="flex flex-col gap-4 rounded-2xl border border-done/25 bg-done-tint/60 p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3.5">
        <IconTile icon="check" tone="done" big />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-done">{eyebrow}</p>
          <h2 id="completed-heading" className="font-display text-[26px] leading-tight sm:text-[30px]">
            {title}
          </h2>
          {when ? (
            <p className="text-sm text-muted">
              {whenLabel} <LocalDate iso={when} />
            </p>
          ) : null}
        </div>
      </div>
      {lines.length ? (
        <dl className="grid gap-x-6 gap-y-3 border-t border-done/20 pt-4 sm:grid-cols-2">
          {lines.map((line) => (
            <div key={line.label} className="flex flex-col gap-0.5">
              <dt className="text-sm font-semibold text-muted">{line.label}</dt>
              <dd className="font-semibold">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
    </section>
  );
}

// Everything behind the decision, one click away; open when the decision needs another look
export function Revisit({
  label = "Revisit this decision",
  summary = "See the options and what each means for you again, and choose differently if you want.",
  open,
  id,
  children,
}: {
  label?: string;
  summary?: string;
  open?: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <details id={id} open={open} className="group scroll-mt-6 rounded-2xl border border-line-strong bg-surface shadow-soft">
      <summary className="flex min-h-[64px] cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-4 hover:bg-soft [&::-webkit-details-marker]:hidden">
        <IconTile icon="refresh" />
        <span className="grid min-w-0 flex-1 gap-0.5">
          <b className="text-[17px] font-bold text-accent">{label}</b>
          <small className="text-[14.5px] text-muted">{summary}</small>
        </span>
        <Icon name="chevron" className="text-faint transition-transform group-open:rotate-90" />
      </summary>
      <div className="flex flex-col gap-6 border-t border-line px-4 pt-5 pb-6 sm:px-6">{children}</div>
    </details>
  );
}
