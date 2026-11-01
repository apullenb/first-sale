"use server";

import { z } from "zod";
import { lastMyRun } from "@/lib/data/my-business";
import { WORKFLOWS, type WorkflowId } from "@/lib/workflows";

const jobSchema = z.object({
  workflow: z.string().refine((id): id is WorkflowId => Object.hasOwn(WORKFLOWS, id)),
  subjectId: z.string().max(200).nullable(),
});

// Whether any of these jobs is still running, for a page watching one it didn't start
export async function jobsRunningAction(input: unknown): Promise<boolean> {
  const parsed = z.array(jobSchema).max(10).safeParse(input);
  if (!parsed.success) return false;
  const runs = await Promise.all(parsed.data.map((job) => lastMyRun(job.workflow as WorkflowId, job.subjectId)));
  return runs.some((run) => run?.status === "running");
}
