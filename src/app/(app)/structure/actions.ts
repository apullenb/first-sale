"use server";

import { isDemoSession } from "@/lib/auth/server";
import { DEMO_REFUSAL } from "@/lib/demo";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getModel } from "@/lib/ai";
import { getMyBusiness, getMyDetails, getMyResearchBasis, getMyStructureAdvice, listMyHistory, myAiKey, recordMyDecisions, replanMyPlan, saveMyStructureAdvice } from "@/lib/data/my-business";
import { OwnerFacingError } from "@/lib/errors";
import { adviseStructure } from "@/lib/structure/advise";
import { runWorkflow } from "@/lib/workflow-runner";
import { DETAILS, type DetailKey, detailProblem } from "@/lib/details";
import { profileKey } from "@/lib/research/requirements";
import { fitsOwners } from "@/lib/structure/options";
import { basisLines, suggestPath } from "@/lib/structure/suggest";

const decisionSchema = z.object({
  structure_choice: z.string().max(40),
  name_registration_plan: z.string().max(40),
  tax_classification_plan: z.string().max(40),
});

// The owner reviewed and confirmed these; each change is kept in the history with the answers behind it
export async function recordDecisionsAction(input: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick an answer for each decision, then try again." };
  const values = Object.entries(parsed.data) as [DetailKey, string][];
  for (const [key, value] of values) {
    if (detailProblem(key, value)) return { ok: false, message: `${DETAILS[key].label}: pick one of the options.` };
  }
  const [business, details, history, advice] = await Promise.all([getMyBusiness(), getMyDetails(), listMyHistory({ kind: "decision" }), getMyStructureAdvice()]);
  if (!business?.profile) return { ok: false, message: "Answer the questions about your business first." };
  const structure = parsed.data.structure_choice;
  if (structure !== "undecided" && !fitsOwners(structure, business.profile.owners.count)) {
    return { ok: false, message: "That structure doesn’t fit your number of owners. Pick another and try again." };
  }
  const key = profileKey(business.profile);
  const last = history.find((event) => event.key === "structure_choice");
  // Made with answers that have changed since: confirming again, even unchanged, records the new answers
  const stale = Boolean(last?.basis && last.basis.profileKey !== key);
  const unchanged = values.every(([detailKey, value]) => details.find((detail) => detail.key === detailKey)?.value === value);
  if (unchanged && !stale) return { ok: false, message: "Nothing has changed since you last recorded these." };
  const saved = await recordMyDecisions(
    values.map(([detailKey, value]) => ({ key: detailKey, value })),
    { profileKey: key, answers: basisLines(business.profile), suggested: advice?.profileKey === key ? advice.structure : suggestPath(business.profile).option },
    stale,
  );
  if (!saved) return { ok: false, message: "Your business wasn’t found. Reload the page and try again." };
  // Steps follow the decision straight away; changed answers wait for the next check instead
  const basis = await getMyResearchBasis();
  if (basis && basis.profileKey === key) await replanMyPlan(business.profile, await getMyDetails());
  refresh();
  return { ok: true, value: null };
}

// The AI's recommendation from everything the owner told SnapStart; made again when their answers change
export async function adviseAction(): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const business = await getMyBusiness();
  if (!business?.profile) return { ok: false, message: "Answer the questions about your business first." };
  const profile = business.profile;
  const result = await runWorkflow("structure_advice", null, async () => {
    const advice = await adviseStructure(getModel(), profile, profileKey(profile), { userKey: await myAiKey() });
    if (!(await saveMyStructureAdvice(advice))) throw new OwnerFacingError("Your business wasn’t found. Reload the page and try again.");
  });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}
