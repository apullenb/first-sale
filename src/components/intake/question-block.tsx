"use client";

import type { ReactNode } from "react";
import type { IntakeAnswers, Mark } from "@/lib/intake/answers";
import type { QuestionSpec } from "@/lib/intake/questions";
import { AiSuggestionBadge, ChoiceCards, ChoiceChips } from "./choices";

// One click-to-answer question: why it's asked, help when the owner isn't sure, and unfamiliar words explained.

export function MarkBadge({ mark }: { mark: Mark | undefined }) {
  if (mark === "ai") return <AiSuggestionBadge />;
  if (mark === "default") {
    return <span className="rounded-full bg-rule-tint px-2.5 py-0.5 text-[13px] font-bold text-rule">Filled in from your answers</span>;
  }
  return null;
}

export function QuestionBlock({
  spec,
  answers,
  mark,
  id,
  onChange,
  describedBy,
}: {
  spec: QuestionSpec;
  answers: IntakeAnswers;
  mark: Mark | undefined;
  id: string;
  onChange: (field: QuestionSpec["field"], value: string | string[]) => void;
  describedBy?: string;
}) {
  const value = answers[spec.field] as string | string[];
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const options = spec.options(answers);
  const unsurePicked = selected.includes("unsure");
  const questionId = `${id}-question`;
  const whyId = `${id}-why`;

  function toggle(option: string) {
    if (!spec.multiple) {
      onChange(spec.field, value === option ? "" : option);
      return;
    }
    const list = value as string[];
    if (list.includes(option)) onChange(spec.field, list.filter((v) => v !== option));
    else if (option === spec.exclusive) onChange(spec.field, [option]);
    else onChange(spec.field, [...list.filter((v) => v !== spec.exclusive), option]);
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-rule-tint pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id={questionId} className="text-[19px] font-bold leading-snug">
          {spec.title(answers)}
        </h2>
        <MarkBadge mark={mark} />
      </div>
      <p id={whyId} className="text-[15px] text-rule">
        {spec.multiple ? "Pick any that fit. " : ""}
        <span className="font-semibold">Why we ask:</span> {spec.why}
      </p>
      {spec.cards ? (
        <ChoiceCards
          labelledBy={questionId}
          describedBy={[whyId, describedBy].filter(Boolean).join(" ")}
          options={options}
          descriptions={spec.descriptions}
          selected={selected[0] ?? ""}
          onSelect={toggle}
        />
      ) : (
        <ChoiceChips labelledBy={questionId} describedBy={[whyId, describedBy].filter(Boolean).join(" ")} options={options} selected={selected} onToggle={toggle} />
      )}
      {spec.unsure ? <UnsureHelp open={unsurePicked} explain={spec.unsure.explain} tips={spec.unsure.tips} /> : null}
      {spec.terms?.length ? <Terms terms={spec.terms} /> : null}
    </div>
  );
}

// Always open once "Not sure" is picked; otherwise one click away
export function UnsureHelp({ open, explain, tips }: { open: boolean; explain: string; tips: string[] }) {
  const body: ReactNode = (
    <>
      <p>{explain}</p>
      {tips.length ? (
        <ul className="list-disc pl-5">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ) : null}
      <p className="font-semibold">“Not sure” stays an open question. We never read it as “no”.</p>
    </>
  );
  if (open) {
    return (
      <div role="status" className="flex flex-col gap-1.5 rounded-xl bg-check-tint px-4 py-3 text-[15px] text-check">
        {body}
      </div>
    );
  }
  return (
    <details className="group text-[15px]">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent-ink underline underline-offset-4">Help me answer</summary>
      <div className="flex flex-col gap-1.5 rounded-xl bg-ground px-4 py-3 text-rule">{body}</div>
    </details>
  );
}

export function Terms({ terms }: { terms: [string, string][] }) {
  return (
    <details className="text-[15px]">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent-ink underline underline-offset-4">What these words mean</summary>
      <dl className="flex flex-col gap-2 rounded-xl bg-ground px-4 py-3">
        {terms.map(([term, meaning]) => (
          <div key={term}>
            <dt className="font-semibold">{term}</dt>
            <dd className="text-rule">{meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
