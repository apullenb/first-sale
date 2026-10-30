"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { draftBusinessPlanAction } from "@/app/(app)/documents/actions";
import { Icon } from "@/components/icons";
import { PICKS, PickTile, Why } from "@/components/marketing/pieces";
import { AI_BUTTON, ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { Card, Chip } from "@/components/ui";
import { Working } from "@/components/working";
import {
  FACT_GROUPS,
  type FactGroup,
  type KnownFact,
  MAX_FACT,
  MAX_OTHER,
  type PlanAnswer,
  type PlanAnswers,
  type PlanQuestion,
  planQuestions,
  type QuestionBasis,
  UNSURE,
  withOverrides,
} from "@/lib/documents/plan-facts";

interface Props {
  facts: KnownFact[];
  basis: QuestionBasis;
  initial: { picks: PlanAnswers; overrides: Record<string, string> };
  hasDraft: boolean;
}

const LINK = "font-semibold text-accent underline decoration-[1.5px] underline-offset-[3px] hover:text-accent-ink";

// What the plan is drafted from: facts First Sale knows, which the owner can change for this plan, and the questions it still asks
export function PlanInputs({ facts, basis, initial, hasDraft }: Props) {
  const [overrides, setOverrides] = useState(initial.overrides);
  const [picks, setPicks] = useState<PlanAnswers>(initial.picks);
  const [status, setStatus] = useState<"idle" | "drafting">("idle");
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  const questions = useMemo(() => planQuestions(basis, picks), [basis, picks]);
  const answered = questions.filter((question) => isAnswered(picks[question.key])).length;

  async function draft() {
    if (hasDraft && !window.confirm("Drafting again replaces the plan below, including your edits to it. Continue?")) return;
    setStatus("drafting");
    setError(null);
    try {
      const shown = Object.fromEntries(questions.flatMap((question) => (picks[question.key] ? [[question.key, picks[question.key]]] : [])));
      const result = await draftBusinessPlanAction({ picks: shown, overrides });
      if (!result.ok) setError(result.message);
      else requestAnimationFrame(() => document.getElementById("plan-review-heading")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    }
    setStatus("idle");
  }

  return (
    <>
      <KnownFacts facts={facts} overrides={overrides} onChange={setOverrides} />

      <Card
        title="A few questions"
        icon="question"
        id="plan-questions-heading"
        action={questions.length ? <Chip tone={answered === questions.length ? "accent" : "gray"}>{`${answered} of ${questions.length} answered`}</Chip> : null}
      >
        {questions.length ? (
          <>
            <p className="text-rule">
              Only what your plan needs that First Sale doesn’t know yet. Pick what fits, or choose Other to say it your way. Anything you skip becomes a note in
              the draft for you to fill in.
            </p>
            <div className="flex flex-col divide-y divide-line">
              {questions.map((question) => (
                <QuestionField
                  key={question.key}
                  question={question}
                  answer={picks[question.key]}
                  onChange={(answer) => setPicks((current) => ({ ...current, [question.key]: answer }))}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="text-rule">First Sale already has what your plan needs. Check the facts above, then draft your plan.</p>
        )}

        <div className="flex flex-col items-start gap-2 border-t border-line pt-5">
          <button type="button" onClick={draft} disabled={status === "drafting"} className={AI_BUTTON}>
            <Icon name="sparkles" size="sm" />
            {status === "drafting" ? "Drafting your plan…" : hasDraft ? "Draft my plan again" : "Draft my plan"}
          </button>
          {status === "drafting" ? null : (
            <p className="text-[14.5px] text-muted">Writes a formal business plan from the facts and answers above. Nothing is shared or sent.</p>
          )}
          <Working label="Writing your business plan. This can take a minute or two." active={status === "drafting"} />
          {error ? (
            <p role="alert" className={ALERT}>
              {error}
            </p>
          ) : null}
        </div>
      </Card>
    </>
  );
}

function isAnswered(answer: PlanAnswer | undefined): boolean {
  return Boolean(answer && (answer.picks.length || answer.other?.trim()));
}

// --- Facts First Sale already has

function KnownFacts({ facts, overrides, onChange }: { facts: KnownFact[]; overrides: Record<string, string>; onChange: (next: Record<string, string>) => void }) {
  const shown = withOverrides(facts, overrides);
  const groups = (Object.keys(FACT_GROUPS) as FactGroup[]).map((group) => ({ group, facts: shown.filter((fact) => fact.group === group) })).filter((group) => group.facts.length);

  function set(key: string, value: string | null) {
    const next = { ...overrides };
    if (value === null) delete next[key];
    else next[key] = value;
    onChange(next);
  }

  return (
    <Card title="What First Sale already knows" icon="clipboard" id="plan-known-heading" action={<Chip tone="gray">{`${facts.length} filled in`}</Chip>}>
      <p className="text-rule">
        Filled in from what you’ve already told First Sale. Use the pencil to change anything for this plan. Your saved answers elsewhere stay as they are.
      </p>
      <div className="flex flex-col gap-5">
        {groups.map(({ group, facts: list }) => (
          <section key={group} aria-labelledby={`known-${group}`} className="flex flex-col">
            <h3 id={`known-${group}`} className="border-b border-line pb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-muted">
              {FACT_GROUPS[group]}
            </h3>
            <dl className="flex flex-col">
              {list.map((fact) => (
                <FactRow
                  key={fact.key}
                  fact={fact}
                  saved={facts.find((each) => each.key === fact.key)?.value ?? fact.value}
                  onSave={(value) => set(fact.key, value)}
                  onReset={() => set(fact.key, null)}
                />
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Card>
  );
}

function FactRow({ fact, saved, onSave, onReset }: { fact: KnownFact & { edited: boolean }; saved: string; onSave: (value: string) => void; onReset: () => void }) {
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(fact.value);
  const pencil = useRef<HTMLButtonElement>(null);

  function close() {
    setEditing(false);
    requestAnimationFrame(() => pencil.current?.focus());
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-b border-line py-3 last:border-b-0 sm:grid-cols-[11rem_minmax(0,1fr)_auto]">
      <dt id={`${uid}-label`} className="pt-0.5 text-[15px] text-muted">
        {fact.label}
      </dt>
      <dd className="col-span-2 row-start-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1 sm:col-start-2 sm:row-start-1">
        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = text.trim();
              if (!value || value === saved) onReset();
              else onSave(value);
              close();
            }}
          >
            <textarea
              aria-labelledby={`${uid}-label`}
              autoFocus
              rows={Math.min(5, Math.max(2, Math.ceil(text.length / 60)))}
              maxLength={MAX_FACT}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className={`${INPUT} resize-y`}
            />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={`${PRIMARY} min-h-11!`}>
                Use for my plan
              </button>
              <button
                type="button"
                className={SECONDARY}
                onClick={() => {
                  setText(fact.value);
                  close();
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <span className="font-semibold leading-snug break-words">{fact.value}</span>
        )}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted">
          {fact.edited ? (
            <>
              <span className="inline-flex items-center gap-1 font-semibold text-accent-ink">
                <Icon name="pencil" size="xs" />
                Changed for this plan
              </span>
              <button
                type="button"
                className={`${LINK} min-h-11 sm:min-h-0`}
                onClick={() => {
                  setText(saved);
                  onReset();
                }}
              >
                Use the saved answer
              </button>
            </>
          ) : (
            <Link href={fact.href} className="underline decoration-line-strong underline-offset-2 hover:text-accent">
              {fact.source}
            </Link>
          )}
        </span>
      </dd>
      {editing ? null : (
        <button
          ref={pencil}
          type="button"
          onClick={() => {
            setText(fact.value);
            setEditing(true);
          }}
          className="col-start-2 row-start-1 -my-1.5 inline-grid size-11 place-items-center rounded-[10px] text-muted transition hover:bg-soft hover:text-accent sm:col-start-3"
          aria-label={`Change ${fact.label.toLowerCase()} for this plan`}
        >
          <Icon name="pencil" size="sm" />
        </button>
      )}
    </div>
  );
}

// --- One question: options to click, and Other to type

function QuestionField({ question, answer, onChange }: { question: PlanQuestion; answer: PlanAnswer | undefined; onChange: (answer: PlanAnswer) => void }) {
  const uid = useId();
  const picks = answer?.picks ?? [];
  const otherOn = answer?.other !== null && answer?.other !== undefined;
  const otherRef = useRef<HTMLInputElement>(null);

  function toggle(value: string) {
    const on = picks.includes(value);
    if (!question.multiple) {
      onChange({ picks: on ? [] : [value], other: null });
      return;
    }
    if (on) onChange({ picks: picks.filter((pick) => pick !== value), other: answer?.other ?? null });
    else if (value === UNSURE) onChange({ picks: [UNSURE], other: null });
    else onChange({ picks: [...picks.filter((pick) => pick !== UNSURE), value], other: answer?.other ?? null });
  }

  function toggleOther() {
    if (otherOn) {
      onChange({ picks, other: null });
      return;
    }
    onChange({ picks: question.multiple ? picks.filter((pick) => pick !== UNSURE) : [], other: "" });
    requestAnimationFrame(() => otherRef.current?.focus());
  }

  return (
    <div className="flex flex-col gap-3 py-5 first:pt-1 last:pb-1">
      <h3 id={`${uid}-q`} className="font-display text-[20px] leading-snug">
        {question.title}
      </h3>
      <Why id={`${uid}-why`}>
        {question.multiple ? "Pick any that fit. " : ""}
        {question.why}
      </Why>
      <div role="group" aria-labelledby={`${uid}-q`} aria-describedby={`${uid}-why`} className={PICKS.cards}>
        {question.options.map(([value, label]) => (
          <PickTile key={value} pressed={picks.includes(value)} onClick={() => toggle(value)} label={label} />
        ))}
        <PickTile pressed={otherOn} onClick={toggleOther} label="Other" />
      </div>
      {otherOn ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-other`} className="text-[15px] font-semibold">
            Other, in your words
          </label>
          <input
            ref={otherRef}
            id={`${uid}-other`}
            type="text"
            maxLength={MAX_OTHER}
            placeholder={question.otherHint}
            value={answer?.other ?? ""}
            onChange={(event) => onChange({ picks, other: event.target.value })}
            className={INPUT}
          />
        </div>
      ) : null}
    </div>
  );
}
