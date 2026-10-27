"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { getModel } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth/server";
import { takeAiRequest } from "@/lib/data/ai-quota";
import { createMyBusiness, deleteMyDetail, saveMyDetails, updateMyBusinessProfile } from "@/lib/data/my-business";
import { detailInputSchema, detailProblem, isDetailKey } from "@/lib/details";
import { businessProfileSchema } from "@/lib/domain";
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
  const quota = await takeAiRequest(getDb(), user.id);
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
  const business = await createMyBusiness({ profile: parsed.data });
  if (!business) return { ok: false, message: "You already have a business. Edit its answers from Your business." };
  refresh();
  return { ok: true, value: null };
}

export async function updateBusinessAction(profile: unknown): Promise<ActionResult> {
  const parsed = businessProfileSchema.safeParse(profile);
  if (!parsed.success) return { ok: false, message: INVALID_PROFILE };

  const updated = await updateMyBusinessProfile(parsed.data);
  if (!updated) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

// The owner typed or picked this themselves, so it's saved as theirs
export async function saveDetailAction(input: unknown): Promise<ActionResult> {
  const parsed = detailInputSchema.safeParse(input);
  if (!parsed.success || !isDetailKey(parsed.data.key)) return { ok: false, message: "That detail can’t be saved. Reload the page and try again." };
  const problem = detailProblem(parsed.data.key, parsed.data.value);
  if (problem) return { ok: false, message: problem };
  if (!(await saveMyDetails([{ key: parsed.data.key, value: parsed.data.value }]))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

export async function deleteDetailAction(key: unknown): Promise<ActionResult> {
  if (typeof key !== "string" || !isDetailKey(key)) return { ok: false, message: "That detail wasn’t found." };
  if (!(await deleteMyDetail(key))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}
