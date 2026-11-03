"use client";

import { useId, useLayoutEffect, useState } from "react";
import { comparePricesAction } from "@/app/(app)/products/actions";
import { Icon } from "@/components/icons";
import { RUNNING_ELSEWHERE, useJobWatch } from "@/components/job-watch";
import { AI_BUTTON, ALERT, INPUT } from "@/components/styles";
import { IconTile, OutsideLink } from "@/components/ui";
import { Working } from "@/components/working";
import { comparableStats, type PriceCheck, UNIT_WORDS } from "@/lib/rules/price-compare";
import { dollars, type ItemKind, type ItemOptions, priceLabel } from "@/lib/rules/products";

interface ComparedItem {
  id: string;
  name: string;
  kind: ItemKind;
  priceCents: number | null;
  priceText: string;
  options: ItemOptions;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// "Compare prices near you": prices found by search, each with its source; low, typical and high worked out in code
export function PriceCompare({ items, checks, noun }: { items: ComparedItem[]; checks: Record<string, PriceCheck>; noun: string }) {
  const uid = useId();
  const [chosen, setChosen] = useState(items[0]?.id ?? "all");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = useJobWatch();
  useLayoutEffect(() => () => setError(null), []);
  const shown = items.filter((item) => checks[item.id]);

  async function run() {
    if (pending || job.watching) return;
    setPending(true);
    setError(null);
    try {
      const result = await comparePricesAction(chosen);
      if (!result.ok && result.busy) return job.watch([result.busy]);
      if (!result.ok) setError(result.message);
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${uid}-heading`} className="@container overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <IconTile icon="search" tone="ai" />
        <h2 id={`${uid}-heading`} className="min-w-0 flex-1 text-base font-bold">
          Compare prices near you
        </h2>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-rule">See what similar {noun} cost in your area, with a link to each one, to help you set your own prices.</p>
        {items.length ? (
          <div className="flex flex-col gap-3 @md:flex-row @md:items-end">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-item`} className="font-semibold">
                What to compare
              </label>
              <select id={`${uid}-item`} value={chosen} onChange={(event) => setChosen(event.target.value)} className={`${INPUT} @md:w-80`}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {items.length > 1 ? <option value="all">All confirmed items (up to 5)</option> : null}
              </select>
            </div>
            <button type="button" onClick={() => void run()} disabled={pending || job.watching} className={`${AI_BUTTON} self-start @md:self-end`}>
              <Icon name="search" size="sm" />
              {pending ? "Searching…" : "Compare prices"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">Confirm an item first, then compare its price here.</p>
        )}
        <Working active={pending || job.watching} label={job.watching ? RUNNING_ELSEWHERE : "Searching for similar items nearby and reading their prices. This can take a minute or two."} />
        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
        {shown.map((item) => (
          <Results key={item.id} item={item} check={checks[item.id]} />
        ))}
      </div>
    </section>
  );
}

function Results({ item, check }: { item: ComparedItem; check: PriceCheck }) {
  const uid = useId();
  const own = priceLabel(item);
  const compared = comparableStats(check.prices, own);
  const stats = compared?.stats ?? null;
  const unit = compared ? UNIT_WORDS[compared.unit] : "";
  return (
    <section aria-labelledby={`${uid}-heading`} className="flex flex-col gap-3 border-t border-line pt-4">
      <h3 id={`${uid}-heading`} className="font-display text-[20px] leading-snug">
        Prices for {item.name}
        <span className="block text-sm font-normal text-muted">Searched {check.area}</span>
      </h3>
      {check.simulated ? <p className="text-sm font-semibold text-check">Practice sample, not a real search. These sellers aren’t real.</p> : null}
      {stats && stats.count < check.prices.length ? (
        <p className="text-sm text-muted">
          Low, typical and high use only the {stats.count} prices {unit || "for one item"}, so they compare like with like.
        </p>
      ) : null}
      {stats ? (
        <dl aria-label={`Price summary for ${item.name}`} className="grid grid-cols-2 gap-2 @md:grid-cols-4">
          {[
            [`Low${unit ? ` ${unit}` : ""}`, dollars(stats.lowCents)],
            [`Typical${unit ? ` ${unit}` : ""}`, dollars(stats.typicalCents)],
            [`High${unit ? ` ${unit}` : ""}`, dollars(stats.highCents)],
            ["Your price", own || "Not set"],
          ].map(([term, value]) => (
            <div key={term} className="rounded-lg border border-line bg-soft px-3 py-2">
              <dt className="text-sm text-muted">{term}</dt>
              <dd className="font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {check.prices.length ? (
        <ul aria-label={`Prices found for ${item.name}`} className="flex flex-col gap-3">
          {check.prices.map((price) => (
            <li key={`${price.seller}-${price.url}-${price.price}`} className="flex flex-col gap-2 rounded-lg border border-line p-3 @md:flex-row @md:items-center @md:justify-between">
              <div className="min-w-0">
                <p className="font-semibold break-words">{price.item}</p>
                <p className="text-sm text-muted break-words">
                  {price.seller} · <span className="font-semibold text-ink">{price.price}</span>
                </p>
              </div>
              <OutsideLink href={price.url} cue="see">
                See this {item.kind === "service" ? "service" : "item"}
              </OutsideLink>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-muted">
        {check.prices.length
          ? `Found by a web search on ${day(check.searchedAt)}. Prices change, so check each link.`
          : "We didn’t find prices for this nearby. That doesn’t mean there aren’t any."}
        {check.prices.length && !stats?.enough ? (
          <>
            <br />
            Too few prices to compare yet.
          </>
        ) : null}
      </p>
    </section>
  );
}
