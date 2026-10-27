"use client";

import { useId, useLayoutEffect, useState } from "react";
import { saveDetailAction } from "@/app/(app)/business/actions";
import { ActorChip } from "@/components/actor-chip";
import { ALERT, CARD, PRIMARY, SECTION_TITLE } from "@/components/styles";
import { STRUCTURE_LABELS } from "@/lib/details";

type Structure = keyof typeof STRUCTURE_LABELS;

const OPTIONS = Object.keys(STRUCTURE_LABELS) as Structure[];

const EXPLAIN: Record<Structure, string> = {
  sole_proprietorship:
    "You and the business are legally the same. There’s no separate filing to form one, but you may still need to register a business name.",
  llc: "A separate legal business you form by filing with your state, which charges a fee. It can help protect your personal savings from business debts.",
  partnership: "Two or more people own the business together, without forming an LLC or corporation.",
  corporation: "A separate legal business with more paperwork and formal rules. It’s usually for businesses raising money from investors.",
  undecided: "That’s fine. You can come back and choose later.",
};

function isStructure(value: string | null): value is Structure {
  return value !== null && Object.hasOwn(STRUCTURE_LABELS, value);
}

// The owner's own decision, saved with their business details
export function StructureDecision({ current }: { current: string | null }) {
  const uid = useId();
  const saved = isStructure(current) ? current : null;
  // Null until the owner picks; kept until the page hides, so it can't flicker back while saving
  const [picked, setPicked] = useState<Structure | null>(null);
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(
    () => () => {
      setPicked(null);
      setError(null);
      setJustSaved(false);
    },
    [],
  );

  const choice = picked ?? saved;

  async function save() {
    if (!choice) return;
    setPending(true);
    setError(null);
    setJustSaved(false);
    try {
      const result = await saveDetailAction({ key: "structure_choice", value: choice });
      if (!result.ok) setError(result.message);
      else setJustSaved(true);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${uid}-title`} className={`flex flex-col gap-3 ${CARD}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id={`${uid}-title`} className={SECTION_TITLE}>
          Your decision
        </h2>
        <ActorChip actor="owner" />
      </div>
      <p className="text-rule">{saved ? `You chose: ${STRUCTURE_LABELS[saved]}.` : "You haven’t chosen a structure yet."}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Which structure fits your business?</legend>
        {OPTIONS.map((option) => (
          <label
            key={option}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-surface px-3.5 py-3 ring-1 ring-ink/10 has-checked:ring-2 has-checked:ring-accent"
          >
            <input
              type="radio"
              name={`${uid}-structure`}
              value={option}
              checked={choice === option}
              onChange={() => {
                setPicked(option);
                setJustSaved(false);
              }}
              className="mt-1 size-5 shrink-0 accent-accent"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">{STRUCTURE_LABELS[option]}</span>
              <span className="text-sm text-rule">{EXPLAIN[option]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted">Not sure? A small business counselor, accountant or lawyer can help you decide.</p>
      <div className="flex flex-col items-start gap-2">
        <button type="button" onClick={save} disabled={pending || !choice || choice === saved} className={PRIMARY}>
          {pending ? "Saving…" : "Save my choice"}
        </button>
        {/* Always rendered, so screen readers announce the change */}
        <p role="status" className={justSaved ? "text-sm font-semibold text-accent-ink" : "sr-only"}>
          {justSaved ? "Saved. You can change it any time." : ""}
        </p>
        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
