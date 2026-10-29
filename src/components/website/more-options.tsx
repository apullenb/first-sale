import { LocalDate } from "@/components/local-date";
import { SOFT } from "@/components/marketing/pieces";
import { TEXT_LINK } from "@/components/styles";
import type { MoreOptions, OptionExplanation } from "@/lib/website/options";
import { ExplainOption } from "./explain-option";
import { List } from "./platform-card";

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
      <div className="grid gap-4 @3xl:grid-cols-2">
        {found.options.map((option) => {
          const key = `more:${option.name.toLowerCase()}`;
          return (
            <article key={option.name} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-soft">
              <div className="flex flex-col gap-1">
                <h4 className="font-display text-xl">{option.name}</h4>
                {option.bestFor ? <p className="text-sm text-muted">Best for: {option.bestFor}</p> : null}
              </div>
              <p className={`${SOFT} px-3.5 py-2.5`}>
                <strong>Price:</strong> {option.prices ?? "The search didn’t show a price. Check their pricing page."}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <List title="Good" items={option.pros} tone="good" />
                <List title="Watch out for" items={option.cons} tone="bad" />
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
