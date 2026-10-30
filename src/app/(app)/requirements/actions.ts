"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getDb } from "@/db/client";
import { getModel } from "@/lib/ai";
import { OwnerFacingError } from "@/lib/errors";
import { getMyBusiness, getMyDetails, getMyPlan, getMyResearch, myAiKey, replanMyPlan, saveMyFollowUp, saveMyResearch, setMyConditionAnswer } from "@/lib/data/my-business";
import { draftOf } from "@/lib/data/research";
import { dbSearchCache } from "@/lib/data/search-cache";
import { CONDITION_ANSWERS, placeOf } from "@/lib/research/applicability";
import { followUpCandidates, followUpRequirements } from "@/lib/research/follow-up";
import { profileKey, researchRequirements } from "@/lib/research/requirements";
import { runWorkflow } from "@/lib/workflow-runner";

// Searches for official pages (or reuses a search from the past week), reads them live, then replaces the saved requirements; the last results stay if it fails.
// A plan that already exists isn't changed: the new one waits for the owner's review.
export async function checkRequirementsAction(): Promise<ActionResult> {
  const business = await getMyBusiness();
  if (!business?.profile) return { ok: false, message: "Answer the questions about your business first." };
  const profile = business.profile;

  const result = await runWorkflow("research", null, async () => {
    const [plan, details] = await Promise.all([getMyPlan(), getMyDetails()]);
    const existingKeys = [...(plan?.steps ?? []), ...(plan?.retired ?? [])].map((step) => step.key);
    const research = await researchRequirements(getModel(), profile, { existingKeys, userKey: await myAiKey(), details, searchCache: dbSearchCache(getDb()) });
    if (!(await saveMyResearch(research, profile))) throw new OwnerFacingError("Your business wasn’t found. Reload the page and try again.");
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true, value: null };
}

// Runs right after a check: looks deeper into what no official page confirmed, on each office's own site.
// What's still open becomes one step per office, with background and a message to send.
export async function followUpAction(): Promise<ActionResult> {
  const [business, research] = await Promise.all([getMyBusiness(), getMyResearch()]);
  if (!business?.profile || !research?.profile) return { ok: false, message: "Find your requirements first." };
  if (profileKey(business.profile) !== research.profileKey) {
    return { ok: false, message: "Your answers changed since your requirements were checked. Re-check sources first." };
  }
  const candidates = followUpCandidates(research.requirements);
  if (!candidates.length) return { ok: true, value: null };
  const checked = research.profile;

  const result = await runWorkflow("follow_up", null, async () => {
    const found = await followUpRequirements(getModel(), checked, placeOf(checked), candidates.map(draftOf), {
      userKey: await myAiKey(),
      cache: dbSearchCache(getDb()),
    });
    const outcome = await saveMyFollowUp(research.checkedAt, found, business.profile!, await getMyDetails());
    if (outcome === "no_business") throw new OwnerFacingError("Your business wasn’t found. Reload the page and try again.");
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true, value: null };
}

// After a decision like the business structure changes: rebuilds the plan from saved research, no new search
export async function replanAction(): Promise<ActionResult> {
  const [business, research] = await Promise.all([getMyBusiness(), getMyResearch()]);
  if (!business?.profile) return { ok: false, message: "Answer the questions about your business first." };
  // Changed answers can change which rules apply, so only a new check can plan from them
  if (research && profileKey(business.profile) !== research.profileKey) {
    return { ok: false, message: "Your answers changed since your requirements were checked. Re-check sources to see what applies now." };
  }
  const outcome = await replanMyPlan(business.profile, await getMyDetails());
  refresh();
  if (outcome === "no_research") return { ok: false, message: "Find your requirements first, so there’s research to plan from." };
  if (outcome === "no_business") return { ok: false, message: "Your business wasn’t found. Reload the page and try again." };
  return { ok: true, value: null };
}

const answerSchema = z.object({ stepKey: z.string().max(60), condition: z.string().max(400), answer: z.enum(CONDITION_ANSWERS).nullable() });

// The owner's yes, no or not sure to "does this apply to you?"; null takes the answer back
export async function answerConditionAction(input: unknown): Promise<ActionResult> {
  const parsed = answerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Something was off with that answer. Reload the page and try again." };
  const outcome = await setMyConditionAnswer(parsed.data);
  if (outcome === "no_business") return { ok: false, message: "Your business wasn’t found. Reload the page and try again." };
  if (outcome === "not_asked") return { ok: false, message: "This question changed since you opened the page. Reload to see it as it is now." };
  refresh();
  return { ok: true, value: null };
}
