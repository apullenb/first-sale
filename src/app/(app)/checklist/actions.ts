"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { createMyDocument, getMyPaperwork, setMyStepStatus } from "@/lib/data/my-business";
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
    return { ok: false, message: "Leave Social Security and tax id numbers out of notes. Keep them somewhere safe instead." };
  }
  const saved = await setMyStepStatus({ stepId, status, note });
  if (!saved) return { ok: false, message: "That step wasn’t found. Reload the page and try again." };
  refresh();
  return { ok: true, value: null };
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
