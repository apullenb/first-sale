"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Elapsed } from "@/components/photos/working";

const FINISH_STEP_MS = 220;

// Ticks steps off while one AI request runs. schedule[i] is when step i may tick on its own;
// later steps wait for finish(), so the last ones tick only once the work is really done.
export function useStepTicker(total: number, schedule: readonly number[]) {
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);
  const doneRef = useRef(0);
  // Kept so a screen that was hidden mid-run can catch up when it shows again
  const startedAt = useRef<number | null>(null);
  const finishing = useRef<(() => void) | null>(null);

  const tick = useCallback((count: number) => {
    doneRef.current = count;
    setDone(count);
  }, []);
  const clear = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  const complete = useCallback(() => {
    clear();
    startedAt.current = null;
    tick(total);
    setRunning(false);
    const resolve = finishing.current;
    finishing.current = null;
    resolve?.();
  }, [clear, tick, total]);

  // Ticks the steps already due, and sets timers for the rest
  const resume = useCallback(() => {
    clear();
    if (startedAt.current === null) return;
    const elapsed = Date.now() - startedAt.current;
    const due = schedule.slice(0, Math.max(0, total - 1));
    tick(Math.max(doneRef.current, due.filter((ms) => ms <= elapsed).length));
    timers.current = due.flatMap((ms, index) => (ms > elapsed ? [window.setTimeout(() => tick(Math.max(doneRef.current, index + 1)), ms - elapsed)] : []));
  }, [clear, tick, schedule, total]);

  // A hidden screen drops its timers; shown again, it catches up or finishes
  useEffect(() => {
    if (finishing.current) complete();
    else resume();
    return clear;
  }, [clear, complete, resume]);

  const start = useCallback(() => {
    finishing.current = null;
    startedAt.current = Date.now();
    tick(0);
    setRunning(true);
    resume();
  }, [resume, tick]);

  // Ticks what's left one at a time, then resolves
  const finish = useCallback(
    () =>
      new Promise<void>((resolve) => {
        clear();
        startedAt.current = null;
        finishing.current = resolve;
        const from = doneRef.current;
        const left = total - from;
        for (let step = 1; step <= left; step++) {
          timers.current.push(window.setTimeout(() => tick(from + step), step * FINISH_STEP_MS));
        }
        timers.current.push(window.setTimeout(complete, (left + 1) * FINISH_STEP_MS));
      }),
    [clear, complete, tick, total],
  );

  const stop = useCallback(() => {
    clear();
    startedAt.current = null;
    finishing.current = null;
    tick(0);
    setRunning(false);
  }, [clear, tick]);

  return { done, running, start, finish, stop };
}

// The progress screen: each step ticks off as it's done. The caller keeps a live region for screen readers.
export function StepProgress({ title, steps, done, note }: { title: string; steps: readonly string[]; done: number; note?: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // The button that started it is gone, so focus moves here
  useEffect(() => heading.current?.focus(), []);
  const current = Math.min(done, steps.length - 1);
  return (
    <section aria-labelledby="step-progress-title" className="flex flex-col gap-3 rounded-2xl bg-ai-tint p-5 ring-1 ring-ai/15">
      <h2 id="step-progress-title" ref={heading} tabIndex={-1} className="flex flex-wrap items-baseline gap-x-2 font-display text-lg font-bold text-ai-ink outline-none">
        {title}
        <span className="font-sans text-sm font-semibold text-ai">
          <Elapsed />
        </span>
      </h2>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => {
          const state = index < done ? "done" : index === current ? "now" : "later";
          return (
            <li key={step} className={`flex items-center gap-3 text-[15px] ${state === "later" ? "text-muted" : "text-ai-ink"}`}>
              <StepMark state={state} />
              <span className={state === "now" ? "font-semibold" : undefined}>{step}</span>
              <span className="sr-only">{state === "done" ? "(done)" : state === "now" ? "(working on it)" : ""}</span>
            </li>
          );
        })}
      </ol>
      {note ? <p className="text-sm text-ai-ink">{note}</p> : null}
    </section>
  );
}

// For the caller's live region
export function stepStatus(steps: readonly string[], done: number): string {
  return done >= steps.length ? "Done." : `Step ${done + 1} of ${steps.length}: ${steps[done]}`;
}

function StepMark({ state }: { state: "done" | "now" | "later" }) {
  if (state === "done") {
    return (
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-white">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      </span>
    );
  }
  if (state === "now") {
    return (
      <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center">
        <span className="size-3 animate-pulse rounded-full bg-ai" />
      </span>
    );
  }
  return <span aria-hidden="true" className="size-6 shrink-0 rounded-full border-2 border-field" />;
}
