"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { getModel } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth/server";
import { takeAiRequest } from "@/lib/data/ai-quota";
import {
  createMyBusiness,
  getMyBusiness,
  rememberCurrentBusiness,
  updateMyBusinessProfile,
} from "@/lib/data/my-businesses";
import { businessProfileSchema, MAX_BUSINESSES_PER_OWNER } from "@/lib/domain";
import { DESCRIPTION_MAX_LENGTH, suggestIntakeAnswers } from "@/lib/intake/suggest";
import type { IntakeSuggestion } from "@/lib/intake/suggestion-schema";

export type ActionResult<T = null> = { ok: true; value: T } | { ok: false; message: string };

const INVALID_PROFILE = "Some answers are missing or too long. Check them and try again.";
const NOT_FOUND = "That business wasn’t found.";

export async function suggestAnswersAction(description: unknown): Promise<ActionResult<IntakeSuggestion>> {
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
    return { ok: true, value: await suggestIntakeAnswers(getModel(), description.trim()) };
  } catch (error) {
    console.error("Intake suggestions failed:", error instanceof Error ? error.message : error);
    return { ok: false, message: "AI couldn’t suggest answers right now. You can answer the questions yourself." };
  }
}

export async function createBusinessAction(profile: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = businessProfileSchema.safeParse(profile);
  if (!parsed.success) return { ok: false, message: INVALID_PROFILE };
  const business = await createMyBusiness({ profile: parsed.data });
  if (!business) return { ok: false, message: `You can have up to ${MAX_BUSINESSES_PER_OWNER} businesses.` };
  await rememberCurrentBusiness(business.id);
  refresh();
  return { ok: true, value: { id: business.id } };
}

export async function updateBusinessAction(businessId: unknown, profile: unknown): Promise<ActionResult> {
  const parsed = businessProfileSchema.safeParse(profile);
  if (typeof businessId !== "string" || !parsed.success) return { ok: false, message: INVALID_PROFILE };

  const updated = await updateMyBusinessProfile(businessId, parsed.data);
  if (!updated) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

export async function switchBusinessAction(businessId: unknown): Promise<ActionResult> {
  if (typeof businessId !== "string" || !(await getMyBusiness(businessId))) {
    return { ok: false, message: NOT_FOUND };
  }
  await rememberCurrentBusiness(businessId);
  refresh();
  return { ok: true, value: null };
}
