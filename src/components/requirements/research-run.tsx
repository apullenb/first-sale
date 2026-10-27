import Link from "next/link";
import { RunStatus } from "@/components/run-status";
import { TEXT_LINK } from "@/components/styles";
import { CUT_OFF_MESSAGE, type RunState } from "@/lib/data/workflow-runs";

// A requirements check still running, or one the server's time limit cut off; buttons show other failures
export function ResearchRunStatus({ run, retryHref }: { run: RunState | null; retryHref?: string }) {
  if (!run) return null;
  const cutOff = run.status === "failed" && run.message === CUT_OFF_MESSAGE;
  if (run.status !== "running" && !cutOff) return null;
  return (
    <div className="flex flex-col items-start gap-1">
      <RunStatus status={cutOff ? "failed" : "running"} message={null} what="Your requirements check" />
      {cutOff && retryHref ? (
        <Link href={retryHref} className={`flex min-h-11 items-center ${TEXT_LINK}`}>
          Try again from Requirements
        </Link>
      ) : null}
    </div>
  );
}
