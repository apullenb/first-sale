"use client";

import { useLayoutEffect, useState } from "react";
import { answerConditionAction } from "@/app/(app)/requirements/actions";
import { ALERT } from "@/components/styles";
import type { ConditionAnswer } from "@/lib/research/applicability";

const CHOICES: { value: ConditionAnswer; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not decided yet" },
];

const CHOICE =
  "inline-flex min-h-11 min-w-[88px] items-center justify-center rounded-[10px] border px-4 font-semibold shadow-soft transition active:translate-y-px disabled:opacity-60 motion-reduce:transition-none";
const LINK = "inline-flex min-h-11 items-center px-1 font-semibold text-accent underline decoration-[1.5px] underline-offset-[3px] hover:text-accent-ink disabled:opacity-60";

function useAnswer(stepKey: string, condition: string) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Clear old errors when the page is hidden: kept-mounted screens keep their state
  useLayoutEffect(() => () => setError(null), []);
  async function save(answer: ConditionAnswer | null): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const result = await answerConditionAction({ stepKey, condition, answer });
      if (!result.ok) setError(result.message);
      return result.ok;
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, error, save };
}

function Problem({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className={ALERT}>
      {error}
    </p>
  ) : null;
}

// Yes, No and Not sure for one question; the page moves it once it's saved
export function AnswerButtons({ stepKey, condition, current = null, labelledBy }: { stepKey: string; condition: string; current?: ConditionAnswer | null; labelledBy: string }) {
  const { pending, error, save } = useAnswer(stepKey, condition);
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
        {CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-pressed={current === choice.value}
            disabled={pending}
            onClick={() => save(choice.value)}
            className={`${CHOICE} ${current === choice.value ? "border-accent bg-accent-tint text-accent-ink" : "border-line-strong bg-surface text-ink hover:border-muted hover:bg-soft"}`}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <p role="status" className="sr-only">
        {pending ? "Saving your answer…" : ""}
      </p>
      <Problem error={error} />
    </div>
  );
}

// An answer already given, with a way to change it
export function ChangeAnswer({ stepKey, condition, current, labelledBy }: { stepKey: string; condition: string; current: ConditionAnswer; labelledBy: string }) {
  const [open, setOpen] = useState(false);
  if (open) return <AnswerButtons stepKey={stepKey} condition={condition} current={current} labelledBy={labelledBy} />;
  return (
    <button type="button" onClick={() => setOpen(true)} className={LINK}>
      Change<span className="sr-only"> your answer</span>
    </button>
  );
}

// Takes back a "no", so the question is asked again
export function UndoAnswer({ stepKey, condition, title }: { stepKey: string; condition: string; title: string }) {
  const { pending, error, save } = useAnswer(stepKey, condition);
  return (
    <span className="flex flex-col items-start gap-1">
      <button type="button" disabled={pending} onClick={() => save(null)} className={LINK}>
        {pending ? "Undoing…" : "Undo"}
        <span className="sr-only"> your “no” for {title}</span>
      </button>
      <Problem error={error} />
    </span>
  );
}
