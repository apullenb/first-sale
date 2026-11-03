import { createContext, useContext, useId, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Chip } from "@/components/ui";

// Click-to-answer tiles: a round dot for pick-one, a drawn check for pick-many

// Shape only: callers add width, alignment, padding and weight
export const TILE = "flex gap-3 rounded-xl border bg-surface text-left leading-snug shadow-soft transition disabled:cursor-not-allowed disabled:opacity-60";
export const TILE_ON = "border-accent ring-3 ring-accent-tint";
export const TILE_OFF = "border-line-strong hover:border-muted";
const GRID = "grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]";

export function TileMark({ on, multiple }: { on: boolean; multiple: boolean }) {
  if (multiple) {
    return (
      <span
        aria-hidden="true"
        className={`grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] text-white ${on ? "border-accent bg-accent" : "border-line-strong bg-surface"}`}
      >
        {on ? <Icon name="check" size="xs" strokeWidth={3} className="pen-draw" /> : null}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`block size-[18px] shrink-0 rounded-full border-[1.5px] ${on ? "border-accent bg-accent shadow-[inset_0_0_0_4px_white]" : "border-line-strong bg-surface"}`}
    />
  );
}

interface ChoiceProps<T extends string> {
  options: [T, string][];
  labelledBy: string;
  describedBy?: string;
}

export function ChoiceTiles<T extends string>({
  options,
  selected,
  onToggle,
  labelledBy,
  describedBy,
  multiple = true,
}: ChoiceProps<T> & { selected: readonly T[]; onToggle: (value: T) => void; multiple?: boolean }) {
  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className={GRID}>
      {options.map(([value, label]) => {
        const on = selected.includes(value);
        return (
          <button key={value} type="button" aria-pressed={on} onClick={() => onToggle(value)} className={`${TILE} min-h-[50px] w-full items-center px-3.5 py-2.5 font-semibold ${on ? TILE_ON : TILE_OFF}`}>
            <TileMark on={on} multiple={multiple} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ChoiceCards<T extends string>({
  options,
  selected,
  onSelect,
  labelledBy,
  describedBy,
  descriptions,
}: ChoiceProps<T> & { selected: T | ""; onSelect: (value: T) => void; descriptions?: Partial<Record<T, string>> }) {
  const uid = useId();
  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className={GRID}>
      {options.map(([value, label]) => {
        const on = selected === value;
        const description = descriptions?.[value];
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(value)}
            aria-labelledby={description ? `${uid}-${value}` : undefined}
            aria-describedby={description ? `${uid}-${value}-about` : undefined}
            className={`${TILE} min-h-14 w-full px-3.5 font-semibold ${description ? "items-start py-3" : "items-center py-2.5"} ${on ? TILE_ON : TILE_OFF}`}
          >
            <span className={`flex shrink-0 ${description ? "mt-0.5" : ""}`}>
              <TileMark on={on} multiple={false} />
            </span>
            {description ? (
              <span className="flex flex-col gap-0.5">
                <span id={`${uid}-${value}`}>{label}</span>
                <span id={`${uid}-${value}-about`} className="text-sm font-normal text-muted">
                  {description}
                </span>
              </span>
            ) : (
              label
            )}
          </button>
        );
      })}
    </div>
  );
}

// A single yes-or-no tick, drawn as a tile
export function CheckTile({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`${TILE} min-h-[50px] w-fit cursor-pointer items-center px-3.5 py-2.5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${checked ? TILE_ON : TILE_OFF}`}
    >
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <TileMark on={checked} multiple />
      {children}
    </label>
  );
}

// True when the suggestions came from practice-mode word matching rather than AI
export const PracticeSuggestions = createContext(false);

export function AiSuggestionBadge() {
  const practice = useContext(PracticeSuggestions);
  return (
    <Chip icon="sparkles" tone="ai">
      {practice ? "Practice suggestion" : "AI suggestion"}
    </Chip>
  );
}

// Alias for the marketing intake
export const ChoiceChips = ChoiceTiles;
