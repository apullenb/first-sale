"use client";

import { useId, useState } from "react";
import { INPUT } from "@/components/styles";

export interface ComboOption {
  value: string;
  label: string;
  detail?: string;
}

const MAX_SHOWN = 8;

// Labels that start with the typed text first, then ones containing it
export function matchOptions(options: readonly ComboOption[], query: string): ComboOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options.slice(0, MAX_SHOWN);
  const starts = options.filter((option) => option.label.toLowerCase().startsWith(q));
  const contains = options.filter((option) => !option.label.toLowerCase().startsWith(q) && option.label.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, MAX_SHOWN);
}

// Type to search, then pick with a click or the arrow keys. With `free`, typed text is kept as the answer.
export function Combobox({
  id,
  value,
  onType,
  onPick,
  options,
  free = false,
  placeholder,
  describedBy,
  invalid,
  maxLength = 100,
}: {
  id: string;
  value: string;
  onType: (text: string) => void;
  onPick: (option: ComboOption) => void;
  options: readonly ComboOption[];
  free?: boolean;
  placeholder?: string;
  describedBy?: string;
  invalid?: boolean;
  maxLength?: number;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const shown = matchOptions(options, value);
  const expanded = open && shown.length > 0;

  function pick(option: ComboOption) {
    onPick(option);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onType(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        // After a click on an option has landed
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((current) => Math.min(shown.length - 1, current + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((current) => Math.max(0, current - 1));
          } else if (e.key === "Enter" && expanded && active >= 0) {
            e.preventDefault();
            pick(shown[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Enter" && expanded && !free && shown.length === 1) {
            e.preventDefault();
            pick(shown[0]);
          }
        }}
        className={INPUT}
      />
      <ul
        id={listId}
        role="listbox"
        hidden={!expanded}
        className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg bg-surface py-1 shadow-lg ring-1 ring-ink/10"
      >
        {shown.map((option, index) => (
          <li
            key={option.value}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            // Keeps focus in the box so the pick lands before blur closes the list
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(option)}
            className={`flex min-h-11 cursor-pointer flex-col justify-center px-3 py-2 ${index === active ? "bg-accent-tint" : "hover:bg-ground"}`}
          >
            <span className="font-semibold">{option.label}</span>
            {option.detail ? <span className="text-sm text-muted">{option.detail}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
