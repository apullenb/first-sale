"use client";

import { useId, useState } from "react";
import { SECONDARY } from "@/components/styles";
import { STRUCTURE_LABELS } from "@/lib/details";
import type { BusinessProfile } from "@/lib/domain";
import { applyWhatIf, suggestPath, type PathSuggestion, type WhatIf } from "@/lib/structure/suggest";

type Toggle = { key: string; label: string; change: WhatIf };

function togglesFor(p: BusinessProfile): Toggle[] {
  const toggles: Toggle[] = [
    p.owners.count === 1
      ? { key: "owners", label: "Add a co-owner", change: { owners: 2 } }
      : { key: "owners", label: "Only one owner", change: { owners: 1 } },
    p.takesOnDebt === "yes"
      ? { key: "debt", label: "No lease or loan", change: { takesOnDebt: "no" } }
      : { key: "debt", label: "Sign a lease or loan", change: { takesOnDebt: "yes" } },
    p.helpKinds.includes("employees") || p.hiringPlans === "right_away"
      ? { key: "employees", label: "No employees", change: { employees: false } }
      : { key: "employees", label: "Hire an employee", change: { employees: true } },
  ];
  if (p.premises === "home") {
    toggles.push(
      p.customersVisit === "yes"
        ? { key: "visits", label: "No customers at home", change: { customersVisit: "no" } }
        : { key: "visits", label: "Customers come to your home", change: { customersVisit: "yes" } },
    );
  }
  return toggles;
}

// Compare suggestions for a changed situation without touching the saved answers
export function WhatIfPanel({ profile }: { profile: BusinessProfile }) {
  const uid = useId();
  const [on, setOn] = useState<string[]>([]);
  const toggles = togglesFor(profile);
  const whatIf = Object.assign({}, ...toggles.filter((t) => on.includes(t.key)).map((t) => t.change)) as WhatIf;
  const now = suggestPath(profile);
  const then = suggestPath(applyWhatIf(profile, whatIf));

  return (
    <section aria-labelledby={`${uid}-title`} className="flex flex-col gap-4 rounded-2xl bg-surface p-5 ring-1 ring-ink/5">
      <div className="flex flex-col gap-1">
        <h2 id={`${uid}-title`} className="font-display text-2xl font-bold">
          Try a what-if
        </h2>
        <p className="text-rule">See how the suggestion would change. Nothing here changes your saved answers.</p>
      </div>
      <div role="group" aria-labelledby={`${uid}-title`} className="flex flex-wrap gap-2">
        {toggles.map((toggle) => {
          const pressed = on.includes(toggle.key);
          return (
            <button
              key={toggle.key}
              type="button"
              aria-pressed={pressed}
              onClick={() => setOn(pressed ? on.filter((k) => k !== toggle.key) : [...on, toggle.key])}
              className={`min-h-11 rounded-full border px-3.5 py-2 text-[15px] font-semibold ${pressed ? "border-ai bg-ai-tint text-ai-ink" : "border-field bg-surface hover:border-muted"}`}
            >
              {pressed ? <span aria-hidden="true">✓ </span> : null}
              {toggle.label}
            </button>
          );
        })}
        {on.length ? (
          <button type="button" onClick={() => setOn([])} className={SECONDARY}>
            Back to my answers
          </button>
        ) : null}
      </div>
      {on.length ? (
        <div aria-live="polite" className="grid gap-3 md:grid-cols-2">
          <Result title="With your saved answers" path={now} />
          <Result title="With this what-if" path={then} compare={now} whatIf />
        </div>
      ) : (
        <p aria-live="polite" className="text-[15px] text-muted">
          Pick a change above to compare.
        </p>
      )}
    </section>
  );
}

function Result({ title, path, compare, whatIf }: { title: string; path: PathSuggestion; compare?: PathSuggestion; whatIf?: boolean }) {
  const changed = (a: string, b: string | undefined) => compare !== undefined && a !== b;
  return (
    <div className={`flex flex-col gap-2 rounded-xl p-4 ${whatIf ? "bg-ai-tint/40 ring-1 ring-ai/30" : "bg-ground"}`}>
      <h3 className="font-bold">{title}</h3>
      <p>
        <span className="font-semibold">Suggested: </span>
        {STRUCTURE_LABELS[path.option]}
        {changed(path.option, compare?.option) ? <Badge /> : null}
      </p>
      <p className="text-[15px] text-rule">{path.headline}</p>
      <p className="text-[15px]">
        <span className="font-semibold">Name: </span>
        {path.name.text}
        {changed(path.name.text, compare?.name.text) ? <Badge /> : null}
      </p>
      <p className="text-[15px]">
        <span className="font-semibold">Taxes: </span>
        {path.tax.text}
        {changed(path.tax.text, compare?.tax.text) ? <Badge /> : null}
      </p>
    </div>
  );
}

function Badge() {
  return <span className="ml-1.5 rounded-full bg-ai-tint px-2 py-0.5 text-xs font-bold text-ai">Changes</span>;
}
