import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import type { StructureExample } from "@/data/structure-examples";
import type { FactId } from "@/lib/structure/facts";
import type { Line, StructureOption } from "@/lib/structure/options";
import { ExplainWhy, RecommendedTag, ShowExamples } from "./explain";
import { LineItem, SourceLink, SourceQuotes, StateRule } from "./source-link";

// One ownership structure, explained: what it is, why people pick it, what to watch for, then setup and examples folded away
export function OptionCard({
  option,
  ongoing,
  cons,
  state,
  stateFound,
  why,
  examples,
}: {
  option: StructureOption;
  // Already narrowed to this owner's answers
  ongoing: Line[];
  cons: Line[];
  state: string;
  stateFound: boolean;
  // Reasons, when it's the recommended option
  why: ReactNode | null;
  examples: StructureExample[];
}) {
  const facts = [option.meaning, ...option.why, ...option.setup, ...ongoing, ...cons].flatMap((line) => (line.fact ? [line.fact] : [])) as FactId[];
  const list = (lines: Line[]) => (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] marker:text-faint">
      {lines.map((line) => (
        <LineItem key={line.text} line={line} state={state} stateFound={stateFound} />
      ))}
    </ul>
  );

  return (
    <article
      className={`flex flex-col gap-4 rounded-[14px] border bg-surface p-5 shadow-card ${
        why ? "border-accent-ring shadow-[0_0_0_3px_var(--color-accent-tint),var(--shadow-card)]" : "border-line"
      }`}
    >
      <div className="flex flex-col gap-2">
        <h4 className="font-display text-xl leading-snug">{option.label}</h4>
        {why ? (
          <div className="flex flex-col gap-0.5">
            <RecommendedTag />
            <ExplainWhy>{why}</ExplainWhy>
          </div>
        ) : null}
      </div>
      <p className="text-[15px] text-rule">
        {option.meaning.text}
        {option.meaning.fact ? <SourceLink fact={option.meaning.fact} /> : null}
      </p>
      <Section title="Why people choose it">
        <ul className="flex flex-col gap-1.5 text-[15px]">
          {option.why.map((line) => (
            <Tradeoff key={line.text} kind="plus" line={line} state={state} stateFound={stateFound} />
          ))}
        </ul>
      </Section>
      <Section title="Watch out for">
        <ul className="flex flex-col gap-1.5 text-[15px]">
          {cons.map((line) => (
            <Tradeoff key={line.text} kind="minus" line={line} state={state} stateFound={stateFound} />
          ))}
        </ul>
      </Section>
      <div className="mt-auto flex flex-col border-t border-line pt-1">
        <details className="group/setup">
          <summary className="relative z-10 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-accent hover:text-accent-ink [&::-webkit-details-marker]:hidden">
            <Icon name="chevron" size="sm" className="transition-transform group-open/setup:rotate-90 motion-reduce:transition-none" />
            What it takes to set up and keep up
          </summary>
          <div className="mt-1 flex flex-col gap-3.5 pb-2">
            <Section title="To set it up">{list(option.setup)}</Section>
            <Section title="To keep it up">{list(ongoing)}</Section>
            <SourceQuotes facts={facts} />
          </div>
        </details>
        <ShowExamples examples={examples} />
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">{title}</p>
      {children}
    </div>
  );
}

function Tradeoff({ kind, line, state, stateFound }: { kind: "plus" | "minus"; line: Line; state: string; stateFound: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden="true"
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${kind === "plus" ? "border-accent-ring bg-accent-tint text-accent" : "border-check-ring bg-check-tint text-check"}`}
      >
        <Icon name={kind === "plus" ? "check" : "alert"} size="xs" strokeWidth={2.2} />
      </span>
      <span>
        {line.text}
        {line.fact ? <SourceLink fact={line.fact} /> : null}
        {line.stateRule ? <StateRule state={state} found={stateFound} /> : null}
      </span>
    </li>
  );
}
