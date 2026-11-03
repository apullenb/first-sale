import Link from "next/link";
import { JobWatch } from "@/components/job-watch";
import { RunStatus } from "@/components/run-status";
import { TEXT_LINK } from "@/components/styles";
import { CUT_OFF_MESSAGE, type RunState } from "@/lib/data/workflow-runs";
import type { JobRef } from "@/lib/workflows";

export interface ResearchRuns {
  research: RunState | null;
  followUp: RunState | null;
}

// The jobs of a requirements check still running, perhaps started from another tab
export function runningResearch(runs: ResearchRuns): JobRef[] {
  return [
    ...(runs.research?.status === "running" ? [{ workflow: "research" as const, subjectId: null }] : []),
    ...(runs.followUp?.status === "running" ? [{ workflow: "follow_up" as const, subjectId: null }] : []),
  ];
}

// A requirements check still running, followed until it ends, or one the server's time limit cut off; buttons show other failures
export function ResearchRunStatus({ runs, retryHref }: { runs: ResearchRuns; retryHref?: string }) {
  const running = runningResearch(runs);
  if (running.length) return <JobWatch jobs={running} what="Your requirements check" />;
  // The deeper look restarts on its own, so only a cut-off search is reported
  if (!(runs.research?.status === "failed" && runs.research.message === CUT_OFF_MESSAGE)) return null;
  return (
    <div className="flex flex-col items-start gap-1">
      <RunStatus status="failed" job={{ workflow: "research", subjectId: null }} message={null} what="Your requirements check" />
      {retryHref ? (
        <Link href={retryHref} className={`flex min-h-11 items-center ${TEXT_LINK}`}>
          Try again from What applies to you
        </Link>
      ) : null}
    </div>
  );
}
