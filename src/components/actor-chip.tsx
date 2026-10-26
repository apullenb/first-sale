import type { Actor } from "@/lib/domain";

const LABELS: Record<Actor, string> = { ai: "AI", rule: "Rules", owner: "You" };

const STYLES: Record<Actor, string> = {
  ai: "bg-ai-tint text-ai",
  rule: "bg-rule-tint text-rule",
  owner: "bg-accent-tint text-accent-ink",
};

export function ActorChip({ actor }: { actor: Actor }) {
  return (
    <span className={`inline-block min-w-13 rounded-full px-2 py-0.5 text-center text-xs font-bold ${STYLES[actor]}`}>
      {LABELS[actor]}
    </span>
  );
}
