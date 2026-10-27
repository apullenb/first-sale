import type { FactId } from "@/lib/structure/facts";
import type { Line, StructureOption } from "@/lib/structure/options";
import { LineItem, SourceLink, SourceQuotes, StateRule } from "./source-link";

// One ownership structure: what it is, why choose it, setup, ongoing work and tradeoffs, each line sourced
export function OptionCard({
  option,
  owners,
  state,
  stateFound,
  suggested,
  questions,
}: {
  option: StructureOption;
  owners: number;
  state: string;
  stateFound: boolean;
  suggested: boolean;
  questions: string[];
}) {
  const ongoing = option.ongoing(owners);
  const all: Line[] = [option.meaning, ...option.why, ...option.setup, ...ongoing, ...option.pros, ...option.cons];
  const facts = all.flatMap((line) => (line.fact ? [line.fact] : [])) as FactId[];
  const list = (lines: Line[]) => (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px]">
      {lines.map((line) => (
        <LineItem key={line.text} line={line} state={state} stateFound={stateFound} />
      ))}
    </ul>
  );

  return (
    <article aria-labelledby={`option-${option.id}`} className={`flex flex-col gap-4 rounded-2xl bg-surface p-5 ring-1 ${suggested ? "ring-2 ring-accent" : "ring-ink/5"}`}>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`option-${option.id}`} className="font-display text-xl font-bold">
            {option.label}
          </h3>
          {suggested ? <span className="rounded-full bg-accent px-2.5 py-0.5 text-[13px] font-bold text-white">Suggested starting point</span> : null}
        </div>
        <p className="text-rule">
          {option.meaning.text}
          {option.meaning.fact ? <SourceLink fact={option.meaning.fact} /> : null}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Why people choose it">{list(option.why)}</Section>
        <Section title="Tradeoffs">
          <ul className="flex flex-col gap-1.5 text-[15px]">
            {option.pros.map((line) => (
              <Tradeoff key={line.text} kind="plus" line={line} state={state} stateFound={stateFound} />
            ))}
            {option.cons.map((line) => (
              <Tradeoff key={line.text} kind="minus" line={line} state={state} stateFound={stateFound} />
            ))}
          </ul>
        </Section>
        <Section title="To set it up">{list(option.setup)}</Section>
        <Section title="Ongoing">{list(ongoing)}</Section>
      </div>
      {questions.length ? (
        <Section title="Still to find out">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px]">
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      <SourceQuotes facts={facts} />
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h4>
      {children}
    </div>
  );
}

function Tradeoff({ kind, line, state, stateFound }: { kind: "plus" | "minus"; line: Line; state: string; stateFound: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 shrink-0 rounded px-1.5 text-xs font-bold ${kind === "plus" ? "bg-accent-tint text-accent-ink" : "bg-check-tint text-check"}`}>
        {kind === "plus" ? "Plus" : "Minus"}
      </span>
      <span>
        {line.text}
        {line.fact ? <SourceLink fact={line.fact} /> : null}
        {line.stateRule ? <StateRule state={state} found={stateFound} /> : null}
      </span>
    </li>
  );
}
