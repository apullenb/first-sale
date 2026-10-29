"use client";

import { useLayoutEffect, useState } from "react";
import { setSetupStepAction } from "@/app/(app)/website/actions";
import { Icon } from "@/components/icons";
import { LABEL, TickBox } from "@/components/marketing/pieces";
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
        <li className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{value.label}</span>
            <CopyButton text={value.text} label={value.label} />
          </div>
          <p className="whitespace-pre-line text-[15px] text-rule">{value.text}</p>
        </li>
      );
    case "color":
      return (
        <li className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-soft">
          <span aria-hidden="true" className="size-8 rounded-md ring-1 ring-ink/20" style={{ background: value.hex }} />
          <span className="flex-1">
            <span className="font-semibold">{value.label}</span> <span className="font-mono">{value.hex}</span>
          </span>
          <CopyButton text={value.hex} label={`${value.label} color code`} />
        </li>
      );
    case "file":
      return (
        <li className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-soft">
          <span className="flex-1">
            <span className="font-semibold">{value.label}</span>
            {value.note ? <span className="block text-sm text-muted">{value.note}</span> : null}
          </span>
          <a href={value.href} download className={SECONDARY_LINK}>
            <Icon name="download" size="sm" />
            Download
          </a>
        </li>
      );
    case "records":
      return (
        <li className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-soft">
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
        <li className="rounded-xl border border-check-ring bg-check-tint px-3.5 py-3 text-[15px] text-check">
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
  const [ticked, setTicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function toggle(key: string, checked: boolean) {
    setPending(key);
    setTicked(checked ? key : null);
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

  const share = steps.length ? Math.round((done.length / steps.length) * 100) : 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-[15px] text-muted" aria-live="polite">
          <b className="font-bold text-ink">
            {done.length} of {steps.length}
          </b>{" "}
          done
        </p>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-wash">
          <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
        </div>
      </div>
      <ol className="flex flex-col gap-2.5">
        {steps.map((step, index) => {
          const isDone = done.includes(step.key);
          return (
            <li key={step.key} className={`rounded-xl border border-line shadow-soft ${isDone ? "bg-soft" : "bg-surface"}`}>
              <div className="flex items-start gap-2 py-2.5 pr-4 pl-2 sm:gap-3">
                <TickBox id={`setup-${step.key}`} checked={isDone} fresh={ticked === step.key} disabled={pending !== null} onChange={(checked) => toggle(step.key, checked)} />
                <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-2 pb-1.5">
                  <label htmlFor={`setup-${step.key}`} className={`cursor-pointer leading-snug font-bold ${isDone ? "text-muted line-through decoration-line-strong" : ""}`}>
                    {index + 1}. {step.title}
                  </label>
                  <p className="text-rule">{step.detail}</p>
                  {step.clicks.length ? (
                    <div className="flex flex-col gap-1.5">
                      <p className={LABEL}>Where to click</p>
                      <ol aria-label={`Where to click for ${step.title}`} className="flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[15px]">
                        {step.clicks.map((click, at) => (
                          <li key={`${at}-${click}`} className="flex items-center gap-1.5">
                            {at ? <Icon name="chevron" size="xs" className="text-faint" /> : null}
                            <span className="rounded-md border border-line bg-surface px-2 py-0.5 font-semibold shadow-soft">{click}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  {step.goTo || step.help || step.inApp ? (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]">
                      {step.goTo ? (
                        <a href={step.goTo.url} target="_blank" rel="noopener noreferrer" className={SECONDARY_LINK}>
                          Take me there: {step.goTo.label}
                          <Icon name="external" size="sm" />
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
                  ) : null}
                  {step.paste.length ? (
                    <details open={!isDone} className="group/paste rounded-xl border border-line bg-soft">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 font-semibold text-accent [&::-webkit-details-marker]:hidden">
                        <Icon name="copy" size="sm" />
                        <span className="flex-1">Ready to paste</span>
                        <Icon name="chevron" size="sm" className="text-faint transition-transform group-open/paste:rotate-90" />
                      </summary>
                      <ul className="flex flex-col gap-2 px-3 pb-3">
                        {step.paste.map((value, at) => (
                          <Paste key={`${value.kind}-${value.label}-${at}`} value={value} />
                        ))}
                      </ul>
                    </details>
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
