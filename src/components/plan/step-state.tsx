import type { PlanStep } from "@/lib/data/plan";
import { taskReadiness } from "@/lib/rules/checklist";

export type StepState = { state: "done" } | { state: "submitted" } | { state: "ready" } | { state: "waiting"; waitingOn: PlanStep[] };

// By step key. Retired steps count as done; prerequisites no longer in the plan don't block.
export function stepStates(all: readonly PlanStep[]): Map<string, StepState> {
  const byKey = new Map(all.map((step) => [step.key, step]));
  const done = new Set(all.filter((step) => step.status === "done").map((step) => step.key));
  const nodes = all.map((step) => ({ id: step.key, prerequisites: step.prerequisites.filter((key) => byKey.has(key)) }));
  return new Map(
    taskReadiness(nodes, done).map((readiness): [string, StepState] => [
      readiness.id,
      readiness.state === "waiting"
        ? { state: "waiting", waitingOn: readiness.waitingOn.flatMap((key) => byKey.get(key) ?? []) }
        : readiness.state === "ready" && byKey.get(readiness.id)?.status === "submitted"
          ? { state: "submitted" }
          : { state: readiness.state },
    ]),
  );
}

const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

export function StepStateLabel({ state }: { state: StepState | undefined }) {
  if (!state) return null;
  if (state.state === "done") {
    return (
      <span className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full bg-accent-tint px-2.5 py-0.5 text-[13px] font-semibold text-accent-ink">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Done
      </span>
    );
  }
  if (state.state === "submitted") {
    return (
      <span className="inline-flex w-fit items-center whitespace-nowrap rounded-full bg-ai-tint px-2.5 py-0.5 text-[13px] font-semibold text-ai-ink">
        Submitted, waiting to hear back
      </span>
    );
  }
  if (state.state === "ready") {
    return (
      <span className="inline-flex w-fit items-center whitespace-nowrap rounded-full bg-surface px-2.5 py-0.5 text-[13px] font-semibold text-accent-ink ring-1 ring-accent/40">
        Ready to start
      </span>
    );
  }
  return <span className="text-sm text-muted">Waiting on {LIST.format(state.waitingOn.map((step) => `“${step.title}”`))}</span>;
}
