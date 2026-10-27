"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { officialForm } from "@/data/official-forms";
import { createMyDocument, getMyBusiness, getMyDetails, getMyDocument, getMyStep, listMyDocuments, updateMyDocument } from "@/lib/data/my-business";
import type { CreateOutcome } from "@/lib/data/documents";
import { autofillContext, autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { formsFor } from "@/lib/documents/form-catalog";
import { answerGuide, officialOriginal, refreshedAnswers } from "@/lib/documents/form-prep";
import { UPLOAD_ROLES } from "@/lib/documents/library";
import { downloadOfficialForm } from "@/lib/documents/official-forms";
import { readAndSave } from "@/lib/documents/read-and-save";
import { EMPTY_CONTENT } from "@/lib/documents/types";
import { checkUpload, MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { OFFICIAL_FORMS } from "@/data/official-forms";
import { OwnerFacingError } from "@/lib/errors";
import { placeOf, structureOf } from "@/lib/research/applicability";
import { runWorkflow } from "@/lib/workflow-runner";

// Official forms, answer guides, refreshed drafts and filing records. Nothing here files or submits anything.

const id = z.string().min(1).max(60);
const formInput = z.object({ stepId: id, formKey: z.string().min(1).max(60), requestKey: z.string().min(8).max(80) });

function failure(outcome: Exclude<CreateOutcome, { ok: true }>): string {
  if (outcome.reason === "too_many" || outcome.reason === "too_large") return "Your document library is full. Delete documents you don’t need, then try again.";
  if (outcome.reason === "bad_task") return "That plan step wasn’t found. Reload the page and try again.";
  return "That document wasn’t found. Reload the page and try again.";
}

// The step and form must belong together, so a form can't be attached to an unrelated step
async function stepAndForm(stepId: string, formKey: string) {
  const [found, business, details] = await Promise.all([getMyStep(stepId), getMyBusiness(), getMyDetails()]);
  const form = officialForm(formKey);
  if (!found || !business?.profile || !form) return null;
  const fitting = formsFor(OFFICIAL_FORMS, found.step, placeOf(business.profile), structureOf(business.profile, details).structure);
  if (!fitting.some((each) => each.key === form.key)) return null;
  return { step: found.step, form, profile: business.profile };
}

export async function getOfficialFormAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = formInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const found = await stepAndForm(parsed.data.stepId, parsed.data.formKey);
  if (!found?.form.pdfUrl) return { ok: false, message: "That form isn’t available for this step. Reload the page and try again." };
  const { form, profile } = found;

  // One checked original per form: a second click or a retry opens the one already saved; one that failed a check can be fetched again
  const existing = (await listMyDocuments()).find((doc) => doc.formKey === form.key && doc.role === "original" && doc.verification?.ok);
  if (existing) return { ok: true, value: existing.id };

  const result = await runWorkflow("official_form", parsed.data.stepId, async () => {
    const now = new Date();
    const download = await downloadOfficialForm(form, fetch, now);
    if (!download.ok) {
      throw new OwnerFacingError(`${download.reason}. Nothing was saved. Try again in a few minutes, or download it yourself from the official page and upload it here.`);
    }
    const ctx = autofillContext(profile, await getMyDetails());
    const prepared = officialOriginal(form, download, ctx, { stepId: parsed.data.stepId, requestKey: parsed.data.requestKey, now });
    const created = await createMyDocument(prepared);
    if (!created.ok) throw new OwnerFacingError(failure(created));
    return created.id;
  });
  refresh();
  return result;
}

export async function prepareAnswerGuideAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = formInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const found = await stepAndForm(parsed.data.stepId, parsed.data.formKey);
  if (!found) return { ok: false, message: "That application isn’t available for this step. Reload the page and try again." };
  const existing = (await listMyDocuments()).find((doc) => doc.formKey === found.form.key && doc.role === "answer_guide");
  if (existing) return { ok: true, value: existing.id };

  const ctx = autofillContext(found.profile, await getMyDetails());
  const created = await createMyDocument(answerGuide(found.form, ctx, { stepId: parsed.data.stepId, requestKey: parsed.data.requestKey, now: new Date() }));
  if (!created.ok) return { ok: false, message: failure(created) };
  refresh();
  return { ok: true, value: created.id };
}

