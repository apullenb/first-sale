"use client";

import { Icon } from "@/components/icons";
import { AI_BUTTON, INPUT, SECONDARY } from "@/components/styles";
import { Fold } from "@/components/ui";
import type { BusinessCategory, OFFERING_KINDS } from "@/lib/domain";
import type { IntakeAnswers, Mark } from "@/lib/intake/answers";
import { CATEGORIES, CATEGORY_GROUPS, categoryFor } from "@/lib/intake/catalog";
import { entries, OFFERING_KIND_LABELS } from "@/lib/intake/options";
import { CategoryIcon } from "./category-icon";
import { ChoiceTiles, TILE, TILE_OFF, TILE_ON } from "./choices";
import { MarkBadge, MoreDetails, QUESTION_TITLE } from "./question-block";

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
    <fieldset disabled={aiPending} className="m-0 flex min-w-0 flex-col gap-7 border-0 p-0">
      <div className="flex flex-col gap-3">
        <div role="group" aria-labelledby={id("question")} aria-describedby={errorId} className="flex flex-col gap-4">
          {[...CATEGORY_GROUPS, "Other" as const].map((group) => (
            <div key={group} className="flex flex-col gap-2">
              <h2 className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-muted">{group}</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
                {CATEGORIES.filter((c) => c.group === group).map((c) => {
                  const on = answers.category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onCategory(c.id)}
                      className={`${TILE} min-h-[62px] w-full items-center px-3 py-2.5 font-semibold ${on ? TILE_ON : TILE_OFF}`}
                    >
                      <span
                        className={`grid size-[38px] shrink-0 place-items-center rounded-[10px] border ${on ? "border-accent-ring bg-accent-tint text-accent" : "border-line bg-wash text-rule"}`}
                      >
                        <CategoryIcon name={c.icon} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span>{c.label}</span>
                        <span className="text-sm font-normal text-muted">{c.hint}</span>
                      </span>
                      {on ? (
                        <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-white">
                          <Icon name="check" size="xs" strokeWidth={3} className="pen-draw" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {marks.category ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <MarkBadge mark={marks.category} /> Picked from your description. Change it if it’s wrong.
          </p>
        ) : null}
      </div>

      {category && category.examples.length ? (
        <div className="flex flex-col gap-2.5">
          <h2 id={id("examples")} className={QUESTION_TITLE}>
            What will you sell? Pick any.
          </h2>
          <ChoiceTiles
            labelledBy={id("examples")}
            options={category.examples.map((example) => [example.id, example.label] as [string, string])}
            selected={answers.productTags}
            onToggle={onToggleTag}
          />
        </div>
      ) : null}

      {category?.id === "other" ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id={id("kinds")} className={QUESTION_TITLE}>
              What kind of thing is it? Pick any.
            </h2>
            <MarkBadge mark={marks.offeringKinds} />
          </div>
          <ChoiceTiles labelledBy={id("kinds")} describedBy={errorId} options={entries(OFFERING_KIND_LABELS)} selected={answers.offeringKinds} onToggle={onToggleKind} />
        </div>
      ) : null}

      {category ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id("first-items")} className="text-[15.5px] font-semibold">
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
        <MoreDetails summary="Also selling something of a different kind?" open={answers.offeringKinds.some((kind) => kind !== category.kind) || undefined}>
          <div className="flex flex-col gap-2 pt-1">
            <p id={id("more-kinds")} className="text-rule">
              Pick any that also apply.
            </p>
            <ChoiceTiles labelledBy={id("more-kinds")} options={otherKinds} selected={answers.offeringKinds} onToggle={onToggleKind} />
          </div>
        </MoreDetails>
      ) : null}

      <Fold icon="sparkles" title="Prefer to describe it in your own words?" summary="Optional. AI can suggest answers for you to check." open={Boolean(answers.description) || undefined}>
        <p className="text-[15px] text-rule">A sentence is plenty. AI can use it to suggest answers, and you confirm each one.</p>
        <label htmlFor={id("describe")} className="text-[15.5px] font-semibold">
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
          className={`${INPUT} resize-y`}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={onFill} disabled={aiPending || !answers.description.trim()} className={AI_BUTTON}>
            <Icon name="sparkles" size="sm" />
            {aiPending ? "Reading your description…" : "Suggest answers from this"}
          </button>
          <button type="button" onClick={() => onDescription(EXAMPLE)} disabled={aiPending || Boolean(answers.description.trim())} className={SECONDARY}>
            Use the example
          </button>
        </div>
        {aiNote ? (
          <p
            role="status"
            className={`rounded-xl border px-3.5 py-3 text-[15px] ${aiNote.error ? "border-check-ring bg-check-tint text-check" : "border-ai/20 bg-ai-tint text-ai-ink"}`}
          >
            {aiNote.text}
          </p>
        ) : null}
      </Fold>
    </fieldset>
  );
}
