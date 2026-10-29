"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { setMarketingStepAction } from "@/app/(app)/marketing/actions";
import { ActorChip } from "@/components/actor-chip";
import { ALERT, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { PLATFORM_DATA } from "@/data/marketing-platforms";
import { type HandHolding, type MarketingStep, type StepLink, stepAnchor } from "@/lib/marketing/types";

export type ShownStep = MarketingStep & { help: HandHolding; helpNote: string };

function Links({ links }: { links: StepLink[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {links.map((link) => {
        const className = link.guide ? `${TEXT_LINK} inline-flex min-h-11 items-center text-sm` : SECONDARY_LINK;
        const text = link.guide ? link.label : "Take me there";
        const context = link.guide ? null : <span className="sr-only">: {link.label}</span>;
        return link.external ? (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
            {text}
            {context}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <Link key={link.href} href={link.href} className={className}>
            {text}
            {context}
          </Link>
        );
      })}
    </div>
  );
}

function Walkthrough({ how }: { how: string[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-1.5 pl-6 text-[15px]">
      {how.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ol>
  );
}

function Body({ step }: { step: ShownStep }) {
  const lines = step.short.length ? step.short : step.how;
  const short = lines.length ? (
    <ul className="flex list-disc flex-col gap-1 pl-6 text-[15px]">
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  ) : null;
  if (step.help === "walkthrough") return <Walkthrough how={step.how} />;
  // Nothing more to open when the checklist already says it all
  if (step.help === "checklist" || step.how.join() === lines.join()) return short;
  return (
    <>
      {short}
      <details className="text-[15px]">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent-ink underline underline-offset-4">Show me step by step</summary>
        <Walkthrough how={step.how} />
      </details>
    </>
  );
}

// The plan's steps, with as much help as the owner's answers call for. The owner ticks each one off.
export function MarketingStepList({ steps, done }: { steps: ShownStep[]; done: string[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function toggle(key: string, checked: boolean) {
    setPending(key);
    setError(null);
    try {
      const result = await setMarketingStepAction({ key, done: checked });
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
          const id = stepAnchor(step.key);
          return (
            <li key={step.key} id={id} className="flex scroll-mt-4 items-start gap-1.5 rounded-xl bg-ground py-2 pr-4 pl-1.5">
              <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
                <input
                  id={`${id}-done`}
                  type="checkbox"
                  className="size-5 accent-accent"
                  checked={isDone}
                  disabled={pending !== null}
                  onChange={(event) => toggle(step.key, event.target.checked)}
                />
              </label>
              <div className="flex min-w-0 flex-1 flex-col gap-2 pt-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`${id}-done`} className={`font-semibold ${isDone ? "text-muted line-through" : ""}`}>
                    {index + 1}. {step.title}
                  </label>
                  <ActorChip actor={step.by} />
                </div>
                {isDone ? null : (
                  <>
                    {step.why ? <p className="text-rule">{step.why}</p> : null}
                    <p className="text-sm text-muted">{step.helpNote}</p>
                    <Body step={step} />
                    {step.general && step.platform ? (
                      <p className="text-sm text-muted">
                        These steps are general, because we couldn’t check them against {PLATFORM_DATA[step.platform].name}’s own guide. If your screen
                        looks different, follow its guide.
                      </p>
                    ) : null}
                    <Links links={step.links} />
                  </>
                )}
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
