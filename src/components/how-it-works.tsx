import type { Actor } from "@/lib/domain";
import { ActorChip } from "./actor-chip";

const ROWS: { actor: Actor; text: string }[] = [
  { actor: "ai", text: "drafts listings and replies" },
  { actor: "rule", text: "handle stock, money and steps" },
  { actor: "owner", text: "approve what goes out" },
];

// Sidebar card on wider screens
export function HowItWorks() {
  return (
    <div className="hidden flex-col gap-2.5 rounded-xl bg-surface p-3.5 ring-1 ring-ink/5 md:flex">
      <p className="text-[13px] font-bold text-rule">How First Sale works</p>
      {ROWS.map((row) => (
        <div key={row.actor} className="flex items-center gap-2 text-sm">
          <ActorChip actor={row.actor} />
          <span>{row.text}</span>
        </div>
      ))}
    </div>
  );
}

// Same key inline, for phones where the sidebar card is hidden
export function ActorLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm md:hidden">
      {ROWS.map((row) => (
        <span key={row.actor} className="flex items-center gap-2">
          <ActorChip actor={row.actor} />
          {row.text}
        </span>
      ))}
    </div>
  );
}
