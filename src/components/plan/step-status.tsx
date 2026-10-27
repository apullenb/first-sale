"use client";

import { useId, useLayoutEffect, useState } from "react";
import { setStepStatusAction } from "@/app/(app)/checklist/actions";
import { LocalDate } from "@/components/local-date";
import { INPUT, PRIMARY, SECONDARY } from "@/components/styles";

interface Props {
  stepId: string;
  status: "todo" | "done";
  note: string | null;
  completedAt: string | null;
}

// Marking a step done is the owner's call, after they've actually done it
export function StepStatus({ stepId, status, note, completedAt }: Props) {
  const uid = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [text, setText] = useState(note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function save(next: "todo" | "done") {
    if (next === "todo" && !window.confirm("Mark this step as not done? Your note stays.")) return;
    setPending(true);
    setError(null);
    try {
      const result = await setStepStatusAction({ stepId, status: next, note: next === "done" ? text : null, confirmed });
      if (!result.ok) setError(result.message);
      else {
        setConfirmed(false);
        setText("");
      }
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-start gap-2.5">
        <p className="font-semibold text-accent-ink">
          You marked this done{completedAt ? <> on <LocalDate iso={completedAt} /></> : null}.
        </p>
        {note ? <p className="text-rule">Your note: {note}</p> : null}
        <button type="button" disabled={pending} onClick={() => save("todo")} className={SECONDARY}>
          {pending ? "Saving…" : "Mark as not done"}
        </button>
        {error ? <p role="alert" className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 accent-accent" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>I finished this step myself. First Sale doesn’t file or submit anything for me.</span>
      </label>
      <label htmlFor={`${uid}-note`} className="font-semibold">
        Note for your records <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id={`${uid}-note`}
        type="text"
        maxLength={500}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="For example: filed online on May 3, confirmation emailed"
        className={INPUT}
      />
      <p className="text-sm text-muted">Leave out Social Security and tax id numbers.</p>
      <button type="button" disabled={pending || !confirmed} onClick={() => save("done")} className={PRIMARY}>
        {pending ? "Saving…" : "Mark as done"}
      </button>
      {error ? <p role="alert" className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">{error}</p> : null}
    </div>
  );
}
