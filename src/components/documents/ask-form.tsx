"use client";

import { type FormEvent, useId, useLayoutEffect, useState } from "react";
import { askDocumentAction } from "@/app/(app)/documents/actions";
import { Icon } from "@/components/icons";
import { RUNNING_ELSEWHERE, useJobWatch } from "@/components/job-watch";
import { AI_BUTTON, ALERT, INPUT } from "@/components/styles";
import { Working } from "@/components/working";
import { failedMessage } from "@/lib/failure";

interface Props {
  documentId: string;
  maxQuestion: number;
}

export function AskForm({ documentId, maxQuestion }: Props) {
  const uid = useId();
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = useJobWatch();
  useLayoutEffect(() => () => setError(null), []);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await askDocumentAction({ documentId, question, fieldId: null });
      if (!result.ok && result.busy) job.watch([result.busy]);
      else if (!result.ok) setError(result.message);
      else setQuestion("");
    } catch {
      setError(failedMessage());
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={ask} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-question`} className="text-[15.5px] font-semibold">
          Your question
        </label>
        <textarea
          id={`${uid}-question`}
          rows={2}
          maxLength={maxQuestion}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What does “principal office” mean?"
          className={INPUT}
          aria-describedby={`${uid}-question-help`}
        />
        <p id={`${uid}-question-help`} className="text-[14.5px] text-muted">
          Leave out Social Security and tax ID numbers.
        </p>
      </div>
      <div className="flex flex-col items-start gap-2">
        <button type="submit" disabled={pending || job.watching} className={AI_BUTTON}>
          <Icon name="sparkles" size="sm" />
          {pending ? "Looking for the answer…" : "Ask"}
        </button>
        <Working label={job.watching ? RUNNING_ELSEWHERE : "Looking through the form for the answer. This can take a minute."} active={pending || job.watching} />
        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
