"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getDb } from "@/db/client";
import { getModel } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth/server";
import { takeAiRequest } from "@/lib/data/ai-quota";
import { getMyBusiness, saveMyResearch } from "@/lib/data/my-business";
import { ResearchError, researchRequirements } from "@/lib/research/requirements";

// Reads the official pages live and replaces the saved requirements; the last results stay if it fails
export async function checkRequirementsAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  const business = await getMyBusiness();
  if (!business?.profile) return { ok: false, message: "Answer the questions about your business first." };

  const quota = await takeAiRequest(getDb(), user.id);
  if (quota !== "ok") {
    return {
      ok: false,
      message:
        quota === "owner_limit"
          ? "You’ve made a lot of AI requests recently. Try again in an hour."
          : "AI research is paused for today. Try again tomorrow.",
    };
  }

  try {
    const research = await researchRequirements(getModel(), business.profile);
    if (!(await saveMyResearch(research, business.profile))) {
      return { ok: false, message: "Your business wasn’t found. Reload the page and try again." };
    }
  } catch (error) {
    if (error instanceof ResearchError) return { ok: false, message: error.message };
    console.error("Requirements research failed:", error instanceof Error ? error.message : error);
    return { ok: false, message: "Checking your requirements didn’t work this time. Try again in a few minutes." };
  }
  refresh();
  return { ok: true, value: null };
}
