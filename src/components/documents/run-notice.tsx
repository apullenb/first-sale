import { RunStatus } from "@/components/run-status";
import { CUT_OFF_MESSAGE, type RunState } from "@/lib/data/workflow-runs";

// Shows a run that's still going or was cut off; other failures show next to the button that started them
export function RunNotice({ run, what }: { run: RunState | null; what: string }) {
  if (!run) return null;
  if (run.status === "running") return <RunStatus status="running" message={null} what={what} />;
  if (run.status === "failed" && run.message === CUT_OFF_MESSAGE) return <RunStatus status="failed" message={run.message} what={what} />;
  return null;
}
