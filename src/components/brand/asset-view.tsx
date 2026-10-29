import { ActorChip } from "@/components/actor-chip";
import { Chip } from "@/components/ui";
import { PRACTICE_LABEL } from "@/lib/brand/practice";
import type { AssetCheck, DriftKind } from "@/lib/brand/types";

const DRIFT: Record<DriftKind, string> = {
  symbol: "Symbol",
  lettering: "Lettering",
  color: "Colors",
  layout: "Layout",
  extra: "Something added",
  other: "Other",
};

export function PracticeTag() {
  return <Chip tone="warn">{PRACTICE_LABEL}</Chip>;
}

// Who made it: Muse, or a practice stand-in that must never pass for a drawing
export function MadeBy({ simulated, what = "Drawn by Meta’s Muse Image" }: { simulated: boolean; what?: string }) {
  if (simulated) return <PracticeTag />;
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
      <ActorChip actor="ai" /> {what}
    </span>
  );
}

// What AI found when it read the file, and the reminder to read it yourself
export function CheckNotes({ check, simulated, checking }: { check: AssetCheck | null; simulated: boolean; checking?: boolean }) {
  if (simulated) return <p className="text-sm text-muted">Practice preview: no picture was drawn, so there’s nothing to check.</p>;
  if (!check) return <p className="text-sm text-muted">{checking ? "AI is checking the spelling…" : "Not checked. Read it yourself before you use it."}</p>;
  if (check.method === "skipped") return <p className="text-sm text-check">The AI set up here can’t read pictures, so the spelling wasn’t checked. Read it yourself before you use it.</p>;
  if (check.method === "failed") return <p className="text-sm text-check">The spelling check didn’t work this time. Read it yourself before you use it.</p>;

  const problems = [...(check.lettering?.problems ?? []), ...check.drift.map((flag) => `${DRIFT[flag.kind]}: ${flag.detail}`)];
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {problems.length ? (
        <div className="rounded-xl border border-check-ring bg-check-tint px-3.5 py-3 text-check">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <ActorChip actor="ai" /> Check this before you use it
          </p>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-rule">
          <ActorChip actor="ai" />
          {check.lettering && check.lettering.read.length ? `AI read “${check.lettering.read.join(" ")}”, which matches.` : "AI found no problems."}
        </p>
      )}
      {check.lettering?.note ? <p className="text-muted">{check.lettering.note}</p> : null}
      <p className="text-muted">AI can miss mistakes, so read it yourself too.</p>
    </div>
  );
}
