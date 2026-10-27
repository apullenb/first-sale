"use client";

import { useId, useState } from "react";
import { recordDecisionsAction } from "@/app/(app)/structure/actions";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";
import { DETAILS, displayDetail, STRUCTURE_LABELS } from "@/lib/details";
import type { BusinessStructure } from "@/lib/domain";

type Values = { structure_choice: string; name_registration_plan: string; tax_classification_plan: string };
type Key = keyof Values;

const KEYS: Key[] = ["structure_choice", "name_registration_plan", "tax_classification_plan"];

// The owner's own decision: pick, see exactly what will be recorded and what it touches, then confirm
export function DecisionForm({
  current,
  suggested,
  owners,
  basis,
  stale,
  recordedAt,
}: {
  current: Values;
  suggested: BusinessStructure;
  owners: number;
  basis: string[];
  // Recorded with answers that have changed since, so it can be confirmed again unchanged
  stale: boolean;
  // When the structure was last recorded
  recordedAt: string | null;
}) {
  const uid = useId();
  // One owner can't be a partnership, and several can't be a sole proprietorship
  const fits = (option: string) => (owners === 1 ? option !== "partnership" : option !== "sole_proprietorship");
  // A recorded structure that no longer fits the owners has to be chosen again
  const [values, setValues] = useState<Values>({ ...current, structure_choice: fits(current.structure_choice) ? current.structure_choice : "" });
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const structures = (Object.keys(STRUCTURE_LABELS) as (BusinessStructure | "undecided")[]).filter(fits);
  const options: Record<Key, [string, string][]> = {
    structure_choice: structures.map((option) => [option, STRUCTURE_LABELS[option]]),
    name_registration_plan: DETAILS.name_registration_plan.options.map(([v, l]) => [v, l]),
    tax_classification_plan: DETAILS.tax_classification_plan.options.map(([v, l]) => [v, l]),
  };
  const complete = KEYS.every((key) => values[key]);
  const changed = KEYS.filter((key) => values[key] !== current[key]);

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const result = await recordDecisionsAction(values);
      if (!result.ok) setError(result.message);
      else {
        setDone(true);
        setConfirming(false);
      }
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${uid}-title`} className="flex flex-col gap-4 rounded-2xl bg-surface p-5 ring-1 ring-ink/5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id={`${uid}-title`} className="font-display text-2xl font-bold">
          Your decision
        </h2>
        <ActorChip actor="owner" />
      </div>
      {recordedAt ? (
        <p className="text-[15px] text-rule">
          Last recorded <LocalDate iso={recordedAt} />. Each change is kept in your decision history below.
        </p>
      ) : null}
      {!confirming ? (
        <>
          {KEYS.map((key) => (
            <fieldset key={key} className="flex flex-col gap-2">
              <legend className="mb-1 font-bold">{DETAILS[key].label}</legend>
              <p className="text-[15px] text-rule">{DETAILS[key].help}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {options[key].map(([value, label]) => (
                  <label
                    key={value}
                    className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl bg-surface px-3.5 py-2.5 ring-1 ring-ink/10 has-checked:bg-accent-tint has-checked:ring-2 has-checked:ring-accent"
                  >
                    <input
                      type="radio"
                      name={`${uid}-${key}`}
                      value={value}
                      checked={values[key] === value}
                      onChange={() => {
                        setValues({ ...values, [key]: value });
                        setDone(false);
                      }}
                      className="size-5 shrink-0 accent-accent"
                    />
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {label}
                      {key === "structure_choice" && value === suggested ? (
                        <span className="rounded-full bg-accent-tint px-2 py-0.5 text-xs font-bold text-accent-ink">Suggested</span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="flex flex-col items-start gap-2">
            <button type="button" onClick={() => setConfirming(true)} disabled={!complete || (!changed.length && !stale)} className={PRIMARY}>
              {!changed.length && stale ? "Keep it with my new answers" : "Review my decision"}
            </button>
            <p role="status" className={done ? "text-sm font-semibold text-accent-ink" : "sr-only"}>
              {done ? "Recorded. You can change it any time, and the history keeps each change." : ""}
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="font-bold">You’re about to record</h3>
          <ul className="flex flex-col gap-1.5">
            {KEYS.map((key) => (
              <li key={key} className="text-[15px]">
                <span className="font-semibold">{DETAILS[key].label}:</span> {displayDetail(key, values[key])}
                {changed.includes(key) ? (
                  <span className="ml-1.5 text-sm text-muted">(was {current[key] ? displayDetail(key, current[key]) : "not decided"})</span>
                ) : null}
              </li>
            ))}
          </ul>
          <h3 className="font-bold">Based on these answers</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-rule">
            {basis.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h3 className="font-bold">What this does</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-rule">
            <li>Saves it as your decision. Your startup plan’s structure step and your forms can use it.</li>
            <li>Files nothing. Forming a company or registering a name is a step you take yourself.</li>
            <li>Keeps a dated record, with these answers, in your history.</li>
          </ul>
          {error ? (
            <p role="alert" className={ALERT}>
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={confirm} disabled={pending} className={PRIMARY}>
              {pending ? "Saving…" : "Confirm and record"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={SECONDARY}>
              Go back
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
