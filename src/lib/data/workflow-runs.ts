import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, workflowRuns } from "@/db/schema";
import { type WorkflowId, WORKFLOWS } from "@/lib/workflows";

// Owner-scoped like businesses.ts. A run left "running" past its time limit was cut off and counts as failed.

export interface RunState {
  id: string;
  status: "running" | "succeeded" | "failed";
  message: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export const CUT_OFF_MESSAGE = "This didn’t finish. Try again.";

function settle(row: typeof workflowRuns.$inferSelect, workflow: WorkflowId, now: Date): RunState {
  const stale = row.status === "running" && now.getTime() - row.startedAt.getTime() > WORKFLOWS[workflow].timeLimitMs;
  return {
    id: row.id,
    status: stale ? "failed" : row.status,
    message: stale ? CUT_OFF_MESSAGE : row.message,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

export type StartOutcome = { ok: true; runId: string } | { ok: false; reason: "busy" | "no_business" };

// One run at a time per workflow and subject, so a double click can't start two
export async function startRunForOwner(
  db: Db,
  ownerId: string,
  workflow: WorkflowId,
  subjectId: string | null,
  now = new Date(),
): Promise<StartOutcome> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!business) return { ok: false, reason: "no_business" };
    const [last] = await tx
      .select()
      .from(workflowRuns)
      .where(and(eq(workflowRuns.businessId, business.id), eq(workflowRuns.workflow, workflow), subject(subjectId)))
      .orderBy(desc(workflowRuns.startedAt))
      .limit(1);
    if (last && settle(last, workflow, now).status === "running") return { ok: false, reason: "busy" };

    await tx.delete(workflowRuns).where(and(eq(workflowRuns.businessId, business.id), eq(workflowRuns.workflow, workflow), subject(subjectId)));
    const [row] = await tx
      .insert(workflowRuns)
      .values({ businessId: business.id, workflow, subjectId, startedAt: now })
      .returning();
    return { ok: true, runId: row.id };
  });
}

export async function finishRun(db: Db, runId: string, status: "succeeded" | "failed", message: string | null, now = new Date()) {
  await db.update(workflowRuns).set({ status, message, finishedAt: now }).where(eq(workflowRuns.id, runId));
}

export async function lastRunForOwner(
  db: Db,
  ownerId: string,
  workflow: WorkflowId,
  subjectId: string | null,
  now = new Date(),
): Promise<RunState | null> {
  const [row] = await db
    .select({ run: workflowRuns })
    .from(workflowRuns)
    .innerJoin(businesses, eq(businesses.id, workflowRuns.businessId))
    .where(and(eq(businesses.ownerId, ownerId), eq(workflowRuns.workflow, workflow), subject(subjectId)))
    .orderBy(desc(workflowRuns.startedAt))
    .limit(1);
  return row ? settle(row.run, workflow, now) : null;
}

function subject(subjectId: string | null) {
  return subjectId === null ? isNull(workflowRuns.subjectId) : eq(workflowRuns.subjectId, subjectId);
}
