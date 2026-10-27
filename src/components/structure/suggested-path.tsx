import Link from "next/link";
import { ActorChip } from "@/components/actor-chip";
import { SECONDARY_LINK } from "@/components/styles";
import { STRUCTURE_LABELS } from "@/lib/details";
import type { PathSuggestion } from "@/lib/structure/suggest";
import { SourceLink } from "./source-link";

// The suggested starting point and everything it rests on, kept apart from any legal determination
export function SuggestedPath({ suggestion }: { suggestion: PathSuggestion }) {
  return (
    <section aria-labelledby="path-heading" className="flex flex-col gap-4 rounded-2xl bg-surface p-5 ring-2 ring-accent/40">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-accent-ink">Suggested path</p>
          <ActorChip actor="rule" />
        </div>
        <h2 id="path-heading" className="font-display text-2xl font-bold leading-tight">
          {suggestion.headline}
        </h2>
        <p className="text-[15px] text-muted">
          A starting point worked out from your answers by fixed rules, not a legal decision. You choose, and you can change it later.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Block title="Based on your answers" items={suggestion.basedOn}>
          <Link href="/business/edit" className={`${SECONDARY_LINK} mt-1`}>
            Correct an answer
          </Link>
        </Block>
        <Block title="What it assumes" items={suggestion.assumptions} />
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Other reasonable options</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px]">
            {suggestion.alternatives.map((alternative) => (
              <li key={alternative.option}>
                <span className="font-semibold">{STRUCTURE_LABELS[alternative.option]}:</span> {alternative.why}
                {alternative.fact ? <SourceLink fact={alternative.fact} /> : null}
              </li>
            ))}
          </ul>
        </div>
        <Block title="Answers that would change it" items={suggestion.wouldChange} />
      </div>

      {suggestion.askAProfessional.length ? (
        <div className="flex flex-col gap-1.5 rounded-xl bg-ground p-4">
          <h3 className="font-bold">Questions to take to a professional</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px]">
            {suggestion.askAProfessional.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            The SBA offers counseling through its resource partners
            <SourceLink fact="sba_counseling" />. An accountant or lawyer can also answer these for your situation.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Block({ title, items, children }: { title: string; items: string[]; children?: React.ReactNode }) {
  if (!items.length && !children) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
      {items.length ? (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px]">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-muted">Nothing yet.</p>
      )}
      {children}
    </div>
  );
}
