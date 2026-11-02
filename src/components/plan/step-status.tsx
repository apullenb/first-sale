"use client";

import { useId, useLayoutEffect, useState } from "react";
import { setStepStatusAction } from "@/app/(app)/checklist/actions";
import { celebrate } from "@/components/celebrate";
import { LocalDate } from "@/components/local-date";
import { Icon } from "@/components/icons";
import { ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import type { TaskStatus } from "@/lib/domain";
import type { StepKind } from "@/lib/rules/step-kind";

interface Props {
  stepId: string;
  title: string;
  status: TaskStatus;
  note: string | null;
  submittedAt: string | null;
  submissionNote: string | null;
  // A filing or a question sent to an office records sending and the answer separately; the rest are just done
  kind: StepKind;
}

const WORDS: Record<StepKind, { confirm: string; placeholder: string; button: string }> = {
  filing: { confirm: "I submitted this myself.", placeholder: "For example: filed online on May 3, confirmation emailed", button: "I submitted it" },
  contact: { confirm: "I sent the question to the office myself.", placeholder: "For example: emailed the planning office on May 3", button: "I sent it" },
  training: { confirm: "I completed it.", placeholder: "For example: finished the course on May 3", button: "I’ve done this" },
  compliance: { confirm: "I’ve checked this and my business follows it.", placeholder: "For example: checked the requirements on May 3", button: "I’ve done this" },
  decision: { confirm: "I’ve made this decision.", placeholder: "", button: "Got it" },
};

const UNDO = "inline-flex min-h-11 items-center px-1 font-semibold text-accent underline decoration-[1.5px] underline-offset-[3px] hover:text-accent-ink disabled:opacity-60";

// The owner records what they actually did; opening a link or a form never changes this
export function StepStatus({ stepId, title, status, note, submittedAt, submissionNote, kind }: Props) {
  const sends = kind === "filing" || kind === "contact";
  const words = WORDS[kind];
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
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
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
      <p className="text-sm text-muted">Leave out Social Security and tax ID numbers.</p>
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
            {kind === "contact" ? "Sent" : "Submitted"} on <LocalDate iso={submittedAt} />
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
          You {kind === "contact" ? "sent your question" : "submitted this"}
          {submittedAt ? <> on <LocalDate iso={submittedAt} /></> : null}. Waiting to hear back.
        </p>
        {submissionNote ? <p className="text-rule">Your note: {submissionNote}</p> : null}
        {confirm(kind === "contact" ? "The office answered in writing." : "The office approved it, or sent what I applied for.")}
        {noteField(kind === "contact" ? "For example: the planning office replied on May 10" : "For example: license number arrived by email on May 10")}
        <div className="flex flex-wrap gap-2.5">
          <button type="button" disabled={pending || !confirmed} onClick={() => save("done")} className={PRIMARY}>
            <Icon name="check" size="sm" />
            {pending ? "Saving…" : kind === "contact" ? "Mark as answered" : "Mark as approved"}
          </button>
          <button type="button" disabled={pending} onClick={() => save("todo")} className={SECONDARY}>
            {kind === "contact" ? "I haven’t sent it" : "I haven’t submitted it"}
          </button>
        </div>
        {alert}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {confirm(words.confirm)}
      {noteField(words.placeholder)}
      <div className="flex flex-wrap gap-2.5">
        <button type="button" disabled={pending || !confirmed} onClick={() => save(sends ? "submitted" : "done")} className={PRIMARY}>
          <Icon name="check" size="sm" />
          {pending ? "Saving…" : words.button}
        </button>
        {sends ? (
          <button type="button" disabled={pending || !confirmed} onClick={() => save("done")} className={SECONDARY}>
            {kind === "contact" ? "Done, they already answered" : "Done, nothing to wait for"}
          </button>
        ) : null}
      </div>
      {alert}
    </div>
  );
}

// A decision already recorded elsewhere: one click says so, with nothing sent and no receipt
export function AcknowledgeDecision({ stepId, title, ready }: { stepId: string; title: string; ready: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function acknowledge() {
    setPending(true);
    setError(null);
    try {
      const result = await setStepStatusAction({ stepId, status: "done", note: null, confirmed: true });
      if (!result.ok) setError(result.message);
      else celebrate(title);
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="flex flex-col items-start gap-3">
      <button type="button" disabled={pending || !ready} onClick={acknowledge} className={PRIMARY}>
        <Icon name="check" size="sm" />
        {pending ? "Saving…" : "Got it, mark this done"}
      </button>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
