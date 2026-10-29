"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState, useTransition } from "react";
import type { ActionResult } from "@/app/(app)/business/actions";
import { draftMarketingPlanAction } from "@/app/(app)/marketing/actions";
import { ActionButton } from "@/components/action-button";
import { AI_BUTTON, ALERT, SECONDARY } from "@/components/styles";

// A progress screen for one AI request. Steps tick off on a timer; the last one waits for the reply.

function Tick() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ProgressSteps({ title, steps, estimateMs, finished }: { title: string; steps: string[]; estimateMs: number; finished: boolean }) {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  useEffect(() => {
    if (finished) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [finished]);

  const ticked = finished ? steps.length : Math.min(steps.length - 1, Math.floor((now - started) / (estimateMs / steps.length)));
  const seconds = Math.floor((now - started) / 1000);
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-ai-tint p-5 text-ai-ink">
      <p className="font-display text-lg font-bold">{finished ? "Done" : title}</p>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => {
          const state = index < ticked ? "done" : index === ticked ? "now" : "next";
          return (
            <li key={step} className={`flex items-center gap-2.5 ${state === "next" ? "opacity-60" : ""}`}>
              <span
                aria-hidden="true"
                className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                  state === "done" ? "bg-ai text-white" : state === "now" ? "border-2 border-ai" : "border-2 border-ai/30"
                }`}
              >
                {state === "done" ? <Tick /> : state === "now" ? <span className="size-2.5 animate-pulse rounded-full bg-ai" /> : null}
              </span>
              <span className={state === "now" ? "font-semibold" : ""}>
                {step}
                <span className="sr-only">{state === "done" ? " (done)" : state === "now" ? " (working on it)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {finished ? null : (
        <p aria-hidden="true" className="text-sm tabular-nums">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} · This can take a minute. Keep this page open.
        </p>
      )}
      <p role="status" className="sr-only">
        {finished ? "Done." : steps[ticked]}
      </p>
    </div>
  );
}

// Shows the finished screen briefly, then reloads the page's data
export function useFinishAndRefresh() {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  return {
    refreshing,
    finish: (then: () => void) =>
      window.setTimeout(() => {
        startRefresh(() => {
          router.refresh();
          then();
        });
      }, 900),
  };
}

interface Props {
  action: () => Promise<ActionResult<unknown>>;
  label: string;
  title: string;
  steps: string[];
  estimateMs: number;
  variant?: "ai" | "secondary";
  // Asked first, for actions that replace something
  confirm?: string;
  // Told when the request starts and ends, so nearby buttons can wait
  onBusy?: (busy: boolean) => void;
}

// A button that runs one AI action behind a progress screen
export function AiProgressButton({ action, label, title, steps, estimateMs, variant = "ai", confirm, onBusy }: Props) {
  const [phase, setPhase] = useState<"idle" | "running" | "finished">("idle");
  const [error, setError] = useState<string | null>(null);
  const { finish } = useFinishAndRefresh();

  // Kept-mounted screens keep their state, so clear old errors when the page is hidden
  useLayoutEffect(() => () => setError(null), []);

  function idle() {
    setPhase("idle");
    onBusy?.(false);
  }

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setPhase("running");
    onBusy?.(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        idle();
        return;
      }
      setPhase("finished");
      finish(idle);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
      idle();
    }
  }

  if (phase !== "idle") return <ProgressSteps title={title} steps={steps} estimateMs={estimateMs} finished={phase === "finished"} />;
  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={run} className={variant === "ai" ? AI_BUTTON : SECONDARY}>
        {label}
      </button>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const PLAN_PROGRESS = {
  title: "Writing your marketing plan",
  steps: [
    "Reading your business answers",
    "Looking at your brand, website and photos",
    "Choosing where you’ll show up",
    "Picking what to post about",
    "Setting a weekly rhythm",
    "Listing your first things to do",
    "Checking it against your answers",
  ],
  estimateMs: 45_000,
};

export function PlanProgress({ finished }: { finished: boolean }) {
  return <ProgressSteps {...PLAN_PROGRESS} finished={finished} />;
}

// "Write my plan", with its progress screen
export function WritePlanButton({ again, variant = "ai", onBusy }: { again: boolean; variant?: "ai" | "secondary"; onBusy?: (busy: boolean) => void }) {
  return (
    <AiProgressButton
      action={draftMarketingPlanAction}
      label={again ? "Write my plan again" : "Write my marketing plan"}
      {...PLAN_PROGRESS}
      variant={variant}
      onBusy={onBusy}
      confirm={again ? "This replaces your plan with a new draft for you to approve. Write it again?" : undefined}
    />
  );
}

// Approve the draft, or write it again; each waits while the other runs
export function ApproveOrRewrite({ approve }: { approve: () => Promise<ActionResult> }) {
  const [writing, setWriting] = useState(false);
  const [approving, setApproving] = useState(false);

  async function approveNow() {
    setApproving(true);
    try {
      return await approve();
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className={writing ? "flex flex-col" : "flex flex-wrap items-start gap-3"}>
      {writing ? null : (
        <ActionButton action={approveNow} label="Approve my plan" pendingLabel="Approving…" pendingStatus="Saving your plan and making your steps." variant="primary" />
      )}
      {approving ? null : <WritePlanButton again variant="secondary" onBusy={setWriting} />}
    </div>
  );
}
