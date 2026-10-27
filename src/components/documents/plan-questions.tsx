"use client";

import { type FormEvent, useId, useLayoutEffect, useState } from "react";
import { draftBusinessPlanAction } from "@/app/(app)/documents/actions";
import { AI_BUTTON, ALERT, INPUT } from "@/components/styles";

interface Props {
  questions: { key: string; label: string; hint: string }[];
  initial: Record<string, string>;
  maxInput: number;
  hasDraft: boolean;
}

export function PlanQuestions({ questions, initial, maxInput, hasDraft }: Props) {
  const uid = useId();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((question) => [question.key, initial[question.key] ?? ""])),
  );
  const [status, setStatus] = useState<"idle" | "drafting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function draft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasDraft && !window.confirm("Drafting again replaces the plan below, including any edits you made to it. Continue?")) return;
    setStatus("drafting");
    setError(null);
    try {
      const result = await draftBusinessPlanAction(values);
      if (!result.ok) {
        setError(result.message);
        setStatus("idle");
      } else setStatus("done");
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={draft} className="flex flex-col gap-4">
      <p className="text-rule">
        All optional. Answer what you can, in your own words. Anything you leave out becomes a [bracketed] note in the
        draft for you to fill in later.
      </p>
      {questions.map((question) => (
        <div key={question.key} className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-${question.key}`} className="font-semibold">
            {question.label}
          </label>
          <textarea
            id={`${uid}-${question.key}`}
            rows={2}
            maxLength={maxInput}
            value={values[question.key] ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setValues((current) => ({ ...current, [question.key]: value }));
            }}
            className={INPUT}
            aria-describedby={`${uid}-${question.key}-hint`}
          />
          <p id={`${uid}-${question.key}-hint`} className="text-sm text-muted">
            {question.hint}
          </p>
        </div>
      ))}
      <div className="flex flex-col items-start gap-2">
        <button type="submit" disabled={status === "drafting"} className={AI_BUTTON}>
          {status === "drafting" ? "Drafting…" : hasDraft ? "Draft my business plan again" : "Draft my business plan"}
        </button>
        <p role="status" className={status === "idle" ? "sr-only" : "text-sm text-muted"}>
          {status === "drafting"
            ? "Writing your business plan… this can take a minute or two"
            : status === "done"
              ? "Your draft is ready. It’s below these questions."
              : ""}
        </p>
        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
