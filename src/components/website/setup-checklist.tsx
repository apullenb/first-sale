"use client";

import { useLayoutEffect, useState } from "react";
import { setSetupStepAction } from "@/app/(app)/website/actions";
import { ALERT, TEXT_LINK } from "@/components/styles";

export interface ChecklistStep {
  key: string;
  title: string;
  detail: string;
  help: { label: string; url: string } | null;
  inApp: { label: string; href: string } | null;
}

// The owner ticks off each step they've done on the platform; First Sale can't do these for them
export function SetupChecklist({ steps, done }: { steps: ChecklistStep[]; done: string[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function toggle(key: string, checked: boolean) {
    setPending(key);
    setError(null);
    try {
      const result = await setSetupStepAction({ key, done: checked });
      if (!result.ok) setError(result.message);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted" aria-live="polite">
        {done.length} of {steps.length} done
      </p>
      <ol className="flex flex-col gap-2.5">
        {steps.map((step, index) => {
          const isDone = done.includes(step.key);
          return (
            <li key={step.key} className="flex items-start gap-1.5 rounded-xl bg-ground py-1.5 pr-3.5 pl-1.5">
              <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
                <input
                  id={`setup-${step.key}`}
                  type="checkbox"
                  className="size-5 accent-accent"
                  checked={isDone}
                  disabled={pending !== null}
                  onChange={(event) => toggle(step.key, event.target.checked)}
                />
              </label>
              <div className="flex min-w-0 flex-col gap-1 pt-2.5">
                <label htmlFor={`setup-${step.key}`} className={`font-semibold ${isDone ? "text-muted line-through" : ""}`}>
                  {index + 1}. {step.title}
                </label>
                <p className="text-rule">{step.detail}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {step.help ? (
                    <a href={step.help.url} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} inline-flex min-h-11 items-center`}>
                      {step.help.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : null}
                  {step.inApp ? (
                    <a href={step.inApp.href} className={`${TEXT_LINK} inline-flex min-h-11 items-center`}>
                      {step.inApp.label}
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
