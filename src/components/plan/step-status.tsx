"use client";

import { useId, useLayoutEffect, useState } from "react";
import { setStepStatusAction } from "@/app/(app)/checklist/actions";
import { celebrate } from "@/components/celebrate";
import { LocalDate } from "@/components/local-date";
import { Icon } from "@/components/icons";
import { ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import type { TaskStatus } from "@/lib/domain";

interface Props {
  stepId: string;
  title: string;
  status: TaskStatus;
  note: string | null;
  submittedAt: string | null;
  submissionNote: string | null;
  // Something is sent to an office, so submitting and approval are recorded separately
  filing: boolean;
}

const UNDO = "inline-flex min-h-11 items-center px-1 font-semibold text-accent underline decoration-[1.5px] underline-offset-[3px] hover:text-accent-ink disabled:opacity-60";

// The owner records what they actually did; opening a link or a form never changes this
export function StepStatus({ stepId, title, status, note, submittedAt, submissionNote, filing }: Props) {
  const uid = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function save(next: TaskStatus) {
    if (next === "todo" && !window.confirm("Undo this? Your notes stay.")) return;
    setPending(true);
    setError(null);
    try {
      const result = await setStepStatusAction({ stepId, status: next, note: next === "todo" ? null : text, confirmed });
      if (!result.ok) setError(result.message);
      else {
        setConfirmed(false);
        setText("");
        if (next === "done") celebrate(title);
      }
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const alert = error ? (
    <p role="alert" className={ALERT}>
      {error}
    </p>
  ) : null;

  const noteField = (placeholder: string) => (
    <div className="flex w-full max-w-xl flex-col gap-1.5">
      <label htmlFor={`${uid}-note`} className="font-semibold">
        Note for your records <span className="font-normal text-muted">(optional)</span>
      </label>
      <input id={`${uid}-note`} type="text" maxLength={500} value={text} onChange={(event) => setText(event.target.value)} placeholder={placeholder} className={INPUT} />
      <p className="text-sm text-muted">Leave out Social Security and tax id numbers.</p>
    </div>
  );

  const confirm = (words: string) => (
    <label className="flex min-h-11 items-start gap-3">
      <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
      <span>{words}</span>
    </label>
  );

  if (status === "done") {
    return (
      <div className="flex flex-col items-start gap-1.5">
        {submittedAt ? (
          <p className="text-rule">
            Submitted on <LocalDate iso={submittedAt} />
            {submissionNote ? `: ${submissionNote}` : "."}
          </p>
        ) : null}
        {note ? <p className="text-rule">Your note: {note}</p> : null}
        <button type="button" disabled={pending} onClick={() => save("todo")} className={UNDO}>
          {pending ? "Saving…" : "Mark as not done"}
        </button>
        {alert}
      </div>
    );
  }

  if (status === "submitted") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-rule">
          You submitted this{submittedAt ? <> on <LocalDate iso={submittedAt} /></> : null}. Waiting to hear back.
        </p>
        {submissionNote ? <p className="text-rule">Your note: {submissionNote}</p> : null}
        {confirm("The office approved it, or sent what I applied for.")}
        {noteField("For example: license number arrived by email on May 10")}
        <div className="flex flex-wrap gap-2.5">
          <button type="button" disabled={pending || !confirmed} onClick={() => save("done")} className={PRIMARY}>
            <Icon name="check" size="sm" />
            {pending ? "Saving…" : "Mark as approved"}
          </button>
          <button type="button" disabled={pending} onClick={() => save("todo")} className={SECONDARY}>
            I haven’t submitted it
          </button>
        </div>
        {alert}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {confirm(filing ? "I submitted this myself." : "I finished this step myself.")}
      {noteField(filing ? "For example: filed online on May 3, confirmation emailed" : "For example: checked the rules on May 3")}
      <div className="flex flex-wrap gap-2.5">
        <button type="button" disabled={pending || !confirmed} onClick={() => save(filing ? "submitted" : "done")} className={PRIMARY}>
          <Icon name="check" size="sm" />
          {pending ? "Saving…" : filing ? "I submitted it" : "Mark as done"}
        </button>
        {filing ? (
          <button type="button" disabled={pending || !confirmed} onClick={() => save("done")} className={SECONDARY}>
            Done, nothing to wait for
          </button>
        ) : null}
      </div>
      {alert}
    </div>
  );
}
