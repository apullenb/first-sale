"use client";

import { AI_BUTTON, INPUT, SECONDARY } from "@/components/styles";
import type { BusinessCategory, OFFERING_KINDS } from "@/lib/domain";
import type { IntakeAnswers, Mark } from "@/lib/intake/answers";
import { CATEGORIES, CATEGORY_GROUPS, categoryFor } from "@/lib/intake/catalog";
import { entries, OFFERING_KIND_LABELS } from "@/lib/intake/options";
import { CategoryIcon } from "./category-icon";
import { ChoiceChips } from "./choices";
import { MarkBadge } from "./question-block";

type OfferingKind = (typeof OFFERING_KINDS)[number];

const EXAMPLE =
  "I bake cakes and bread at home in Austin, Texas and want to sell at the Saturday farmers market and on Instagram.";

// Placeholder for "anything else", by kind of business
const SPECIALTY: Record<OfferingKind, string> = {
  food: "lemon loaves",
  handmade: "walnut serving trays",
  resale: "plus-size denim",
  services: "wedding photos",
  other: "dog grooming kits",
};

const ON = "border-accent bg-accent-tint text-accent-ink";
const OFF = "border-field bg-surface hover:border-muted";

// Pick a kind of business, then click examples of what you'll sell. Describing it in words is optional.
export function SellStep({
  id,
  answers,
  marks,
  onCategory,
  onToggleTag,
  onToggleKind,
  onFirstItems,
  onDescription,
  onFill,
  aiPending,
  aiNote,
  errorId,
}: {
  id: (name: string) => string;
  answers: IntakeAnswers;
  marks: Partial<Record<keyof IntakeAnswers, Mark>>;
  onCategory: (category: BusinessCategory) => void;
  onToggleTag: (tag: string) => void;
  onToggleKind: (kind: OfferingKind) => void;
  onFirstItems: (text: string) => void;
  onDescription: (text: string) => void;
  onFill: () => void;
  aiPending: boolean;
  aiNote: { text: string; error: boolean } | null;
  errorId?: string;
}) {
  const category = categoryFor(answers.category);
  const otherKinds = entries(OFFERING_KIND_LABELS).filter(([kind]) => kind !== category?.kind);

  return (
    // Locked while AI reads the description, so its answers can't replace a click made meanwhile
    <fieldset disabled={aiPending} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
      <div role="group" aria-labelledby={id("question")} aria-describedby={errorId} className="flex flex-col gap-4">
        {[...CATEGORY_GROUPS, "Other" as const].map((group) => (
          <div key={group} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{group}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
              {CATEGORIES.filter((c) => c.group === group).map((c) => {
                const on = answers.category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onCategory(c.id)}
                    className={`flex min-h-16 items-center gap-3 rounded-xl border-2 px-3.5 py-3 text-left ${on ? ON : OFF}`}
                  >
                    <CategoryIcon name={c.icon} />
                    <span className="flex flex-col">
                      <span className="font-semibold">{c.label}</span>
                      <span className="text-sm text-rule">{c.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {marks.category ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <MarkBadge mark={marks.category} /> Picked from your description. Change it if it’s wrong.
        </p>
      ) : null}

      {category && category.examples.length ? (
        <div className="flex flex-col gap-2.5 rounded-xl bg-ground p-4">
          <h2 id={id("examples")} className="text-[19px] font-bold">
            What will you sell? Pick any.
          </h2>
          <ChoiceChips
            labelledBy={id("examples")}
            options={category.examples.map((example) => [example.id, example.label] as [string, string])}
            selected={answers.productTags}
            onToggle={onToggleTag}
          />
        </div>
      ) : null}

      {category?.id === "other" ? (
        <div className="flex flex-col gap-2.5 rounded-xl bg-ground p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id={id("kinds")} className="text-[19px] font-bold">
              What kind of thing is it? Pick any.
            </h2>
            <MarkBadge mark={marks.offeringKinds} />
          </div>
          <ChoiceChips labelledBy={id("kinds")} describedBy={errorId} options={entries(OFFERING_KIND_LABELS)} selected={answers.offeringKinds} onToggle={onToggleKind} />
        </div>
      ) : null}

      {category ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("first-items")} className="font-semibold">
            {category.id === "other" ? "What will you sell, in a few words?" : "Anything else, or your specialty? (optional)"}
          </label>
          <input
            id={id("first-items")}
            type="text"
            maxLength={100}
            value={answers.firstItems}
            onChange={(e) => onFirstItems(e.target.value)}
            placeholder={`For example: ${SPECIALTY[category.kind ?? "other"]}`}
            className={INPUT}
          />
        </div>
      ) : null}

      {category && category.id !== "other" ? (
        <details className="text-[15px]" open={answers.offeringKinds.some((kind) => kind !== category.kind) || undefined}>
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent-ink underline underline-offset-4">
            Also selling something of a different kind?
          </summary>
          <div className="flex flex-col gap-2 pt-1">
            <p id={id("more-kinds")} className="text-rule">
              Pick any that also apply.
            </p>
            <ChoiceChips labelledBy={id("more-kinds")} options={otherKinds} selected={answers.offeringKinds} onToggle={onToggleKind} />
          </div>
        </details>
      ) : null}

      <details className="rounded-xl bg-ground px-4 py-1 text-[15px]" open={Boolean(answers.description) || undefined}>
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">
          Prefer to describe it in your own words? (optional)
        </summary>
        <div className="flex flex-col gap-2.5 pb-3">
          <p className="text-rule">A sentence is plenty. AI can use it to suggest answers, and you confirm each one.</p>
          <label htmlFor={id("describe")} className="font-semibold">
            Your idea
          </label>
          <textarea
            id={id("describe")}
            rows={3}
            maxLength={1000}
            value={answers.description}
            onChange={(e) => onDescription(e.target.value)}
            readOnly={aiPending}
            placeholder={`For example: ${EXAMPLE}`}
            className="w-full resize-y rounded-xl border border-field bg-surface p-3 text-base"
          />
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={onFill} disabled={aiPending || !answers.description.trim()} className={AI_BUTTON}>
              {aiPending ? "Reading your description…" : "Suggest answers from this"}
            </button>
            <button type="button" onClick={() => onDescription(EXAMPLE)} disabled={aiPending || Boolean(answers.description.trim())} className={SECONDARY}>
              Use the example
            </button>
          </div>
          {aiNote ? (
            <p role="status" className={`rounded-xl px-3.5 py-3 ${aiNote.error ? "bg-check-tint text-check" : "bg-ai-tint text-ai-ink"}`}>
              {aiNote.text}
            </p>
          ) : null}
        </div>
      </details>
    </fieldset>
  );
}
