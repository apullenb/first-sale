import { LocalDate } from "@/components/local-date";
import { TEXT_LINK } from "@/components/styles";
import type { MoreOptions, OptionExplanation } from "@/lib/website/options";
import { ExplainOption } from "./explain-option";

// Builders Muse found on request. Labeled as search results: First Sale didn't check these prices itself.
export function MoreOptionsList({ found, explanations }: { found: MoreOptions; explanations: Record<string, OptionExplanation> }) {
  if (!found.options.length) {
    return <p className="text-muted">The search didn’t turn up other options that fit. The options above cover most first websites.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Found by an AI web search on <LocalDate iso={found.searchedAt} />. Prices are as the search results showed them; First Sale
        didn’t check them on each site, so confirm before you sign up.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {found.options.map((option) => {
          const key = `more:${option.name.toLowerCase()}`;
          return (
            <article key={option.name} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-ink/5">
              <div className="flex flex-col gap-1">
                <h4 className="font-display text-xl font-bold">{option.name}</h4>
                {option.bestFor ? <p className="text-sm text-muted">Best for: {option.bestFor}</p> : null}
              </div>
              <p className="rounded-xl bg-ground px-3.5 py-2.5">
                <strong>Price:</strong> {option.prices ?? "The search didn’t show a price. Check their pricing page."}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Points title="Good" items={option.pros} mark="+" />
                <Points title="Watch out for" items={option.cons} mark="–" />
              </div>
              <ExplainOption optionKey={key} name={option.name} explanation={explanations[key] ?? null} />
              <p className="text-sm text-muted">
                <a href={option.website} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                  Visit {option.name}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                {" · Sources: "}
                {option.sources.map((source, index) => (
                  <span key={source.url}>
                    {index ? ", " : ""}
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} break-all`}>
                      {source.title}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </span>
                ))}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Points({ title, items, mark }: { title: string; items: string[]; mark: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-bold">{title}</p>
      <ul className="flex flex-col gap-1 text-[15px] text-rule">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden="true" className="w-3 shrink-0 font-bold">
              {mark}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
