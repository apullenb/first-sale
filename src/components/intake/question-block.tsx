"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Chip } from "@/components/ui";
import type { IntakeAnswers, Mark } from "@/lib/intake/answers";
import { isOptional, type QuestionSpec } from "@/lib/intake/questions";
import { AiSuggestionBadge, ChoiceCards, ChoiceTiles } from "./choices";

// One click-to-answer question: why it's asked, help when the owner isn't sure, and unfamiliar words explained.

export const QUESTION_TITLE = "font-display text-[21px] leading-snug";

export function MarkBadge({ mark }: { mark: Mark | undefined }) {
  if (mark === "ai") return <AiSuggestionBadge />;
  if (mark === "default") return <Chip tone="gray">Filled in from your answers</Chip>;
  return null;
}

// The "Why we ask" line under a question
export function WhyLine({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-2 text-[15px] text-muted">
      <Icon name="info" size="sm" className="mt-[3px] text-accent" />
      <span>{children}</span>
    </p>
  );
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
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id={questionId} className={QUESTION_TITLE}>
          {spec.title(answers)}
        </h2>
        {isOptional(spec) ? <Chip tone="gray">Optional</Chip> : null}
        <MarkBadge mark={mark} />
      </div>
      <WhyLine id={whyId}>
        {spec.multiple ? "Pick any that fit. " : ""}
        <b className="font-bold text-rule">Why we ask:</b> {spec.why}
      </WhyLine>
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
        <ChoiceTiles
          labelledBy={questionId}
          describedBy={[whyId, describedBy].filter(Boolean).join(" ")}
          options={options}
          selected={selected}
          onToggle={toggle}
          multiple={Boolean(spec.multiple)}
        />
      )}
      {spec.unsure ? <UnsureHelp open={unsurePicked} explain={spec.unsure.explain} tips={spec.unsure.tips} /> : null}
      {spec.terms?.length ? <Terms terms={spec.terms} /> : null}
    </div>
  );
}

const SUMMARY = "flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 font-semibold text-accent hover:text-accent-ink [&::-webkit-details-marker]:hidden";
const SOFT_BOX = "flex flex-col gap-1.5 rounded-xl border border-line bg-soft px-4 py-3 text-rule";

// A text-link toggle that opens a soft box underneath
export function MoreDetails({ summary, open, children }: { summary: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="group text-[15px]" open={open}>
      <summary className={SUMMARY}>
        <Icon name="chevron" size="sm" className="transition-transform group-open:rotate-90" />
        <span className="underline decoration-[1.5px] underline-offset-[3px]">{summary}</span>
      </summary>
      {children}
    </details>
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
      <div role="status" className="flex items-start gap-2.5 rounded-xl border border-check-ring bg-check-tint px-3.5 py-3 text-[15px] text-check">
        <Icon name="question" className="mt-0.5" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">{body}</div>
      </div>
    );
  }
  return (
    <MoreDetails summary="Help me answer">
      <div className={SOFT_BOX}>{body}</div>
    </MoreDetails>
  );
}

export function Terms({ terms }: { terms: [string, string][] }) {
  return (
    <MoreDetails summary="What these words mean">
      <dl className={SOFT_BOX}>
        {terms.map(([term, meaning]) => (
          <div key={term}>
            <dt className="font-semibold text-ink">{term}</dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>
    </MoreDetails>
  );
}
