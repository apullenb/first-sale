"use client";

import Link from "next/link";
import { useId, useLayoutEffect, useState } from "react";
import { linkStepAction } from "@/app/(app)/documents/actions";
import { ALERT, INPUT, TEXT_LINK } from "@/components/styles";

interface Props {
  documentId: string;
  stepId: string | null;
  steps: { id: string; title: string }[];
}

// Which plan step a document belongs to; saved as soon as it changes
export function StepLink({ documentId, stepId, steps }: Props) {
  const uid = useId();
  const [value, setValue] = useState(stepId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setPending(true);
    setError(null);
    try {
      const result = await linkStepAction({ documentId, stepId: next || null });
      if (!result.ok) {
        setValue(previous);
        setError(result.message);
      }
    } catch {
      setValue(previous);
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${uid}-step`} className="font-semibold">
        Plan step this is for
      </label>
      <select
        id={`${uid}-step`}
        value={value}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className={`${INPUT} max-w-xl`}
      >
        <option value="">Not linked to a step</option>
        {steps.map((step) => (
          <option key={step.id} value={step.id}>
            {step.title}
          </option>
        ))}
      </select>
      <p role="status" className={pending ? "text-sm text-muted" : "sr-only"}>
        {pending ? "Saving…" : ""}
      </p>
      {stepId && !pending ? (
        <Link href={`/checklist/${encodeURIComponent(stepId)}`} className={`${TEXT_LINK} flex min-h-11 w-fit items-center`}>
          Open this step in your plan
        </Link>
      ) : null}
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
