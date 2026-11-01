"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import { createMyDocument, getMyBusiness, getMyDetails, getMyPaperwork, getMyStep, setMyStepStatus } from "@/lib/data/my-business";
import { filedForm, formsFor } from "@/lib/documents/form-catalog";
import { placeOf, structureOf } from "@/lib/research/applicability";
import { stepKindOf, waitsOnOffice } from "@/lib/rules/step-kind";
import { looksLikeIdNumber } from "@/lib/details";
import { EMPTY_CONTENT } from "@/lib/documents/types";
import { startupPlanPdf } from "@/lib/documents/startup-plan";
import { stillToSettle } from "@/lib/rules/paperwork";
import { displayName } from "@/lib/intake/answers";

const statusSchema = z.object({
  stepId: z.string().max(60),
  status: z.enum(["todo", "submitted", "done"]),
  note: z.string().max(500).nullable(),
  // The owner ticked "I finished this myself"
  confirmed: z.boolean(),
});

export async function setStepStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Keep the note under 500 characters." };
  const { stepId, status, confirmed } = parsed.data;
  if (status !== "todo" && !confirmed) {
    return { ok: false, message: status === "submitted" ? "Tick the box to confirm you submitted it yourself." : "Tick the box to confirm you finished this step." };
  }
  const note = parsed.data.note?.trim() || null;
  if (note && looksLikeIdNumber(note)) {
    return { ok: false, message: "Leave Social Security and tax ID numbers out of notes. Keep them somewhere safe instead." };
  }
  if (status !== "todo") {
    const refused = await kindRefuses(stepId, status);
    if (refused) return { ok: false, message: refused };
  }
  const saved = await setMyStepStatus({ stepId, status, note });
  if (!saved) return { ok: false, message: "That step wasn’t found. Reload the page and try again." };
  refresh();
  return { ok: true, value: null };
}

// Only a filing or a question to an office is sent; a structure decision is done once that structure is recorded
async function kindRefuses(stepId: string, status: "submitted" | "done"): Promise<string | null> {
  const [found, business, details] = await Promise.all([getMyStep(stepId), getMyBusiness(), getMyDetails()]);
  if (!found) return null;
  const profile = business?.profile ?? null;
  const decision = profile ? structureOf(profile, details) : null;
  const forms = profile ? formsFor(OFFICIAL_FORMS, found.step, placeOf(profile), decision?.structure ?? null) : [];
  const kind = stepKindOf(found.step, { hasForm: Boolean(filedForm(forms)) });
  if (status === "submitted" && !waitsOnOffice(kind)) return "Nothing is sent to an office for this step. Mark it done instead.";
  const forStructures = found.step.forStructures;
  if (status === "done" && kind === "decision" && forStructures.length && !(decision?.structure && forStructures.includes(decision.structure))) {
    return "Record your choice on Business structure first.";
  }
  return null;
}

// A printable copy of the steps that apply, as they stand, saved to the document library
export async function savePlanPdfAction(): Promise<ActionResult<string>> {
  const paper = await getMyPaperwork();
  const steps = (paper?.view.tasks ?? []).map((task) => ({ ...task.step, requirementStatus: task.requirementStatus, conditions: task.conditions }));
  if (!paper || steps.length === 0) return { ok: false, message: "Find what applies to you first, so there are steps to save." };
  const now = new Date();
  const maybe = stillToSettle(paper.view).map((standing) => ({ title: standing.step.title, why: standing.step.why, conditions: standing.conditions }));
  const bytes = await startupPlanPdf({ businessName: displayName(paper.profile), steps, maybe, now });
  const created = await createMyDocument({
    title: `Licenses and registrations${steps.some((step) => step.simulated) ? " (practice)" : ""}, ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`,
    origin: "generated",
    generatedKind: "startup_plan",
    mimeType: "application/pdf",
    data: bytes,
    sha256: null,
    content: EMPTY_CONTENT,
  });
  if (!created.ok) {
    return { ok: false, message: created.reason === "too_many" || created.reason === "too_large" ? "Your document library is full. Delete a document you don’t need, then try again." : "Your business wasn’t found. Reload the page and try again." };
  }
  refresh();
  return { ok: true, value: created.id };
}
