"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getModel } from "@/lib/ai";
import { OwnerFacingError } from "@/lib/errors";
import { getMyBusiness, getMyPlan, myAiKey, saveMyResearch } from "@/lib/data/my-business";
import { researchRequirements } from "@/lib/research/requirements";
import { runWorkflow } from "@/lib/workflow-runner";

// Searches and reads official pages live, then replaces the saved requirements; the last results stay if it fails.
// A plan that already exists isn't changed: the new one waits for the owner's review.
export async function checkRequirementsAction(): Promise<ActionResult> {
  const business = await getMyBusiness();
  if (!business?.profile) return { ok: false, message: "Answer the questions about your business first." };
  const profile = business.profile;

  const result = await runWorkflow("research", null, async () => {
    const plan = await getMyPlan();
    const existingKeys = [...(plan?.steps ?? []), ...(plan?.retired ?? [])].map((step) => step.key);
    const research = await researchRequirements(getModel(), profile, { existingKeys, userKey: await myAiKey() });
    if (!(await saveMyResearch(research, profile))) throw new OwnerFacingError("Your business wasn’t found. Reload the page and try again.");
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true, value: null };
}
