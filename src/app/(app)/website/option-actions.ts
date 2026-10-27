"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { PLATFORM_DATA, PLATFORM_ORDER } from "@/data/website-platforms";
import { getModel } from "@/lib/ai";
import { getMyBusiness, getMyWebsitePlan, myAiKey, updateMyWebsitePlan } from "@/lib/data/my-business";
import { OwnerFacingError } from "@/lib/errors";
import { explainOption, findMoreOptions, isCurrentExplanation, platformFacts } from "@/lib/website/options";
import { PLATFORMS } from "@/lib/website/types";
import { runWorkflow } from "@/lib/workflow-runner";

const NO_BUSINESS = "Tell us about your business first.";

// Muse searches the web for other builders, only when the owner asks
export async function findMoreOptionsAction(): Promise<ActionResult> {
  const business = await getMyBusiness();
  if (!business?.profile) return { ok: false, message: NO_BUSINESS };
  // Practice mode can't search, so it says so without using up an AI request
  if (!getModel().webSearch) return { ok: false, message: "Searching for more options needs the AI service, which isn’t connected yet." };
  const profile = business.profile;
  const result = await runWorkflow("website_options", null, async () => {
    const found = await findMoreOptions(getModel(), { profile, exclude: PLATFORM_ORDER.map((id) => PLATFORM_DATA[id].name), userKey: await myAiKey() });
    // Explanations of the last search's options go with it
    const saved = await updateMyWebsitePlan((plan) => ({
      moreOptions: found,
      explanations: Object.fromEntries(Object.entries(plan?.explanations ?? {}).filter(([key]) => !key.startsWith("more:"))),
    }));
    if (saved === "no_business") throw new OwnerFacingError(NO_BUSINESS);
  });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}

const keySchema = z.string().max(80).regex(/^(platform|more):/);

// "Explain more" for one option: built-in ones from the checked facts, found ones from their search results
export async function explainOptionAction(input: unknown): Promise<ActionResult> {
  const parsed = keySchema.safeParse(input);
  const [business, plan] = await Promise.all([getMyBusiness(), getMyWebsitePlan()]);
  if (!business?.profile) return { ok: false, message: NO_BUSINESS };
  if (!parsed.success) return { ok: false, message: "That option wasn’t found. Reload the page and try again." };
  const key = parsed.data;

  let name: string;
  let facts: unknown;
  const platform = z.enum(PLATFORMS).safeParse(key.slice("platform:".length));
  if (key.startsWith("platform:") && platform.success) {
    const info = PLATFORM_DATA[platform.data];
    name = info.name;
    facts = platformFacts(info);
  } else {
    const option = plan?.moreOptions?.options.find((each) => `more:${each.name.toLowerCase()}` === key);
    if (!option) return { ok: false, message: "That option wasn’t found. Search again and try once more." };
    name = option.name;
    facts = option;
  }
  if (isCurrentExplanation(plan?.explanations[key], business.profile, facts, getModel().simulated)) {
    refresh();
    return { ok: true, value: null };
  }

  const profile = business.profile;
  const result = await runWorkflow("website_explain", key, async () => {
    const explanation = await explainOption(getModel(), { profile, name, facts, userKey: await myAiKey() });
    if ((await updateMyWebsitePlan((latest) => ({ explanations: { ...(latest?.explanations ?? {}), [key]: explanation } }))) === "no_business") {
      throw new OwnerFacingError(NO_BUSINESS);
    }
  });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}
