"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getModel } from "@/lib/ai";
import { getMyInsights, markMyInsight, myAiKey, saveMyInsights } from "@/lib/data/my-business";
import { OwnerFacingError } from "@/lib/errors";
import { gatherMyInsightInputs } from "@/lib/insights/gather";
import { writeInsights } from "@/lib/insights/generate";
import { INSIGHT_MARKS } from "@/lib/insights/types";
import { runWorkflow } from "@/lib/workflow-runner";

const NO_BUSINESS = "Tell us about your business first.";

// Writes a new set of insights from everything SnapStart knows; the owner's marks carry over
export async function writeInsightsAction(): Promise<ActionResult> {
  const [inputs, saved] = await Promise.all([gatherMyInsightInputs(), getMyInsights()]);
  if (!inputs) return { ok: false, message: NO_BUSINESS };
  const result = await runWorkflow("insights", null, async () => {
    const insights = await writeInsights(getModel(), { inputs, feedback: saved?.feedback ?? {} }, new Date(), await myAiKey());
    if (!(await saveMyInsights(insights))) throw new OwnerFacingError(NO_BUSINESS);
  });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}

const markSchema = z.object({ key: z.string().min(1).max(200), mark: z.enum(INSIGHT_MARKS).nullable() });

export async function markInsightAction(input: unknown): Promise<ActionResult> {
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That insight wasn’t found. Reload the page and try again." };
  const outcome = await markMyInsight(parsed.data.key, parsed.data.mark);
  refresh();
  if (outcome === "no_business") return { ok: false, message: NO_BUSINESS };
  if (outcome === "not_found") return { ok: false, message: "Your insights were refreshed since this page loaded, so here are the new ones." };
  return { ok: true, value: null };
}
