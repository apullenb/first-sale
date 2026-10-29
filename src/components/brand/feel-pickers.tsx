"use client";

import { type ReactNode, useId } from "react";
import { CONCEPT_KINDS_TEXT } from "@/lib/brand/prompts";
import { CONCEPT_KINDS, type ConceptKind, type Leanings } from "@/lib/brand/types";
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

// Simple outlines of each kind, not real logos
function KindSketch({ kind }: { kind: ConceptKind }) {
  const bar = (x: number, w: number) => <rect x={x} y="17" width={w} height="6" rx="3" fill="currentColor" />;
  const shapes: Record<ConceptKind, ReactNode> = {
    wordmark: (
      <>
        {bar(6, 36)}
        <path d="M6 28 q18 6 36 0" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    ),
    monogram: (
      <>
        <circle cx="13" cy="20" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M9 24 v-8 l4 5 l4 -5 v8" stroke="currentColor" strokeWidth="2" fill="none" />
        {bar(26, 18)}
      </>
    ),
    emblem: (
      <>
        <rect x="5" y="7" width="38" height="26" rx="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
        {bar(12, 24)}
      </>
    ),
    illustrative: (
      <>
        <path d="M6 28 c4 -14 10 -14 14 0 M13 28 v-6" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {bar(24, 20)}
      </>
    ),
    abstract: (
      <>
        <rect x="7" y="12" width="12" height="12" rx="2" transform="rotate(45 13 18)" fill="currentColor" />
        {bar(24, 20)}
      </>
    ),
    lettermark_symbol: (
      <>
        <path d="M7 28 v-16 h7 a5 5 0 0 1 0 10 h-7" stroke="currentColor" strokeWidth="2.5" fill="none" />
        <circle cx="19" cy="11" r="3" fill="currentColor" />
        {bar(26, 18)}
      </>
    ),
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 48 40" className="h-10 w-12 shrink-0">
      {shapes[kind]}
    </svg>
  );
}

const KIND_CARD =
  "flex min-h-14 items-center gap-3 rounded-lg border border-field bg-surface px-3 py-2 text-left text-[15px] hover:border-muted aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent-ink";

// Any number of kinds; none picked means a mix
export function LogoKindPicker({ picked, onChange }: { picked: ConceptKind[]; onChange: (kinds: ConceptKind[]) => void }) {
  return (
    <div role="group" aria-label="Kinds of logo" className="flex flex-col gap-2">
      <p className="text-sm text-muted">Optional. Pick the kinds you’d like to see, or leave it on a mix to see different kinds.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" aria-pressed={picked.length === 0} onClick={() => onChange([])} className={KIND_CARD}>
          <span aria-hidden="true" className="flex h-10 w-12 shrink-0 items-center justify-center text-2xl font-bold">
            ?
          </span>
          <span className="flex flex-col">
            <span className="font-semibold">Show me a mix</span>
            <span className="text-sm text-muted">Different kinds, so you can compare</span>
          </span>
        </button>
        {CONCEPT_KINDS.map((kind) => {
          const on = picked.includes(kind);
          return (
            <button key={kind} type="button" aria-pressed={on} onClick={() => onChange(on ? picked.filter((each) => each !== kind) : [...picked, kind])} className={KIND_CARD}>
              <KindSketch kind={kind} />
              <span className="flex flex-col">
                <span className="font-semibold">{CONCEPT_KINDS_TEXT[kind].label}</span>
                <span className="text-sm text-muted">{CONCEPT_KINDS_TEXT[kind].plain}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
