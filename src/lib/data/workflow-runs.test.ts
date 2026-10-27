import { beforeEach, describe, expect, it } from "vitest";
import { workflowRuns } from "@/db/schema";
import { WORKFLOWS } from "@/lib/workflows";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { CUT_OFF_MESSAGE, finishRun, lastRunForOwner, startRunForOwner } from "./workflow-runs";

let db: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  db = await createTestDb();
  await seedOwners(db);
});

const START = new Date("2026-10-27T12:00:00Z");
const after = (ms: number) => new Date(START.getTime() + ms);

async function start(ownerId = "owner-a", subjectId: string | null = null, now = START): Promise<string> {
  const outcome = await startRunForOwner(db, ownerId, "research", subjectId, now);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.runId;
}

describe("workflow runs", () => {
  it("is busy while a run is going, then free once it finishes", async () => {
    const runId = await start();
    expect(await lastRunForOwner(db, "owner-a", "research", null, after(1000))).toMatchObject({ id: runId, status: "running", message: null });
    expect(await startRunForOwner(db, "owner-a", "research", null, after(1000))).toEqual({ ok: false, reason: "busy" });

    await finishRun(db, runId, "failed", "Couldn’t reach the sites", after(2000));
    expect(await lastRunForOwner(db, "owner-a", "research", null, after(3000))).toEqual({
      id: runId,
      status: "failed",
      message: "Couldn’t reach the sites",
      startedAt: START,
      finishedAt: after(2000),
    });
    const next = await startRunForOwner(db, "owner-a", "research", null, after(4000));
    expect(next.ok).toBe(true);
  });

  it("counts a run left running past its time limit as cut off, and lets a new one start", async () => {
    await start();
    const limit = WORKFLOWS.research.timeLimitMs;

    expect((await lastRunForOwner(db, "owner-a", "research", null, after(limit)))?.status).toBe("running");
    expect(await lastRunForOwner(db, "owner-a", "research", null, after(limit + 1))).toMatchObject({
      status: "failed",
      message: CUT_OFF_MESSAGE,
      finishedAt: null,
    });
    expect((await startRunForOwner(db, "owner-a", "research", null, after(limit + 1))).ok).toBe(true);
  });

  it("keeps only the latest run for each workflow and subject", async () => {
    const first = await start();
    await finishRun(db, first, "succeeded", null, after(10));
    const second = await start("owner-a", null, after(20));

    expect(await db.select().from(workflowRuns)).toHaveLength(1);
    expect((await lastRunForOwner(db, "owner-a", "research", null, after(30)))?.id).toBe(second);
  });

  it("runs separately for each subject, workflow and owner", async () => {
    await start("owner-a", "doc-1");
    expect((await startRunForOwner(db, "owner-a", "research", "doc-2", START)).ok).toBe(true);
    expect((await startRunForOwner(db, "owner-a", "research", null, START)).ok).toBe(true);
    expect((await startRunForOwner(db, "owner-a", "explain_document", "doc-1", START)).ok).toBe(true);
    expect((await startRunForOwner(db, "owner-b", "research", "doc-1", START)).ok).toBe(true);
    expect(await startRunForOwner(db, "owner-a", "research", "doc-1", START)).toEqual({ ok: false, reason: "busy" });

    expect(await lastRunForOwner(db, "owner-a", "business_plan", null, START)).toBeNull();
  });

  it("shows owners only their own runs", async () => {
    await start("owner-a");
    expect(await lastRunForOwner(db, "owner-b", "research", null, START)).toBeNull();
  });

  it("lets only one of several starts at the same time through", async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => startRunForOwner(db, "owner-a", "research", null, START)));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual(Array(3).fill({ ok: false, reason: "busy" }));
  });

  it("refuses an owner without a business", async () => {
    expect(await startRunForOwner(db, "nobody", "research", null, START)).toEqual({ ok: false, reason: "no_business" });
  });
});
