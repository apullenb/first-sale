"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { getModel, practiceMode } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth/server";
import { takeAiRequest } from "@/lib/data/ai-quota";
import {
  createMyBusinessFromIntake,
  deleteMyDetail,
  deleteMyIntakeDraft,
  getMyBusiness,
  saveMyDetails,
  saveMyIntakeDraft,
  updateMyProfileWithHistory,
} from "@/lib/data/my-business";
import { detailInputSchema, detailProblem, isDecisionKey, isDetailKey } from "@/lib/details";
import { businessProfileSchema, US_STATE_CODES } from "@/lib/domain";
import { intakeDraftSchema } from "@/lib/intake/draft-schema";
import { changeSummary, profileImpact } from "@/lib/intake/impact";
import { placeOptions, type PlaceOptions } from "@/lib/intake/places";
import { DESCRIPTION_MAX_LENGTH, suggestIntakeAnswers } from "@/lib/intake/suggest";
import type { IntakeSuggestion } from "@/lib/intake/suggestion-schema";

export type ActionResult<T = null> = { ok: true; value: T } | { ok: false; message: string };

const INVALID_PROFILE = "Some answers are missing or too long. Check them and try again.";
const NO_BUSINESS = "Your business wasn’t found. Reload the page and try again.";

// `simulated`: practice mode, where word matching stands in for AI
export async function suggestAnswersAction(description: unknown): Promise<ActionResult<IntakeSuggestion & { simulated: boolean }>> {
  const user = await getCurrentUser();
  if (typeof description !== "string" || !description.trim() || description.length > DESCRIPTION_MAX_LENGTH) {
    return { ok: false, message: `Describe your idea in up to ${DESCRIPTION_MAX_LENGTH.toLocaleString("en-US")} characters.` };
  }
  const quota = practiceMode() ? "ok" : await takeAiRequest(getDb(), user.id);
  if (quota !== "ok") {
    return {
      ok: false,
      message:
        quota === "owner_limit"
          ? "You’ve asked for a lot of suggestions recently. Try again later, or answer the questions yourself."
          : "AI suggestions are paused for today. You can answer the questions yourself.",
    };
  }
  try {
    const model = getModel();
    return { ok: true, value: { ...(await suggestIntakeAnswers(model, description.trim())), simulated: model.simulated } };
  } catch (error) {
    console.error("Intake suggestions failed:", error instanceof Error ? error.message : error);
    return { ok: false, message: "AI couldn’t suggest answers right now. You can answer the questions yourself." };
  }
}

export async function createBusinessAction(profile: unknown): Promise<ActionResult> {
  const parsed = businessProfileSchema.safeParse(profile);
  if (!parsed.success) return { ok: false, message: INVALID_PROFILE };
  const business = await createMyBusinessFromIntake(parsed.data);
  if (!business) return { ok: false, message: "You already have a business. Edit its answers from Your business." };
  refresh();
  return { ok: true, value: null };
}

// The owner confirmed these changes after seeing what they affect; the history records each one
export async function updateBusinessAction(profile: unknown): Promise<ActionResult> {
  const parsed = businessProfileSchema.safeParse(profile);
  if (!parsed.success) return { ok: false, message: INVALID_PROFILE };
  const current = await getMyBusiness();
  if (!current) return { ok: false, message: NO_BUSINESS };
  const summary = current.profile
    ? changeSummary(profileImpact(current.profile, parsed.data, { researchCheckedAt: null, planSteps: 0, structureDecision: null, documents: [] }))
    : ["Answered the intake questions again"];
  const updated = await updateMyProfileWithHistory(parsed.data, summary);
  if (!updated) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

// Autosave while answering; false when the draft no longer fits, such as after saving in another tab
export async function saveIntakeDraftAction(input: unknown): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = intakeDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Your progress couldn’t be saved. Keep going; we’ll try again." };
  return { ok: true, value: { saved: await saveMyIntakeDraft(parsed.data) } };
}

export async function discardIntakeDraftAction(): Promise<ActionResult> {
  await deleteMyIntakeDraft();
  refresh();
  return { ok: true, value: null };
}

export async function placeOptionsAction(state: unknown): Promise<ActionResult<PlaceOptions>> {
  await getCurrentUser();
  if (typeof state !== "string" || !(US_STATE_CODES as readonly string[]).includes(state)) return { ok: false, message: "Choose a state first." };
  return { ok: true, value: placeOptions(state as (typeof US_STATE_CODES)[number]) };
}

// The owner typed or picked this themselves, so it's saved as theirs
export async function saveDetailAction(input: unknown): Promise<ActionResult> {
  const parsed = detailInputSchema.safeParse(input);
  if (!parsed.success || !isDetailKey(parsed.data.key) || isDecisionKey(parsed.data.key)) {
    return { ok: false, message: "That detail can’t be saved. Reload the page and try again." };
  }
  const problem = detailProblem(parsed.data.key, parsed.data.value);
  if (problem) return { ok: false, message: problem };
  if (!(await saveMyDetails([{ key: parsed.data.key, value: parsed.data.value }]))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

export async function deleteDetailAction(key: unknown): Promise<ActionResult> {
  if (typeof key !== "string" || !isDetailKey(key) || isDecisionKey(key)) return { ok: false, message: "That detail wasn’t found." };
  if (!(await deleteMyDetail(key))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}
