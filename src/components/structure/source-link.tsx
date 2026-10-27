import { CHECKED_ON, FACTS, type FactId, factSource } from "@/lib/structure/facts";
import type { Line } from "@/lib/structure/options";

const CHECKED = new Date(`${CHECKED_ON}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function shortName(fact: FactId): string {
  return factSource(fact).id.startsWith("irs") ? "IRS" : "SBA";
}

// A link to the official page a statement comes from
export function SourceLink({ fact }: { fact: FactId }) {
  const source = factSource(fact);
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="ml-1.5 inline-flex min-h-6 items-center whitespace-nowrap rounded-full bg-accent-tint px-2 py-0.5 align-middle text-xs font-bold text-accent-ink underline-offset-2 hover:underline"
    >
      <span aria-hidden="true">{shortName(fact)}</span>
      <span className="sr-only">Official source: {source.title} (opens in a new tab)</span>
    </a>
  );
}

// A state rule: points to what research found for the owner's state, or says it still needs confirming
export function StateRule({ state, found }: { state: string; found: boolean }) {
  if (found) {
    return (
      <a href="#state-rules" className="ml-1.5 inline-flex min-h-6 items-center whitespace-nowrap rounded-full bg-accent-tint px-2 py-0.5 align-middle text-xs font-bold text-accent-ink underline-offset-2 hover:underline">
        See {state}’s rules below
      </a>
    );
  }
  return (
    <span className="ml-1.5 inline-flex min-h-6 items-center whitespace-nowrap rounded-full bg-check-tint px-2 py-0.5 align-middle text-xs font-bold text-check">
      Needs confirming for {state}
    </span>
  );
}

export function LineItem({ line, state, stateFound }: { line: Line; state: string; stateFound: boolean }) {
  return (
    <li>
      {line.text}
      {line.fact ? <SourceLink fact={line.fact} /> : null}
      {line.stateRule ? <StateRule state={state} found={stateFound} /> : null}
      {line.tip && !line.fact ? <span className="ml-1.5 align-middle text-xs font-bold text-muted">Tip</span> : null}
    </li>
  );
}

// The exact words behind a card's statements, for anyone who wants to check
export function SourceQuotes({ facts }: { facts: FactId[] }) {
  const unique = [...new Set(facts)];
  if (!unique.length) return null;
  return (
    <details className="text-[15px]">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent-ink underline underline-offset-4">
        Official sources, in their own words
      </summary>
      <ul className="flex flex-col gap-2.5 rounded-xl bg-ground px-4 py-3">
        {unique.map((fact) => {
          const source = factSource(fact);
          return (
            <li key={fact} className="flex flex-col gap-0.5">
              <q className="text-rule">{FACTS[fact].quote}</q>
              <a href={source.url} target="_blank" rel="noreferrer" className="w-fit text-sm font-semibold text-accent-ink underline underline-offset-4">
                {source.title}
              </a>
            </li>
          );
        })}
        <li className="text-sm text-muted">Checked against these pages on {CHECKED}.</li>
      </ul>
    </details>
  );
}
