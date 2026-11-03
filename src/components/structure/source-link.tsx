import { Icon } from "@/components/icons";
import { CHECKED_ON, FACTS, type FactId, factSource } from "@/lib/structure/facts";
import type { Line } from "@/lib/structure/options";
import { ResourceLink } from "@/components/ui";

export const FACTS_CHECKED = new Date(`${CHECKED_ON}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

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
      className="relative z-10 ml-1.5 inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-md border border-line bg-soft px-1.5 align-middle text-xs font-semibold text-muted underline-offset-2 hover:text-accent hover:underline"
    >
      <Icon name="book" size="xs" />
      <span aria-hidden="true">{shortName(fact)}</span>
      <span className="sr-only">Official source: {source.title} (opens in a new tab)</span>
    </a>
  );
}

// A state rule: points to what research found for the owner's state, or says it still needs confirming
export function StateRule({ state, found }: { state: string; found: boolean }) {
  if (found) {
    return (
      <a
        href="#state-rules"
        className="relative z-10 ml-1.5 inline-flex min-h-6 items-center whitespace-nowrap rounded-md border border-accent-ring bg-accent-tint px-1.5 align-middle text-xs font-bold text-accent-ink underline-offset-2 hover:underline"
      >
        See {state}’s requirements below
      </a>
    );
  }
  return (
    <span className="ml-1.5 inline-flex min-h-6 items-center whitespace-nowrap rounded-md border border-check-ring bg-check-tint px-1.5 align-middle text-xs font-bold text-check">
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
    <details className="group/quotes text-[15px]">
      <summary className="relative z-10 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 font-semibold text-accent hover:text-accent-ink [&::-webkit-details-marker]:hidden">
        <Icon name="chevron" size="sm" className="transition-transform group-open/quotes:rotate-90 motion-reduce:transition-none" />
        Official sources, in their own words
      </summary>
      <ul className="flex flex-col gap-2.5 rounded-xl border border-line bg-soft px-4 py-3">
        {unique.map((fact) => {
          const source = factSource(fact);
          return (
            <li key={fact} className="flex flex-col gap-0.5">
              <q className="border-l-[3px] border-accent-ring pl-3 italic text-rule">{FACTS[fact].quote}</q>
              <ResourceLink href={source.url} className="relative z-10 w-fit">
                {source.title}
              </ResourceLink>
            </li>
          );
        })}
        <li className="text-sm text-muted">Checked against these pages on {FACTS_CHECKED}.</li>
      </ul>
    </details>
  );
}
