import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import type { FactId } from "@/lib/structure/facts";
import type { Line, StructureOption } from "@/lib/structure/options";
import { LineItem, SourceLink, SourceQuotes, StateRule } from "./source-link";

// One ownership structure's details for its choice card: what it is, pros and cons, then setup and ongoing work folded away, each line sourced
export function OptionCard({ option, owners, state, stateFound, questions }: { option: StructureOption; owners: number; state: string; stateFound: boolean; questions: string[] }) {
  const ongoing = option.ongoing(owners);
  const all: Line[] = [option.meaning, ...option.why, ...option.setup, ...ongoing, ...option.pros, ...option.cons];
  const facts = all.flatMap((line) => (line.fact ? [line.fact] : [])) as FactId[];
  const list = (lines: Line[]) => (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] marker:text-faint">
      {lines.map((line) => (
        <LineItem key={line.text} line={line} state={state} stateFound={stateFound} />
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-muted">
        {option.meaning.text}
        {option.meaning.fact ? <SourceLink fact={option.meaning.fact} /> : null}
      </p>
      <Section title="Pros">
        <ul className="flex flex-col gap-1.5 text-[15px]">
          {option.pros.map((line) => (
            <Tradeoff key={line.text} kind="plus" line={line} state={state} stateFound={stateFound} />
          ))}
        </ul>
      </Section>
      <Section title="Cons">
        <ul className="flex flex-col gap-1.5 text-[15px]">
          {option.cons.map((line) => (
            <Tradeoff key={line.text} kind="minus" line={line} state={state} stateFound={stateFound} />
          ))}
        </ul>
      </Section>
      <details className="group/opt-more border-t border-line pt-1">
        <summary className="relative z-10 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-accent hover:text-accent-ink [&::-webkit-details-marker]:hidden">
          <Icon name="chevron" size="sm" className="transition-transform group-open/opt-more:rotate-90 motion-reduce:transition-none" />
          Why people choose it, setup and ongoing work
        </summary>
        <div className="mt-2 flex flex-col gap-3.5">
          <Section title="Why people choose it">{list(option.why)}</Section>
          <Section title="To set it up">{list(option.setup)}</Section>
          <Section title="Ongoing">{list(ongoing)}</Section>
          {questions.length ? (
            <Section title="Still to find out">
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] marker:text-faint">
                {questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </Section>
          ) : null}
          <SourceQuotes facts={facts} />
        </div>
      </details>
    </div>
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
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${kind === "plus" ? "border-accent-ring bg-accent-tint text-accent" : "border-line bg-wash text-muted"}`}
      >
        <Icon name={kind === "plus" ? "check" : "close"} size="xs" strokeWidth={2.2} />
      </span>
      <span>
        <span className="sr-only">{kind === "plus" ? "Plus: " : "Minus: "}</span>
        {line.text}
        {line.fact ? <SourceLink fact={line.fact} /> : null}
        {line.stateRule ? <StateRule state={state} found={stateFound} /> : null}
      </span>
    </li>
  );
}
