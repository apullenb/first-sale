import type { PlanStep } from "@/lib/data/plan";
import { taskReadiness } from "@/lib/rules/checklist";
import { Icon } from "@/components/icons";
import { Chip } from "@/components/ui";

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
      <Chip tone="done" icon="check">
        Done
      </Chip>
    );
  }
  if (state.state === "submitted") {
    return (
      <Chip tone="warn" icon="hourglass">
        Submitted, waiting to hear back
      </Chip>
    );
  }
  if (state.state === "ready") {
    return (
      <Chip tone="accent" icon="arrow">
        Ready to start
      </Chip>
    );
  }
  return (
    <span className="inline-flex w-fit items-center gap-1.5 text-sm text-muted">
      <Icon name="lock" size="xs" />
      Locked: finish {LIST.format(state.waitingOn.map((step) => `“${step.title}”`))} first
    </span>
  );
}
