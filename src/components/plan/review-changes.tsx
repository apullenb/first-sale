"use client";

import { useId, useLayoutEffect, useState } from "react";
import { reviewPlanAction } from "@/app/(app)/checklist/actions";
import { PRIMARY, SECONDARY } from "@/components/styles";
import type { PlanChange } from "@/lib/rules/plan";

const KIND = { added: "New step", removed: "No longer in the plan", changed: "Changed" } as const;

// The owner picks which changes from a re-check to take; done steps are never lost
export function ReviewChanges({ checkedAt, changes }: { checkedAt: string; changes: PlanChange[] }) {
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
    <section aria-labelledby={`${uid}-title`} className="flex flex-col gap-3 rounded-2xl bg-ai-tint p-5 ring-1 ring-ai/15">
      <h2 id={`${uid}-title`} className="font-display text-xl font-bold text-ai-ink">
        Your requirements were re-checked. Review the changes.
      </h2>
      <p className="text-ai-ink">Pick the changes to make to your plan. Steps you’ve finished stay finished either way.</p>
      <ul className="flex flex-col gap-2">
        {changes.map((change) => (
          <li key={change.key}>
            <label className="flex min-h-11 items-start gap-3 rounded-xl bg-surface px-3.5 py-3 ring-1 ring-ink/5">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-accent"
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
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-muted">{KIND[change.kind]}</span>
                <span className="font-semibold">{change.title}</span>
                {change.kind === "changed" ? <span className="text-sm text-rule">What changed: {change.what.join(", ")}</span> : null}
                {change.kind === "removed" && change.done ? (
                  <span className="text-sm text-rule">You finished this one. It stays in your records.</span>
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
        <p role="alert" className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
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
