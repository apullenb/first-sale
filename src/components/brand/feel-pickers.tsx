"use client";

import { useId } from "react";
import type { Leanings } from "@/lib/brand/types";
import { COLOR_FAMILIES, type ColorFamily, LEANINGS, type LeaningKey, MAX_COLOR_FAMILIES, VIBE_GROUPS, VIBE_LIMITS, type Vibe } from "@/lib/brand/vibes";

const CHIP =
  "min-h-11 rounded-full border px-4 py-2 text-[15px] font-semibold transition-colors aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white disabled:cursor-not-allowed disabled:opacity-45 border-field bg-surface hover:border-muted";
const CHOICE =
  "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-field bg-surface px-3 py-2 text-center text-[15px] font-semibold has-checked:border-accent has-checked:bg-accent-tint has-checked:text-accent-ink has-focus-visible:ring-2 has-focus-visible:ring-accent";

// One click per word; the count stays between the limits
export function VibePicker({ picked, onToggle }: { picked: Vibe[]; onToggle: (vibe: Vibe) => void }) {
  const full = picked.length >= VIBE_LIMITS.max;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted" aria-live="polite">
        {picked.length < VIBE_LIMITS.min
          ? `Pick at least ${VIBE_LIMITS.min}, up to ${VIBE_LIMITS.max}. ${picked.length} picked.`
          : `${picked.length} picked${full ? `, the most you can pick` : ""}.`}
      </p>
      {(Object.keys(VIBE_GROUPS) as (keyof typeof VIBE_GROUPS)[]).map((group) => (
        <div key={group} role="group" aria-label={group} className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-rule">{group}</h4>
          <div className="flex flex-wrap gap-2">
            {VIBE_GROUPS[group].map((vibe) => {
              const on = picked.includes(vibe);
              return (
                <button
                  key={vibe}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => onToggle(vibe)}
                  className={CHIP}
                >
                  {vibe}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeaningPicker({ value, onChange }: { value: Leanings; onChange: (next: Leanings) => void }) {
  const uid = useId();
  return (
    <div className="flex flex-col gap-4">
      {(Object.keys(LEANINGS) as LeaningKey[]).map((key) => {
        const options = LEANINGS[key].options as Record<string, string>;
        const choices: [string | null, string][] = [...Object.entries(options).slice(0, 1), [null, "Either"], ...Object.entries(options).slice(1)];
        return (
          <fieldset key={key} className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold">{LEANINGS[key].question}</legend>
            <div className="grid grid-cols-3 gap-2">
              {choices.map(([choice, label]) => (
                <label key={label} className={CHOICE}>
                  <input
                    type="radio"
                    name={`${uid}-${key}`}
                    checked={value[key] === choice}
                    onChange={() => onChange({ ...value, [key]: choice })}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

export function ColorPicker({ picked, onToggle }: { picked: ColorFamily[]; onToggle: (family: ColorFamily) => void }) {
  const full = picked.length >= MAX_COLOR_FAMILIES;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">Optional. Pick up to {MAX_COLOR_FAMILIES}; the exact colors come with each logo idea.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(Object.keys(COLOR_FAMILIES) as ColorFamily[]).map((family) => {
          const on = picked.includes(family);
          return (
            <button
              key={family}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onToggle(family)}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-field bg-surface px-3 py-2 text-left text-[15px] font-semibold hover:border-muted aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent-ink disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span aria-hidden="true" className="flex shrink-0">
                {COLOR_FAMILIES[family].map((hex) => (
                  <span key={hex} className="-mr-1.5 size-6 rounded-full ring-2 ring-surface" style={{ backgroundColor: hex }} />
                ))}
              </span>
              <span className="pl-1.5">{family}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