// Drafts the answers again from current details: changed ones are redrafted, new details fill blanks, confirmed answers on unchanged details stay
export async function refreshDraftAction(documentId: unknown): Promise<ActionResult> {
  const parsed = id.safeParse(documentId);
  const [doc, business, details] = await Promise.all([parsed.success ? getMyDocument(parsed.data) : null, getMyBusiness(), getMyDetails()]);
  if (!doc || doc.origin === "generated") return { ok: false, message: "That document wasn’t found. It may have been deleted." };
  if (!business?.profile) return { ok: false, message: "Update your business answers first." };
  const facts = autofillFacts(business.profile, details);
  const outdated = outdatedFacts(doc.factsUsed, facts);
  const form = doc.formKey ? officialForm(doc.formKey) : null;
  // Rules only for blanks they were checked against; other drafts swap in the new values
  const usable = form && (doc.role === "answer_guide" ? { ...form, fields: form.guide ?? form.fields } : doc.verification?.ok && form.fields.length ? form : null);
  if (!outdated.length && !usable) return { ok: true, value: null };
  const { answers, used } = refreshedAnswers(doc, usable, outdated, autofillContext(business.profile, details), facts);
  await updateMyDocument(doc.id, { answers, factsUsed: used });
  refresh();
  return { ok: true, value: null };
}

const roleField = z.enum(UPLOAD_ROLES);
const requestField = z.string().min(8).max(80).nullable().catch(null);

// Receipts, approvals and supporting papers for a step: saved as uploaded, not sent to the AI service
export async function uploadRecordAction(form: FormData): Promise<ActionResult<string>> {
  const file = form.get("file");
  const stepId = id.safeParse(form.get("stepId"));
  const role = roleField.safeParse(form.get("role"));
  const requestKey = requestField.parse(form.get("requestKey"));
  if (!(file instanceof File) || !stepId.success || !role.success) return { ok: false, message: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "That file is over 4 MB. Try a smaller scan, or a photo of each page." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes, file.name);
  if (!check.ok) return check;
  const created = await createMyDocument({
    title: check.title,
    origin: "upload",
    role: role.data,
    mimeType: check.type,
    data: bytes,
    sha256: check.sha256,
    taskId: stepId.data,
    content: EMPTY_CONTENT,
    requestKey,
  });
  if (!created.ok) return { ok: false, message: failure(created) };
  refresh();
  return { ok: true, value: created.id };
}

// A new version of an uploaded file; the earlier one stays in its history
export async function replaceDocumentAction(form: FormData): Promise<ActionResult<string>> {
  const file = form.get("file");
  const documentId = id.safeParse(form.get("documentId"));
  const requestKey = requestField.parse(form.get("requestKey"));
  if (!(file instanceof File) || !documentId.success) return { ok: false, message: "Choose a file to upload." };
  const doc = await getMyDocument(documentId.data);
  if (!doc || doc.origin !== "upload") return { ok: false, message: "Only files you uploaded can be replaced. Official originals stay unchanged." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "That file is over 4 MB. Try a smaller scan, or a photo of each page." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes, file.name);
  if (!check.ok) return check;
  const created = await createMyDocument({
    title: doc.title,
    origin: "upload",
    role: doc.role,
    versionOf: doc.id,
    mimeType: check.type,
    data: bytes,
    sha256: check.sha256,
    taskId: doc.taskId,
    content: EMPTY_CONTENT,
    requestKey,
  });
  if (!created.ok) return { ok: false, message: failure(created) };
  if (created.existed) return { ok: true, value: created.id };
  // Forms being worked on are read again; records like receipts aren't sent to the AI service
  if (doc.content.fields.length) await readAndSave({ id: created.id, type: check.type, data: bytes });
  refresh();
  return { ok: true, value: created.id };
}
