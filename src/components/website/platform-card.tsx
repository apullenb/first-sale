import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { LABEL, SOFT } from "@/components/marketing/pieces";
import { TEXT_LINK } from "@/components/styles";
import { Chip } from "@/components/ui";
import { cardFeeOn, firstYearCost, usd } from "@/lib/website/costs";
import type { OptionExplanation } from "@/lib/website/options";
import type { PlatformInfo } from "@/lib/website/platforms";
import { ChoosePlatformButton } from "./choose-platform";
import { ExplainOption } from "./explain-option";

const EXAMPLE_ORDER = 40;

const MARKS = {
  good: { icon: "check", tile: "border-accent-ring bg-accent-tint text-accent" },
  bad: { icon: "minus", tile: "border-line bg-wash text-muted" },
  plain: { icon: "dot", tile: "border-line bg-wash text-muted" },
} as const;

export function List({ title, items, tone }: { title: string; items: string[]; tone: keyof typeof MARKS }) {
  const mark = MARKS[tone];
  return (
    <div className="flex flex-col gap-1.5">
      <p className={LABEL}>{title}</p>
      <ul className="flex flex-col gap-1.5 text-[15px] text-rule">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span aria-hidden="true" className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${mark.tile}`}>
              <Icon name={mark.icon} size="xs" strokeWidth={tone === "plain" ? 5 : 2.4} />
            </span>
            <span className="min-w-0 flex-1">{item}</span>
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
      className={`flex flex-col gap-4 rounded-[14px] border bg-surface p-5 ${chosen ? "border-accent shadow-[0_0_0_3px_var(--color-accent-tint),var(--shadow-card)]" : "border-line shadow-card"}`}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`platform-${platform.id}`} className="mr-auto font-display text-[24px] leading-tight">
            {platform.name}
          </h3>
          {recommended ? (
            <Chip tone="accent" icon="sparkles">
              Suggested for you
            </Chip>
          ) : null}
          {chosen ? (
            <Chip tone="done" icon="check">
              Your choice
            </Chip>
          ) : null}
        </div>
        <p className="text-rule">{platform.oneLine}</p>
        <p className="text-sm text-muted">Best for: {platform.bestFor}</p>
      </div>

      <div className={`${SOFT} flex flex-col gap-1.5 px-4 py-3`}>
        <p className={LABEL}>What it costs</p>
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
            <strong>Card payments:</strong> {platform.paymentNote ?? "none. There’s no checkout, so customers pay you another way."}
          </p>
        )}
        <p className="mt-1 flex items-start gap-2 border-t border-line pt-2.5 text-[15px]">
          <Icon name="dollar" size="sm" className="mt-[3px] text-accent" />
          <span>
            <strong>First year, {year.total ? `from about ${usd(year.total)}` : usd(0)}</strong> before card fees: {year.parts.join(" + ")}.
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Good" items={platform.pros} tone="good" />
        <List title="Watch out for" items={platform.cons} tone="bad" />
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl border border-check-ring bg-check-tint px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-bold text-check">
          <Icon name="info" size="sm" />
          Not included, and you’ll likely need
        </p>
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

      <details className="group/inc">
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 font-semibold text-accent [&::-webkit-details-marker]:hidden">
          <Icon name="chevron" size="sm" className="transition-transform group-open/inc:rotate-90" />
          What’s included
        </summary>
        <div className="mt-1">
          <List title="Included with the plan" items={platform.includes} tone="plain" />
        </div>
      </details>

      <ExplainOption optionKey={`platform:${platform.id}`} name={platform.name} explanation={explanation} />

      <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
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
