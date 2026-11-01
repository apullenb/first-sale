import "server-only";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/server";
import { practiceMode } from "@/lib/ai";
import { takeAiRequest } from "@/lib/data/ai-quota";
import { finishMyRun, lastMyRun, startMyRun } from "@/lib/data/my-business";
import { OwnerFacingError } from "@/lib/errors";
import { type JobRef, type WorkflowId, WORKFLOWS } from "@/lib/workflows";

export type RunResult<T> = { ok: true; value: T } | { ok: false; message: string; busy?: JobRef };

const GENERIC = "That didn’t work this time. Your saved work is safe. Try again in a few minutes.";
export const ALREADY_RUNNING = "This is already running, maybe in another tab. This page shows the result when it finishes.";

// Runs one workflow for the signed-in owner: checks the AI limit, refuses a second copy while one runs,
// and records how it ended so a reload can show it. Logs never include document text or the owner's answers.
export async function runWorkflow<T>(workflow: WorkflowId, subjectId: string | null, job: () => Promise<T>): Promise<RunResult<T>> {
  const user = await getCurrentUser();
  const busy = { ok: false as const, message: ALREADY_RUNNING, busy: { workflow, subjectId } };
  // A copy already running isn't charged to the AI limit
  if ((await lastMyRun(workflow, subjectId))?.status === "running") return busy;
  if (WORKFLOWS[workflow].usesAi && !practiceMode()) {
    const quota = await takeAiRequest(getDb(), user.id);
    if (quota !== "ok") {
      const message =
        quota === "owner_limit"
          ? "You’ve made a lot of AI requests recently. Try again in an hour."
          : "AI help is paused for today. Try again tomorrow.";
      // Recorded, so a page that started this in the background (like reading a new upload) can say why
      const blocked = await startMyRun(workflow, subjectId);
      if (blocked.ok) await finishMyRun(blocked.runId, "failed", message);
      return { ok: false, message };
    }
  }

  const started = await startMyRun(workflow, subjectId);
  if (!started.ok) return started.reason === "busy" ? busy : { ok: false, message: "Your business wasn’t found. Reload the page and try again." };

  try {
    const value = await job();
    await finishMyRun(started.runId, "succeeded", null);
    return { ok: true, value };
  } catch (error) {
    const message = error instanceof OwnerFacingError ? error.message : GENERIC;
    await finishMyRun(started.runId, "failed", message).catch(() => {});
    if (!(error instanceof OwnerFacingError)) {
      const status = typeof error === "object" && error && "status" in error ? String((error as { status: unknown }).status) : "";
      console.error(`Workflow ${workflow} failed:`, error instanceof Error ? error.name : "unknown error", status);
    }
    return { ok: false, message };
  }
}

