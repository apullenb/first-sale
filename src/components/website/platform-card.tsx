import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { TEXT_LINK } from "@/components/styles";
import { Chip } from "@/components/ui";
import { RecommendedBadge } from "@/components/recommended";
import type { BudgetShare } from "@/lib/website/budget";
import type { OptionExplanation } from "@/lib/website/options";
import type { PlatformInfo } from "@/lib/website/platforms";
import { ChoosePlatformButton } from "./choose-platform";
import { LABEL } from "@/components/marketing/pieces";

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


export function PlatformCard({ platform, recommended, chosen }: {
  platform: PlatformInfo;
  recommended: { reasons: string[] } | null;
  chosen: boolean;
  share: BudgetShare | null;
  explanation: OptionExplanation | null;
}) {
  const id = `platform-${platform.id}`;
  const comingSoon = platform.id === "wix" || platform.id === "shopify";
  if (comingSoon) return <article aria-labelledby={id} className="relative flex min-h-[330px] overflow-hidden rounded-2xl border border-line bg-wash p-6 text-faint">
    <h3 id={id} className="font-display text-[28px]">{platform.name}</h3>
    <div className="absolute inset-0 grid place-items-center"><span className="-rotate-12 rounded-lg border-2 border-muted/40 px-7 py-3 text-xl font-bold uppercase tracking-[.15em] text-muted">Coming Soon</span></div>
  </article>;
  const here = platform.id === "first_sale";
  return <article aria-labelledby={id} className={`flex min-h-[330px] flex-col gap-5 rounded-2xl border bg-surface p-6 shadow-card ${chosen ? "border-accent ring-2 ring-accent-tint" : "border-line"}`}>
    <div className="flex flex-wrap items-center gap-2"><Icon name={here ? "sparkles" : "store"} className="text-accent" /><h3 id={id} className="mr-auto font-display text-[28px]">{platform.name}</h3>{chosen ? <Chip tone="done" icon="check">Your choice</Chip> : recommended ? <RecommendedBadge /> : null}</div>
    <p className="text-lg leading-relaxed text-ink">{here ? "A beautiful, simple site built right here." : "Your Square storefront, connected to SnapStart."}</p>
    <ul className="flex flex-col gap-2 text-[15px] text-muted">
      {(here ? ["Three professionally designed templates", "Your brand, products and payment links", "Edit and preview everything in SnapStart"] : ["Square handles your store and checkout", "Import products into your SnapStart library", "Review and push product updates when ready"]).map((item) => <li key={item} className="flex gap-2"><Icon name="check" size="sm" className="mt-0.5 shrink-0 text-accent" />{item}</li>)}
    </ul>
    {!here ? <p className="rounded-xl bg-soft px-4 py-3 text-sm text-rule">Set up your site on Square first. Then connect it here to manage supported product details through SnapStart.</p> : <p className="text-sm text-muted">Start with a full-screen preview. Hosting and payment setup come later.</p>}
    <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-4"><ChoosePlatformButton platform={platform.id} name={platform.name} chosen={chosen} primary={here} />{!here ? <a href="https://squareup.com/us/en/online-store" target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>Visit Square <span aria-hidden="true">↗</span></a> : null}</div>
  </article>;
}
