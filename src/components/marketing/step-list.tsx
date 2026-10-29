"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { setMarketingStepAction } from "@/app/(app)/marketing/actions";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { Note } from "@/components/ui";
import { ALERT, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { PLATFORM_DATA } from "@/data/marketing-platforms";
import { type HandHolding, type MarketingStep, type StepLink, stepAnchor } from "@/lib/marketing/types";
import { TickBox } from "./pieces";

export type ShownStep = MarketingStep & { help: HandHolding; helpNote: string };

const HELP_TITLES: Record<HandHolding, string> = {
  walkthrough: "Show me step by step",
  guided: "Your checklist",
  checklist: "Your checklist",
};

function Links({ links }: { links: StepLink[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {links.map((link) => {
        const className = link.guide ? `${TEXT_LINK} inline-flex min-h-11 items-center text-[15px]` : SECONDARY_LINK;
        const text = link.guide ? link.label : "Take me there";
        const context = link.guide ? null : <span className="sr-only">: {link.label}</span>;
        return link.external ? (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
            {text}
            {context}
            {link.guide ? null : <Icon name="external" size="sm" />}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <Link key={link.href} href={link.href} className={className}>
            {text}
            {context}
            {link.guide ? null : <Icon name="arrow" size="sm" />}
          </Link>
        );
      })}
    </div>
  );
}

// Numbered how-to lines, Onramp's numbered parts
function Walkthrough({ how }: { how: string[] }) {
  return (
    <ol className="flex flex-col gap-2.5 text-[15.5px]">
      {how.map((line, index) => (
        <li key={index} className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full border border-accent-ring bg-accent-tint font-display text-[13px] text-accent">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 pt-px">
            <span className="sr-only">{index + 1}. </span>
            {line}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Body({ step }: { step: ShownStep }) {
  const lines = step.short.length ? step.short : step.how;
  const short = lines.length ? (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15.5px] marker:text-accent">
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
      <details className="group/more rounded-xl border border-line bg-soft">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 font-semibold text-accent [&::-webkit-details-marker]:hidden">
          Show me step by step
          <Icon name="chevron" size="sm" className="ml-auto text-faint transition-transform group-open/more:rotate-90" />
        </summary>
        <div className="px-3.5 pb-3.5">
          <Walkthrough how={step.how} />
        </div>
      </details>
    </>
  );
}

// The plan's steps, with as much help as the owner's answers call for. The owner ticks each one off.
export function MarketingStepList({ steps, done, next }: { steps: ShownStep[]; done: string[]; next: string | null }) {
  const [pending, setPending] = useState<string | null>(null);
  const [ticked, setTicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function toggle(key: string, checked: boolean) {
    setPending(key);
    setTicked(checked ? key : null);
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
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${share}%` }} />
        </div>
      </div>
      <ol className="flex flex-col gap-2.5">
        {steps.map((step, index) => {
          const isDone = done.includes(step.key);
          const id = stepAnchor(step.key);
          return (
            <li key={step.key} id={id} className={`scroll-mt-4 rounded-xl border border-line shadow-soft ${isDone ? "bg-soft" : "bg-surface"}`}>
              <div className="flex items-start gap-2 py-2.5 pr-4 pl-2 sm:gap-3">
                <TickBox id={`${id}-done`} checked={isDone} fresh={ticked === step.key} disabled={pending !== null} onChange={(checked) => toggle(step.key, checked)} />
                <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
                  <label htmlFor={`${id}-done`} className={`cursor-pointer text-base leading-snug font-bold ${isDone ? "text-muted line-through decoration-line-strong" : ""}`}>
                    {index + 1}. {step.title}
                  </label>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                    <ActorChip actor={step.by} />
                    {step.platform ? <span>{PLATFORM_DATA[step.platform].name}</span> : null}
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-accent">
                        <Icon name="check" size="xs" /> Done
                      </span>
                    ) : null}
                  </div>
                  {!isDone && step.why ? <p className="pt-0.5 text-[15.5px] text-rule">{step.why}</p> : null}
                </div>
              </div>
              {isDone || !(step.how.length || step.short.length || step.links.length) ? null : (
                <details open={step.key === next} className="group/how border-t border-line">
                  <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 py-2 pr-4 pl-4 sm:pl-[65px] [&::-webkit-details-marker]:hidden">
                    <span className="grid min-w-0 flex-1 gap-px">
                      <b className="font-bold text-accent">{HELP_TITLES[step.help]}</b>
                      <small className="text-sm text-muted">{step.helpNote}</small>
                    </span>
                    <Icon name="chevron" className="text-faint transition-transform group-open/how:rotate-90" />
                  </summary>
                  <div className="flex flex-col gap-3 px-4 pb-4 sm:pl-[65px]">
                    <Body step={step} />
                    {step.general && step.platform ? (
                      <Note tone="quiet">
                        These steps are general, because we couldn’t check them against {PLATFORM_DATA[step.platform].name}’s own guide. If your screen looks different, follow
                        its guide.
                      </Note>
                    ) : null}
                    <Links links={step.links} />
                  </div>
                </details>
              )}
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
