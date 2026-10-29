import Link from "next/link";
import type { ReactNode } from "react";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { SECONDARY_LINK } from "@/components/styles";
import { IconTile } from "@/components/ui";
import { STRUCTURE_LABELS } from "@/lib/details";
import type { PathSuggestion } from "@/lib/structure/suggest";
import { SourceLink } from "./source-link";

// The suggested starting point and everything it rests on, kept apart from any legal determination
export function SuggestedPath({ suggestion, children }: { suggestion: PathSuggestion; children?: ReactNode }) {
  return (
    <section
      aria-labelledby="path-heading"
      className="flex flex-col gap-3.5 rounded-2xl border border-accent-ring bg-surface p-5 shadow-[0_0_0_4px_var(--color-accent-tint),var(--shadow-card)] sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-3">
        <IconTile icon="lightbulb" />
        <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">Suggested for you</p>
        <ActorChip actor="rule" />
      </div>
      <h2 id="path-heading" className="font-display text-[22px] leading-snug sm:text-2xl">
        {suggestion.headline}
      </h2>
      {suggestion.basedOn.length ? (
        <ul aria-label="Based on your answers" className="flex flex-wrap gap-2">
          {suggestion.basedOn.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft px-3 py-1 text-[14.5px] text-rule">
              <Icon name="check" size="xs" className="text-accent" />
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[15px] text-muted">A starting point worked out from your answers by fixed rules, not a legal decision. You choose, and you can change it later.</p>

      <details className="group/why rounded-xl border border-line bg-surface shadow-soft">
        <summary className="flex min-h-[58px] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="grid min-w-0 flex-1 gap-px">
            <b className="font-bold">Why this is suggested</b>
            <small className="text-[14.5px] text-muted">What it rests on, what would change it, and a what-if to try</small>
          </span>
          <Icon name="chevron" className="text-faint transition-transform group-open/why:rotate-90 motion-reduce:transition-none" />
        </summary>
        <div className="flex flex-col gap-5 px-4 pb-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Block title="What it assumes" items={suggestion.assumptions} />
            <Block title="Answers that would change it" items={suggestion.wouldChange} />
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">Other reasonable options</h3>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] marker:text-faint">
                {suggestion.alternatives.map((alternative) => (
                  <li key={alternative.option}>
                    <span className="font-semibold">{STRUCTURE_LABELS[alternative.option]}:</span> {alternative.why}
                    {alternative.fact ? <SourceLink fact={alternative.fact} /> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Link href="/business/edit" className={SECONDARY_LINK}>
            <Icon name="pencil" size="sm" />
            Correct an answer
          </Link>
          {children}
        </div>
      </details>
    </section>
  );
}

// Questions to take to a professional, for the "Not sure yet?" fold
export function AskAProfessional({ questions }: { questions: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      {questions.length ? (
        <>
          <h3 className="font-bold">Questions to take to a professional</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] marker:text-faint">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="text-[15px] text-muted">
        The SBA offers counseling through its resource partners
        <SourceLink fact="sba_counseling" />. An accountant or lawyer can also answer these for your situation.
      </p>
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">{title}</h3>
      {items.length ? (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] marker:text-faint">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-muted">Nothing yet.</p>
      )}
    </div>
  );
}
