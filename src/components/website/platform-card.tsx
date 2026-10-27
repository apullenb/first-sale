import { LocalDate } from "@/components/local-date";
import { TEXT_LINK } from "@/components/styles";
import { cardFeeOn, firstYearCost, usd } from "@/lib/website/costs";
import type { OptionExplanation } from "@/lib/website/options";
import type { PlatformInfo } from "@/lib/website/platforms";
import { ChoosePlatformButton } from "./choose-platform";
import { ExplainOption } from "./explain-option";

const EXAMPLE_ORDER = 40;

function List({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" | "plain" }) {
  const mark = tone === "good" ? "+" : tone === "bad" ? "–" : "•";
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

// One option, with its real costs, what's in and out, and the owner's pick
export function PlatformCard({
  platform,
  recommended,
  chosen,
  explanation,
}: {
  platform: PlatformInfo;
  recommended: boolean;
  chosen: boolean;
  explanation: OptionExplanation | null;
}) {
  const year = firstYearCost(platform);
  const fee = cardFeeOn(platform, EXAMPLE_ORDER);
  return (
    <article
      aria-labelledby={`platform-${platform.id}`}
      className={`flex flex-col gap-4 rounded-2xl bg-surface p-5 ring-1 ${chosen ? "ring-2 ring-accent" : recommended ? "ring-accent/40" : "ring-ink/5"}`}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`platform-${platform.id}`} className="font-display text-2xl font-bold">
            {platform.name}
          </h3>
          {recommended ? <span className="rounded-full bg-accent px-2.5 py-0.5 text-[13px] font-bold text-white">Suggested for you</span> : null}
          {chosen ? <span className="rounded-full bg-accent-tint px-2.5 py-0.5 text-[13px] font-bold text-accent-ink">Your choice</span> : null}
        </div>
        <p className="text-rule">{platform.oneLine}</p>
        <p className="text-sm text-muted">Best for: {platform.bestFor}</p>
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl bg-ground px-4 py-3">
        <p className="text-sm font-bold">What it costs</p>
        <p>
          <strong>{platform.startPlan.name}:</strong> {platform.startPlan.price}. {platform.startPlan.adds}
        </p>
        {platform.otherPlans.map((plan) => (
          <p key={plan.name} className="text-[15px] text-rule">
            <strong>{plan.name}:</strong> {plan.price}. {plan.adds}
          </p>
        ))}
        <p className="text-[15px] text-rule">
          <strong>Web address:</strong> {platform.domain.label}
        </p>
        {platform.cardFee ? (
          <p className="text-[15px] text-rule">
            <strong>Card payments:</strong> {platform.cardFee.label}. On a {usd(EXAMPLE_ORDER)} order, that’s about {usd(fee ?? 0)}.
          </p>
        ) : (
          <p className="text-[15px] text-rule">
            <strong>Card payments:</strong> none. There’s no checkout, so customers pay you another way.
          </p>
        )}
        <p className="text-[15px]">
          <strong>First year, {year.total ? `from about ${usd(year.total)}` : usd(0)}</strong> before card fees: {year.parts.join(" + ")}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <List title="Good" items={platform.pros} tone="good" />
        <List title="Watch out for" items={platform.cons} tone="bad" />
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl bg-check-tint/60 px-4 py-3 ring-1 ring-check/15">
        <p className="text-sm font-bold text-check">Not included, and you’ll likely need</p>
        <ul className="flex flex-col gap-2 text-[15px]">
          {platform.notIncluded.map((item) => (
            <li key={item.item} className="flex flex-col">
              <span>
                <strong>{item.item}</strong> · {item.cost}
              </span>
              <span className="text-rule">{item.why}</span>
              {item.inApp ? (
                <a href={item.inApp.href} className={`${TEXT_LINK} inline-flex min-h-11 w-fit items-center text-sm`}>
                  {item.inApp.label}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <details className="group">
        <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-accent-ink underline underline-offset-4">
          What’s included
        </summary>
        <div className="mt-1">
          <List title="Included with the plan" items={platform.includes} tone="plain" />
        </div>
      </details>

      <ExplainOption optionKey={`platform:${platform.id}`} name={platform.name} explanation={explanation} />

      <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
        <ChoosePlatformButton platform={platform.id} name={platform.name} chosen={chosen} />
        <p className="text-sm text-muted">
          Prices from {platform.name}’s own pages, checked <LocalDate iso={`${platform.checkedOn}T12:00:00Z`} />. They can change, so
          check before you sign up:{" "}
          {platform.sources.map((source, index) => (
            <span key={source.url}>
              {index ? ", " : ""}
              <a href={source.url} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                {source.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </span>
          ))}
          .
        </p>
      </div>
    </article>
  );
}
