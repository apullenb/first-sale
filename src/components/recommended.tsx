import type { ReactNode } from "react";
import { Icon } from "./icons";
import { IconTile } from "./ui";

// The one look for First Sale's recommendations, so owners learn to spot it: soft violet with a lightbulb

export function RecommendedBadge({ children = "Recommended for you" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border border-pick-ring bg-pick-tint px-3 py-1.5 text-[13.5px] font-bold leading-none text-pick-ink">
      <Icon name="lightbulb" size="xs" strokeWidth={2.2} />
      {children}
    </span>
  );
}

// A recommendation with room to explain it, such as the suggested structure
export function RecommendedPanel({ eyebrow, children, big = false }: { eyebrow: string; children: ReactNode; big?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-pick-ring bg-pick-tint/70 p-4">
      {big ? <IconTile icon="lightbulb" tone="pick" /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.08em] text-pick-ink">
          {big ? null : <Icon name="lightbulb" size="xs" strokeWidth={2.2} />}
          {eyebrow}
        </p>
        {children}
      </div>
    </div>
  );
}

// Background for a recommended column or card, so the pick stands out at a glance
export const RECOMMENDED_FILL = "bg-pick-tint/70";
export const RECOMMENDED_BORDER = "border-pick-ring";
