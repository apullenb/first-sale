"use client";

import { type FormEvent, useId, useLayoutEffect, useState } from "react";
import { askDocumentAction } from "@/app/(app)/documents/actions";
import { Icon } from "@/components/icons";
import { AI_BUTTON, ALERT, INPUT } from "@/components/styles";
import { Working } from "@/components/working";

interface Props {
  documentId: string;
  fields: { id: string; label: string; page: number }[];
  maxQuestion: number;
}

export function AskForm({ documentId, fields, maxQuestion }: Props) {
  const uid = useId();
  const [question, setQuestion] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await askDocumentAction({ documentId, question, fieldId: fieldId || null });
      if (!result.ok) setError(result.message);
      else {
        setQuestion("");
        setFieldId("");
      }
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
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
          placeholder="For example: What does “principal office” mean?"
          className={INPUT}
          aria-describedby={`${uid}-question-help`}
        />
        <p id={`${uid}-question-help`} className="text-[14.5px] text-muted">
          Ask about a word, a blank, or what the form wants. Leave out Social Security and tax ID numbers.
        </p>
      </div>
      {fields.length ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-field`} className="text-[15.5px] font-semibold">
            Is it about one blank? <span className="font-normal text-muted">(optional)</span>
          </label>
          <select id={`${uid}-field`} value={fieldId} onChange={(event) => setFieldId(event.target.value)} className={INPUT}>
            <option value="">Not about one blank</option>
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.label} (page {field.page})
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex flex-col items-start gap-2">
        <button type="submit" disabled={pending} className={AI_BUTTON}>
          <Icon name="sparkles" size="sm" />
          {pending ? "Looking for the answer…" : "Ask"}
        </button>
        <Working label="Looking through the form for the answer. This can take a minute." active={pending} />
        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
