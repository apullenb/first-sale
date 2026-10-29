"use client";

import { useId, useLayoutEffect, useState } from "react";
import { reviewPlanAction } from "@/app/(app)/checklist/actions";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";
import { Chip, IconTile } from "@/components/ui";
import type { PlanChange } from "@/lib/rules/plan";

const KIND = { added: "New step", removed: "No longer in the plan", changed: "Changed" } as const;

// The owner picks which changes from a re-check to take; done steps are never lost
export function ReviewChanges({ checkedAt, changes, from = "recheck" }: { checkedAt: string; changes: PlanChange[]; from?: "recheck" | "replan" }) {
  const uid = useId();
  // Removing a step deletes it, so removals start unticked
  const [accepted, setAccepted] = useState<Set<string>>(
    () => new Set(changes.filter((change) => change.kind !== "removed").map((change) => change.key)),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function submit(keys: string[]) {
    setPending(true);
    setError(null);
    try {
      const result = await reviewPlanAction({ checkedAt, acceptedKeys: keys });
      if (!result.ok) setError(result.message);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${uid}-title`} className="flex flex-col gap-3.5 rounded-2xl border border-accent-ring bg-surface p-5 shadow-[0_0_0_4px_var(--color-accent-tint),var(--shadow-card)] sm:p-6">
      <div className="flex items-center gap-3">
        <IconTile icon="refresh" />
        <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">Needs your OK</p>
      </div>
      <h2 id={`${uid}-title`} className="font-display text-[22px] leading-snug">
        {from === "replan" ? "Your decisions changed. Review the changes to your plan." : "Your requirements were re-checked. Review the changes."}
      </h2>
      <p className="text-muted">Pick the changes to make to your plan. Steps you’ve finished stay finished either way.</p>
      <ul className="flex flex-col gap-2">
        {changes.map((change) => (
          <li key={change.key}>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line-strong bg-surface px-3.5 py-3 shadow-soft transition hover:border-muted has-checked:border-accent has-checked:shadow-[0_0_0_3px_var(--color-accent-tint)] motion-reduce:transition-none">
              <input
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-accent"
                checked={accepted.has(change.key)}
                onChange={(event) =>
                  setAccepted((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(change.key);
                    else next.delete(change.key);
                    return next;
                  })
                }
              />
              <span className="flex min-w-0 flex-col gap-1">
                <Chip tone={change.kind === "added" ? "accent" : "gray"} icon={change.kind === "added" ? "plus" : change.kind === "removed" ? "minus" : "pencil"}>
                  {KIND[change.kind]}
                </Chip>
                <span className="font-semibold">{change.title}</span>
                {change.kind === "changed" ? <span className="text-sm text-rule">What changed: {change.what.join(", ")}</span> : null}
                {change.kind === "removed" && change.done ? (
                  <span className="text-sm text-rule">You’ve submitted or finished this one. It stays in your records, with its notes and documents.</span>
                ) : null}
                {change.kind === "removed" && !change.done ? (
                  <span className="text-sm text-rule">
                    Ticking this deletes the step. Documents linked to it stay in your library, without the link.
                  </span>
                ) : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2.5">
        <button type="button" disabled={pending} onClick={() => submit([...accepted])} className={PRIMARY}>
          {pending ? "Saving…" : `Make ${accepted.size} ${accepted.size === 1 ? "change" : "changes"}`}
        </button>
        <button type="button" disabled={pending} onClick={() => submit([])} className={SECONDARY}>
          Keep my plan as it is
        </button>
      </div>
    </section>
  );
}
