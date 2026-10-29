"use client";

import { useLayoutEffect, useState } from "react";
import { setSetupStepAction } from "@/app/(app)/website/actions";
import { ALERT, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import type { PasteValue } from "@/lib/website/paste";
import { CopyButton } from "./copy-button";

export interface ChecklistStep {
  key: string;
  title: string;
  detail: string;
  clicks: string[];
  goTo: { label: string; url: string } | null;
  help: { label: string; url: string } | null;
  inApp: { label: string; href: string } | null;
  paste: PasteValue[];
}

function NewTab() {
  return <span className="sr-only"> (opens in a new tab)</span>;
}

function Paste({ value }: { value: PasteValue }) {
  switch (value.kind) {
    case "text":
      return (
        <li className="flex flex-col gap-1.5 rounded-lg bg-surface px-3 py-2.5 ring-1 ring-ink/5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{value.label}</span>
            <CopyButton text={value.text} label={value.label} />
          </div>
          <p className="whitespace-pre-line text-[15px] text-rule">{value.text}</p>
        </li>
      );
    case "color":
      return (
        <li className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-3 py-2 ring-1 ring-ink/5">
          <span aria-hidden="true" className="size-8 rounded-md ring-1 ring-ink/20" style={{ background: value.hex }} />
          <span className="flex-1">
            <span className="font-semibold">{value.label}</span> <span className="font-mono">{value.hex}</span>
          </span>
          <CopyButton text={value.hex} label={`${value.label} color code`} />
        </li>
      );
    case "file":
      return (
        <li className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-3 py-2 ring-1 ring-ink/5">
          <span className="flex-1">
            <span className="font-semibold">{value.label}</span>
            {value.note ? <span className="block text-sm text-muted">{value.note}</span> : null}
          </span>
          <a href={value.href} download className={SECONDARY_LINK}>
            Download
          </a>
        </li>
      );
    case "records":
      return (
        <li className="flex flex-col gap-2 rounded-lg bg-surface px-3 py-2.5 ring-1 ring-ink/5">
          <span className="font-semibold">{value.label}</span>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-left text-[15px]">
              <thead>
                <tr className="text-sm text-muted">
                  <th scope="col" className="py-1 pr-3 font-semibold">
                    Type
                  </th>
                  <th scope="col" className="py-1 pr-3 font-semibold">
                    Host or name
                  </th>
                  <th scope="col" className="py-1 font-semibold">
                    Value or points to
                  </th>
                </tr>
              </thead>
              <tbody>
                {value.records.map((record) => (
                  <tr key={`${record.type}-${record.host}-${record.value}`} className="border-t border-line align-middle">
                    <td className="py-1.5 pr-3 font-mono">{record.type}</td>
                    <td className="py-1.5 pr-3 font-mono">{record.host}</td>
                    <td className="py-1.5">
                      {record.pending ? (
                        <span className="text-check">{record.value}: shown in Netlify once your site is published</span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono break-all">{record.value}</span>
                          <CopyButton text={record.value} label={`${record.type} record value`} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-rule">
            {value.note}{" "}
            <a href={value.source.url} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
              {value.source.label}
              <NewTab />
            </a>
          </p>
        </li>
      );
    case "missing":
      return (
        <li className="rounded-lg bg-check-tint px-3 py-2.5 text-[15px] text-check">
          <span className="font-semibold">{value.label}:</span> {value.text}{" "}
          {value.href ? (
            <a href={value.href} className={TEXT_LINK}>
              Go there
            </a>
          ) : null}
        </li>
      );
  }
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
      <ol className="flex flex-col gap-3">
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
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-2.5 pb-2">
                <label htmlFor={`setup-${step.key}`} className={`font-semibold ${isDone ? "text-muted line-through" : ""}`}>
                  {index + 1}. {step.title}
                </label>
                <p className="text-rule">{step.detail}</p>
                {step.clicks.length ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold">Where to click</p>
                    <ol aria-label={`Where to click for ${step.title}`} className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px]">
                      {step.clicks.map((click, at) => (
                        <li key={`${at}-${click}`} className="flex items-center gap-1.5">
                          {at ? (
                            <span aria-hidden="true" className="text-muted">
                              ›
                            </span>
                          ) : null}
                          <span className="rounded bg-surface px-1.5 py-0.5 ring-1 ring-ink/10">{click}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {step.goTo ? (
                    <a href={step.goTo.url} target="_blank" rel="noopener noreferrer" className={SECONDARY_LINK}>
                      Take me there: {step.goTo.label}
                      <NewTab />
                    </a>
                  ) : null}
                  {step.help ? (
                    <a href={step.help.url} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} inline-flex min-h-11 items-center`}>
                      {step.help.label}
                      <NewTab />
                    </a>
                  ) : null}
                  {step.inApp ? (
                    <a href={step.inApp.href} className={`${TEXT_LINK} inline-flex min-h-11 items-center`}>
                      {step.inApp.label}
                    </a>
                  ) : null}
                </div>
                {step.paste.length ? (
                  <details open={!isDone} className="group rounded-lg">
                    <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-accent-ink underline underline-offset-4">
                      Ready to paste
                    </summary>
                    <ul className="mt-1 flex flex-col gap-2">
                      {step.paste.map((value, at) => (
                        <Paste key={`${value.kind}-${value.label}-${at}`} value={value} />
                      ))}
                    </ul>
                  </details>
                ) : null}
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
