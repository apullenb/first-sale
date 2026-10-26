// Toggle buttons for intake answers: chips for pick-many, cards for pick-one.

function CheckIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const ON = "border-accent bg-accent-tint text-accent-ink";
const OFF = "border-field bg-surface hover:border-muted";

interface ChoiceProps<T extends string> {
  options: [T, string][];
  labelledBy: string;
  describedBy?: string;
}

export function ChoiceChips<T extends string>({
  options,
  selected,
  onToggle,
  labelledBy,
  describedBy,
}: ChoiceProps<T> & { selected: readonly T[]; onToggle: (value: T) => void }) {
  return (
    <div role="group" aria-labelledby={labelledBy} aria-describedby={describedBy} className="flex flex-wrap gap-2">
      {options.map(([value, label]) => {
        const on = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(value)}
            className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[15px] font-semibold ${on ? ON : OFF}`}
          >
            {on ? <CheckIcon /> : null}
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
}: ChoiceProps<T> & { selected: T | ""; onSelect: (value: T) => void }) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5"
    >
      {options.map(([value, label]) => {
        const on = selected === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(value)}
            className={`flex min-h-16 items-center gap-2 rounded-xl border-2 px-4 py-3 text-left font-semibold ${on ? ON : OFF}`}
          >
            {on ? <CheckIcon /> : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AiSuggestionBadge() {
  return <span className="rounded-full bg-ai-tint px-2.5 py-0.5 text-[13px] font-bold text-ai">AI suggestion</span>;
}
