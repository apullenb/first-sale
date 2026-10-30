import { Fragment, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { LABEL } from "@/components/marketing/pieces";
import { TEXT_LINK } from "@/components/styles";
import { Chip } from "@/components/ui";
import { RecommendedBadge } from "@/components/recommended";
import { comparePlan, type CostLine, costSummary, firstYearText, lower, usd } from "@/lib/website/costs";
import type { OptionExplanation } from "@/lib/website/options";
import type { PlatformInfo } from "@/lib/website/platforms";
import { packageTerms, TERM_LABELS } from "@/lib/website/terms";
import { ChoosePlatformButton } from "./choose-platform";
import { ExplainOption } from "./explain-option";
import { StatusChip, TERM_ICONS, TermTile } from "./term-marks";

const MARKS = {
  good: { icon: "check", tile: "border-accent-ring bg-accent-tint text-accent" },
  bad: { icon: "minus", tile: "border-line bg-wash text-muted" },
  plain: { icon: "dot", tile: "border-line bg-wash text-muted" },
} as const;

export function List({ title, items, tone }: { title?: string; items: ReactNode[]; tone: keyof typeof MARKS }) {
  const mark = MARKS[tone];
  return (
    <div className="flex flex-col gap-1.5">
      {title ? <p className={LABEL}>{title}</p> : null}
      <ul className="flex flex-col gap-1.5 text-[15px] text-rule">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2">
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

// One package in the same shape as the others, so they compare row by row
export function PlatformCard({
  platform,
  recommended,
  chosen,
  explanation,
}: {
  platform: PlatformInfo;
  recommended: { reasons: string[] } | null;
  chosen: boolean;
  explanation: OptionExplanation | null;
}) {
  const id = `platform-${platform.id}`;
  const plan = comparePlan(platform);
  const otherPlans = platform.plans.filter((each) => each !== plan);
  return (
    <article
      aria-labelledby={id}
      className={`row-span-5 grid grid-rows-subgrid gap-y-4 rounded-[14px] border bg-surface p-5 ${chosen ? "border-accent shadow-[0_0_0_3px_var(--color-accent-tint),var(--shadow-card)]" : "border-line shadow-card"}`}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={id} className="mr-auto font-display text-[24px] leading-tight">
            {platform.name}
          </h3>
          {platform.demoPrice ? (
            <Chip tone="warn" icon="info">
              Demo
            </Chip>
          ) : null}
          {recommended ? <RecommendedBadge /> : null}
          {chosen ? (
            <Chip tone="done" icon="check">
              Your choice
            </Chip>
          ) : null}
        </div>
        <p className="text-rule">{platform.oneLine}</p>
        <p className="text-sm text-muted">Best for {platform.bestFor}.</p>
        {recommended ? (
          <details className="group/why">
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 font-semibold text-accent [&::-webkit-details-marker]:hidden">
              <Icon name="chevron" size="sm" className="transition-transform group-open/why:rotate-90" />
              Explain why
            </summary>
            <div className="flex flex-col gap-2 rounded-xl border border-pick-ring bg-pick-tint/70 px-3.5 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-pick-ink">
                From your answers about what you sell and how
              </p>
              <List items={recommended.reasons} tone="good" />
            </div>
          </details>
        ) : null}
      </div>

      <AtAGlance platform={platform} />

      <div className="flex flex-col self-start rounded-xl border border-line px-3.5">
        <Expander icon="check" title="What you get" count={platform.includes.length}>
          <List items={platform.includes} tone="good" />
        </Expander>
        <Expander icon="pencil" title="What you do yourself" count={platform.youDo.length}>
          <List
            tone="plain"
            items={platform.youDo.map((task) => (
              <Fragment key={task.text}>
                {task.text}
                {task.inApp ? (
                  <>
                    {" "}
                    <a href={task.inApp.href} className={`${TEXT_LINK} whitespace-nowrap text-sm`}>
                      {task.inApp.label}
                    </a>
                  </>
                ) : null}
              </Fragment>
            ))}
          />
        </Expander>
        <Expander icon="info" title="Things to know" count={platform.thingsToKnow.length + otherPlans.length + 1}>
          <List
            tone="bad"
            items={[
              ...platform.thingsToKnow,
              platform.cardFeeNote,
              ...otherPlans.map((plan) => (
                <Fragment key={plan.name}>
                  <strong>{plan.name}</strong>, {plan.price}: {plan.adds}
                </Fragment>
              )),
            ]}
          />
          <div className="mt-3">
            <ExplainOption optionKey={`platform:${platform.id}`} name={platform.name} explanation={explanation} firstYear={firstYearText(platform)} />
          </div>
        </Expander>
      </div>

      <CostSummaryBox platform={platform} />

      <div className="flex flex-col gap-2 self-end border-t border-line pt-4">
        <ChoosePlatformButton
          platform={platform.id}
          name={platform.name}
          chosen={chosen}
          payment={platform.demoPrice ? { plan: plan.name, price: `${usd(plan.monthlyUsd)} a month` } : undefined}
        />
        <p className="text-sm text-muted">
          {platform.demoPrice ? "The First Sale price is a demo price, not final. Card fees from " : `Prices from ${platform.name}’s own pages, `}
          {platform.sources.map((source, index) => (
            <span key={source.url}>
              {index ? ", " : ""}
              <a href={source.url} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                {source.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </span>
          ))}
          , checked <LocalDate iso={`${platform.checkedOn}T12:00:00Z`} />. Prices change, so check before you sign up.
        </p>
      </div>
    </article>
  );
}

function AtAGlance({ platform }: { platform: PlatformInfo }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={LABEL}>At a glance</p>
      <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
        {packageTerms(platform).map((row) => (
          <li key={row.term} className="flex items-start gap-3 px-3.5 py-2.5">
            <TermTile term={row.term} status={row.status} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="font-semibold">{TERM_LABELS[row.term]}</span>
                <StatusChip status={row.status} />
              </div>
              <p className="text-sm text-rule">{row.note}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Expander({ icon, title, count, children }: { icon: IconName; title: string; count: number; children: ReactNode }) {
  return (
    <details className="group/x border-t border-line first:border-t-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 py-2 [&::-webkit-details-marker]:hidden">
        <Icon name={icon} size="sm" className="text-accent" />
        <span className="flex-1 font-semibold">{title}</span>
        <span className="text-sm text-muted">{count}</span>
        <Icon name="chevron" size="sm" className="text-faint transition-transform group-open/x:rotate-90" />
      </summary>
      <div className="pb-3.5">{children}</div>
    </details>
  );
}

function amountText(line: CostLine, extra: boolean): ReactNode {
  const { amount } = line;
  switch (amount.kind) {
    case "monthly":
      return `${extra ? "+" : ""}${usd(amount.usd)} a month${amount.billing === "yearly" ? `, billed yearly (${usd(amount.usd * 12)})` : ""}`;
    case "once":
      return `${amount.from ? "from " : ""}${usd(amount.usd)}${amount.per ? ` a ${amount.per}` : ""}`;
    case "free_first_year":
      return "Free the first year";
    case "per_sale":
      return amount.text;
    case "unknown":
      return <span className="font-normal text-muted">{amount.text}</span>;
  }
}

function CostRow({ line, extra }: { line: CostLine; extra: boolean }) {
  const later = line.amount.kind === "free_first_year" ? line.amount.later : null;
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 py-2">
      <dt className="flex min-w-0 flex-1 basis-48 items-start gap-2 text-[15px] text-rule">
        <Icon name={line.term ? TERM_ICONS[line.term] : "receipt"} size="sm" className="mt-[3px] text-muted" />
        <span>
          {line.label}
          {later ? <span className="block text-sm text-muted">Then {later}</span> : null}
        </span>
      </dt>
      <dd className="ml-6 flex flex-col items-start text-[15px] font-semibold sm:ml-0 sm:items-end sm:text-right">
        <span className={line.counted ? "" : "text-rule"}>{amountText(line, extra)}</span>
        {line.counted ? null : <span className="text-[13px] font-normal text-muted">Not in the total</span>}
      </dd>
    </div>
  );
}

// Plan names keep their capitals; other lines read mid-sentence
const say = (line: CostLine) => (line.term ? lower(line.label) : line.label);

// The plan, each extra as a line, then totals worked out in code, all for the same need
function CostSummaryBox({ platform }: { platform: PlatformInfo }) {
  const costs = costSummary(platform);
  const from = costs.from ? "from " : "";
  const lines = [costs.base, ...costs.extras];
  const counted = lines.filter((line) => line.counted && line.amount.kind !== "unknown");
  const left = lines.filter((line) => !line.counted);
  return (
    <section aria-label={`${platform.name} cost summary`} className="flex flex-col gap-1 self-start rounded-xl border border-line bg-soft px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={LABEL}>Cost summary</p>
        {platform.demoPrice ? (
          <Chip tone="warn" icon="info">
            Demo price
          </Chip>
        ) : null}
      </div>
      <p className="text-sm text-muted">Priced for your own web address and taking card payments.</p>
      <p className="pt-1.5 text-sm font-bold text-muted">Plan</p>
      <dl className="flex flex-col divide-y divide-line/70">
        <CostRow line={costs.base} extra={false} />
        {costs.monthToMonth ? <CostRow line={costs.monthToMonth} extra={false} /> : null}
      </dl>
      <p className="border-t border-line pt-2 text-sm font-bold text-muted">Additional costs</p>
      <dl className="flex flex-col divide-y divide-line/70">
        {costs.extras.map((line) => (
          <CostRow key={line.label} line={line} extra />
        ))}
      </dl>
      <div className="mt-1 flex flex-col gap-1.5 border-t-2 border-ink/80 pt-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-bold">Total</p>
          <p className="flex flex-wrap items-baseline justify-end gap-x-3 text-right">
            <span>
              <strong className="text-lg">{usd(costs.monthlyUsd)}</strong>{" "}
              <span className="text-sm text-muted">a month{costs.upFrontUsd !== null ? ", billed yearly" : ""}</span>
            </span>
            <span>
              <strong className="text-lg">
                {from}
                {usd(costs.firstYearUsd)}
              </strong>{" "}
              <span className="text-sm text-muted">first year</span>
            </span>
          </p>
        </div>
        <p className="text-sm text-muted">
          <strong className="font-semibold text-rule">In the total:</strong> {counted.map(say).join(", ")}.{" "}
          <strong className="font-semibold text-rule">Not in the total:</strong> {left.map((line) => `${say(line)} (${line.whyNot})`).join("; ")}.
        </p>
      </div>
    </section>
  );
}
