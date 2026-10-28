"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getModel } from "@/lib/ai";
import {
  createMyDocument,
  deleteMyDocument,
  getMyBusiness,
  getMyDetails,
  getMyDocument,
  getMyDocumentFile,
  getMyPlan,
  listMyDocuments,
  myAiKey,
  saveMyDetails,
  updateMyDocument,
} from "@/lib/data/my-business";
import type { CreateOutcome, StoredDocument } from "@/lib/data/documents";
import { DETAILS, detailProblem, displayDetail, isDecisionKey, isDetailKey, looksLikeIdNumber } from "@/lib/details";
import { draftBusinessPlan, knownNumbers, MAX_PLAN_INPUT, numberFlags, PLAN_QUESTIONS, type PlanQuestionKey } from "@/lib/documents/business-plan";
import { askAboutForm, draftAnswers, explainForm, factsFor, MAX_QUESTION, mustFillYourself } from "@/lib/documents/companion";
import { answerSheet, fillPdfCopy } from "@/lib/documents/fill";
import { stepGuidance } from "@/lib/documents/guidance";
import { writePdf } from "@/lib/documents/pdf-writer";
import { EMPTY_CONTENT, type DraftAnswers, type PlanSection } from "@/lib/documents/types";
import { checkUpload, cleanTitle, MAX_PASTE_CHARS, MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { OwnerFacingError } from "@/lib/errors";
import { displayName } from "@/lib/intake/answers";
import { governmentFor } from "@/lib/research/official-sites";
import { fetchOfficialPage } from "@/lib/research/retrieve";
import { readAndSave } from "@/lib/documents/read-and-save";
import { isKept } from "@/lib/documents/library";
import { readDocument } from "@/lib/documents/read";
import { explainReceived } from "@/lib/documents/received";
import { runWorkflow } from "@/lib/workflow-runner";

const NOT_FOUND = "That document wasn’t found. It may have been deleted.";
const id = z.string().min(1).max(60);

function createFailure(outcome: Exclude<CreateOutcome, { ok: true }>): ActionResult<string> {
  switch (outcome.reason) {
    case "too_many":
    case "too_large":
      return { ok: false, message: "Your document library is full. Delete documents you don’t need, then try again." };
    case "bad_task":
      return { ok: false, message: "That plan step wasn’t found. Reload the page and try again." };
    default:
      return { ok: false, message: "Tell us about your business first." };
  }
}

// --- Adding documents

const stepField = z.string().max(60).optional().transform((value) => value || null);

export async function uploadDocumentAction(form: FormData): Promise<ActionResult<string>> {
  const file = form.get("file");
  const stepId = stepField.safeParse(form.get("stepId") ?? undefined);
  if (!(file instanceof File) || !stepId.success) return { ok: false, message: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "That file is over 4 MB. Try a smaller scan, or take a photo of each page." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes, file.name);
  if (!check.ok) return check;

  const created = await createMyDocument({
    title: check.title,
    origin: "upload",
    role: "form",
    mimeType: check.type,
    data: bytes,
    sha256: check.sha256,
    taskId: stepId.data,
    content: EMPTY_CONTENT,
  });
  if (!created.ok) return createFailure(created);
  // Saved even if reading fails: the page offers to try again
  await readAndSave({ id: created.id, type: check.type, data: bytes });
  refresh();
  return { ok: true, value: created.id };
}

const pasteSchema = z.object({ title: z.string().max(120), text: z.string().max(MAX_PASTE_CHARS), stepId: stepField });

export async function pasteDocumentAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = pasteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: `Paste up to ${MAX_PASTE_CHARS.toLocaleString("en-US")} characters.` };
  const text = parsed.data.text.trim();
  if (text.length < 20) return { ok: false, message: "Paste the form’s text, including its questions." };
  const created = await createMyDocument({
    title: cleanTitle(parsed.data.title || text.split("\n")[0]),
    origin: "paste",
    role: "form",
    mimeType: "text/plain",
    data: null,
    sha256: null,
    taskId: parsed.data.stepId,
    content: { ...EMPTY_CONTENT, readMethod: "pasted", pages: [{ number: 1, text }] },
  });
  if (!created.ok) return createFailure(created);
  await readAndSave({ id: created.id, type: "text/plain", text });
  refresh();
  return { ok: true, value: created.id };
}

const officialSchema = z.object({ url: z.string().max(2000), stepId: stepField });

// Only PDFs on sites in the official .gov registry; the app fetches the form itself
export async function officialFormAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = officialSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Paste the link to the form." };
  const government = governmentFor(parsed.data.url.trim());
  if (!government) {
    return { ok: false, message: "First Sale only fetches forms from official .gov websites. Download it yourself and upload it instead." };
  }
  const fetched = await fetchOfficialPage(parsed.data.url.trim(), [government.domain], fetch, { pdf: true, html: false, maxBytes: MAX_UPLOAD_BYTES });
  if (!fetched.ok || !fetched.pdf) {
    const reason = fetched.ok ? "The link isn’t a PDF form" : fetched.reason;
    return { ok: false, message: `${reason}. If the form is filled in online, paste its questions instead.` };
  }
  const check = checkUpload(fetched.pdf, fileNameOf(fetched.finalUrl));
  if (!check.ok) return check;
  const created = await createMyDocument({
    title: check.title,
    origin: "official_form",
    role: "original",
    obtainedAt: new Date(),
    mimeType: check.type,
    data: fetched.pdf,
    sha256: check.sha256,
    sourceUrl: fetched.finalUrl,
    taskId: parsed.data.stepId,
    content: EMPTY_CONTENT,
  });
  if (!created.ok) return createFailure(created);
  await readAndSave({ id: created.id, type: check.type, data: fetched.pdf });
  refresh();
  return { ok: true, value: created.id };
}

function fileNameOf(url: string): string {
  const path = new URL(url).pathname;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

export async function readAgainAction(documentId: unknown): Promise<ActionResult> {
  const doc = await load(documentId);
  if (!doc || doc.origin === "generated") return { ok: false, message: NOT_FOUND };
  if (doc.origin === "paste") {
    const text = doc.content.pages.map((page) => page.text).join("\n");
    const result = await readAndSave({ id: doc.id, type: "text/plain", text });
    refresh();
    return result.ok ? { ok: true, value: null } : result;
  }
  const file = await getMyDocumentFile(doc.id);
  const check = file ? checkUpload(file.data, file.title) : null;
  if (!file || !check?.ok) return { ok: false, message: NOT_FOUND };
  const result = await readAndSave({ id: doc.id, type: check.type, data: file.data });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}

// --- Understanding a form

async function load(documentId: unknown): Promise<StoredDocument | null> {
  const parsed = id.safeParse(documentId);
  return parsed.success ? getMyDocument(parsed.data) : null;
}

function readable(doc: StoredDocument): boolean {
  return doc.content.pages.some((page) => page.text.trim());
}

export async function explainDocumentAction(documentId: unknown): Promise<ActionResult> {
  const doc = await load(documentId);
  if (!doc || doc.origin === "generated") return { ok: false, message: NOT_FOUND };
  if (!readable(doc)) return { ok: false, message: "We don’t have this form’s text yet. Read it again, or paste its text instead." };
  const plan = doc.taskId ? await getMyPlan() : null;
  const step = plan?.steps.find((candidate) => candidate.id === doc.taskId);

  const result = await runWorkflow("explain_document", doc.id, async () => {
    const guide = await explainForm(getModel(), {
      pages: doc.content.pages,
      fields: doc.content.fields,
      guidance: stepGuidance(step),
      userKey: await myAiKey(),
    });
    await updateMyDocument(doc.id, { guide });
  });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}

// A letter or record the owner already has: read only now that they asked, then explained
export async function explainReceivedAction(documentId: unknown): Promise<ActionResult> {
  const doc = await load(documentId);
  if (!doc || !isKept(doc)) return { ok: false, message: NOT_FOUND };
  const [file, plan] = await Promise.all([readable(doc) ? null : getMyDocumentFile(doc.id), getMyPlan()]);
  const check = file ? checkUpload(file.data, file.title) : null;
  if (!readable(doc) && !check?.ok) return { ok: false, message: NOT_FOUND };

  const result = await runWorkflow("explain_received", doc.id, async () => {
    const model = getModel();
    const userKey = await myAiKey();
    let pages = doc.content.pages;
    if (check?.ok && file) {
      const content = await readDocument(model, { type: check.type, data: file.data, findBlanks: false }, new Date(), userKey);
      await updateMyDocument(doc.id, { content });
      if (!content.pages.some((page) => page.text.trim())) {
        throw new OwnerFacingError(content.unclear[0]?.why ?? "We couldn’t read any words on it. Try a clearer photo or scan.");
      }
      pages = content.pages;
    }
    const steps = (plan?.steps ?? []).map((step) => ({ key: step.key, title: step.title }));
    const guide = await explainReceived(model, { pages, steps, userKey });
    await updateMyDocument(doc.id, { guide });
  });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}

const askSchema = z.object({ documentId: id, question: z.string().max(MAX_QUESTION), fieldId: z.string().max(200).nullable() });

export async function askDocumentAction(input: unknown): Promise<ActionResult> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: `Keep your question under ${MAX_QUESTION} characters.` };
  const question = parsed.data.question.trim();
  if (question.length < 3) return { ok: false, message: "Type your question." };
  if (looksLikeIdNumber(question)) {
    return { ok: false, message: "Leave Social Security and tax id numbers out of your question. You don’t need them to ask about a form." };
  }
  const doc = await load(parsed.data.documentId);
  if (!doc || doc.origin === "generated") return { ok: false, message: NOT_FOUND };
  if (!readable(doc)) return { ok: false, message: "We don’t have this form’s text yet. Read it again, or paste its text instead." };

  const result = await runWorkflow("ask_document", doc.id, async () => {
    const answer = await askAboutForm(getModel(), {
      pages: doc.content.pages,
      fields: doc.content.fields,
      question,
      fieldId: parsed.data.fieldId,
      userKey: await myAiKey(),
    });
    // Newest first; the last 20 are kept
    const latest = await getMyDocument(doc.id);
    await updateMyDocument(doc.id, { questions: [answer, ...(latest?.questions ?? [])].slice(0, 20) });
  });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}

// --- Draft answers

export async function draftAnswersAction(documentId: unknown): Promise<ActionResult> {
  const doc = await load(documentId);
  if (!doc || doc.origin === "generated") return { ok: false, message: NOT_FOUND };
  if (!doc.content.fields.length) return { ok: false, message: "We didn’t find any blanks to fill in on this form." };
  const business = await getMyBusiness();
  if (!business?.profile) return { ok: false, message: "Update your business answers first." };
  const profile = business.profile;

  const result = await runWorkflow("draft_answers", doc.id, async () => {
    const facts = factsFor(profile, await getMyDetails());
    const drafted = await draftAnswers(getModel(), { fields: doc.content.fields, facts, previous: doc.answers, userKey: await myAiKey() });
    // Answers the owner confirmed or typed while this ran win over the draft
    const latest = (await getMyDocument(doc.id))?.answers ?? {};
    const answers = Object.fromEntries(
      Object.entries(drafted).map(([fieldId, answer]) => {
        const now = latest[fieldId];
        return [fieldId, now && (now.state === "confirmed" || now.source === "owner") && answer.state !== "fill_yourself" ? now : answer];
      }),
    );
    // Which facts the draft rests on, so a later change flags it as outdated
    const values = new Map(facts.map((fact) => [fact.id, fact.value]));
    const factsUsed = Object.fromEntries(Object.values(answers).flatMap((answer) => (values.has(answer.source) ? [[answer.source, values.get(answer.source)!]] : [])));
    await updateMyDocument(doc.id, { answers, factsUsed });
  });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}

const saveAnswersSchema = z.object({
  documentId: id,
  answers: z.record(z.string().max(200), z.object({ value: z.string().max(1000), confirmed: z.boolean() })),
  // Answers the owner chose to also keep as business details
  saveDetails: z.array(z.object({ fieldId: z.string().max(200), key: z.string().max(60) })).max(20),
});

// The owner's review: typed values become theirs, ticked ones are confirmed
export async function saveAnswersAction(input: unknown): Promise<ActionResult> {
  const parsed = saveAnswersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Keep each answer under 1,000 characters." };
  const doc = await load(parsed.data.documentId);
  if (!doc || doc.origin === "generated") return { ok: false, message: NOT_FOUND };

  const next: DraftAnswers = { ...doc.answers };
  for (const field of doc.content.fields) {
    const edit = parsed.data.answers[field.id];
    if (!edit || mustFillYourself(field)) continue;
    const value = edit.value.trim();
    if (looksLikeIdNumber(value)) {
      return { ok: false, message: `“${field.label}”: First Sale doesn’t store Social Security or tax id numbers. Fill those in on the form yourself.` };
    }
    if (value && field.kind === "choice" && field.options.length && !field.options.includes(value)) {
      return { ok: false, message: `“${field.label}”: pick one of the form’s own options.` };
    }
    if (value && field.kind === "checkbox" && value !== "Yes" && value !== "No") {
      return { ok: false, message: `“${field.label}”: a checkbox can only be ticked or left unticked.` };
    }
    const before = doc.answers[field.id];
    const source = before && before.value === value && before.source ? before.source : value ? "owner" : "";
    next[field.id] = {
      value,
      source,
      state: !value ? "unanswered" : edit.confirmed ? "confirmed" : "suggested",
      note: "",
    };
  }

  const details = parsed.data.saveDetails.flatMap(({ fieldId, key }) => {
    const value = next[fieldId]?.value ?? "";
    return isDetailKey(key) && !isDecisionKey(key) && value ? [{ key, value }] : [];
  });
  for (const detail of details) {
    const problem = detailProblem(detail.key, detail.value);
    if (problem) return { ok: false, message: `${DETAILS[detail.key].label}: ${problem}` };
  }

  if (!(await updateMyDocument(doc.id, { answers: next }))) return { ok: false, message: NOT_FOUND };
  if (details.length) await saveMyDetails(details, { source: "document", documentId: doc.id });
  refresh();
  return { ok: true, value: null };
}

// --- Prepared copies

function sourceLabel(source: string, labels: Map<string, string>): string {
  if (source === "owner") return "You typed this";
  return labels.get(source) ?? "Your business details";
}

async function factLabels(): Promise<Map<string, string>> {
  const business = await getMyBusiness();
  if (!business?.profile) return new Map();
  return new Map(factsFor(business.profile, await getMyDetails()).map((fact) => [fact.id, fact.label]));
}

function preparedTitle(title: string, what: string): string {
  return `${title.slice(0, 80)} (${what}, not filed)`;
}

// Facts the copy was made from, only those its confirmed answers use
function usedBy(doc: StoredDocument): Record<string, string> | null {
  if (!doc.factsUsed) return null;
  const sources = new Set(Object.values(doc.answers).filter((answer) => answer.state === "confirmed").map((answer) => answer.source));
  return Object.fromEntries(Object.entries(doc.factsUsed).filter(([id]) => sources.has(id)));
}

export async function fillCopyAction(documentId: unknown): Promise<ActionResult<string>> {
  const doc = await load(documentId);
  if (!doc || doc.origin === "generated") return { ok: false, message: NOT_FOUND };
  const file = doc.mimeType === "application/pdf" ? await getMyDocumentFile(doc.id) : null;
  if (!file || !doc.content.fields.some((field) => field.fillable)) {
    return { ok: false, message: "This form can’t be filled in directly. Make an answer sheet instead." };
  }
  const filled = await fillPdfCopy(file.data, doc.content.fields, doc.answers);
  if (!filled.ok) {
    const messages = {
      nothing_confirmed: "Confirm at least one answer first. Only answers you’ve confirmed go into the copy.",
      locked: "This form is locked against changes, so it can’t be filled in. Make an answer sheet instead.",
      unreadable: "This PDF couldn’t be opened to fill in. Make an answer sheet instead.",
    };
    return { ok: false, message: messages[filled.reason] };
  }
  const created = await createMyDocument({
    title: preparedTitle(doc.title, "reviewed copy"),
    origin: "generated",
    generatedKind: "filled_form",
    role: "reviewed",
    versionOf: doc.id,
    factsUsed: usedBy(doc),
    mimeType: "application/pdf",
    data: filled.bytes,
    sha256: null,
    taskId: doc.taskId,
    fromDocumentId: doc.id,
    content: EMPTY_CONTENT,
  });
  if (!created.ok) return createFailure(created);
  refresh();
  return { ok: true, value: created.id };
}

export async function answerSheetAction(documentId: unknown): Promise<ActionResult<string>> {
  const doc = await load(documentId);
  if (!doc || doc.origin === "generated") return { ok: false, message: NOT_FOUND };
  if (!doc.content.fields.length) return { ok: false, message: "We didn’t find any blanks on this form to list." };
  const labels = await factLabels();
  const bytes = await answerSheet({
    formTitle: doc.title,
    fields: doc.content.fields,
    answers: doc.answers,
    sourceLabel: (source) => sourceLabel(source, labels),
    preparedOn: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
  });
  const created = await createMyDocument({
    title: preparedTitle(doc.title, doc.role === "answer_guide" ? "answer guide" : "answer sheet"),
    origin: "generated",
    generatedKind: doc.role === "answer_guide" ? "answer_guide" : "answer_sheet",
    role: "reviewed",
    versionOf: doc.id,
    factsUsed: usedBy(doc),
    mimeType: "application/pdf",
    data: bytes,
    sha256: null,
    taskId: doc.taskId,
    fromDocumentId: doc.id,
    content: EMPTY_CONTENT,
  });
  if (!created.ok) return createFailure(created);
  refresh();
  return { ok: true, value: created.id };
}

// --- Library housekeeping

const linkSchema = z.object({ documentId: id, stepId: z.string().max(60).nullable() });

export async function linkStepAction(input: unknown): Promise<ActionResult> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: NOT_FOUND };
  if (!(await updateMyDocument(parsed.data.documentId, { taskId: parsed.data.stepId }))) {
    return { ok: false, message: "That document or plan step wasn’t found. Reload the page and try again." };
  }
  refresh();
  return { ok: true, value: null };
}

const renameSchema = z.object({ documentId: id, title: z.string().max(120) });

export async function renameDocumentAction(input: unknown): Promise<ActionResult> {
  const parsed = renameSchema.safeParse(input);
  const title = parsed.success ? cleanTitle(parsed.data.title) : "";
  if (!parsed.success || !parsed.data.title.trim()) return { ok: false, message: "Enter a name for the document." };
  if (!(await updateMyDocument(parsed.data.documentId, { title }))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

export async function deleteDocumentAction(documentId: unknown): Promise<ActionResult> {
  const parsed = id.safeParse(documentId);
  if (!parsed.success || !(await deleteMyDocument(parsed.data))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}

// --- Business plan

const inputsSchema = z.record(z.string(), z.string().max(MAX_PLAN_INPUT));

async function currentBusinessPlan(): Promise<StoredDocument | null> {
  const docs = await listMyDocuments();
  return docs.find((doc) => doc.generatedKind === "business_plan") ?? null;
}

export async function draftBusinessPlanAction(input: unknown): Promise<ActionResult<string>> {
  const parsed = inputsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: `Keep each answer under ${MAX_PLAN_INPUT.toLocaleString("en-US")} characters.` };
  const answers: Partial<Record<PlanQuestionKey, string>> = {};
  for (const question of PLAN_QUESTIONS) {
    const value = parsed.data[question.key]?.trim();
    if (value && looksLikeIdNumber(value)) return { ok: false, message: "Leave Social Security and tax id numbers out of your business plan." };
    if (value) answers[question.key] = value;
  }
  const business = await getMyBusiness();
  if (!business?.profile) return { ok: false, message: "Tell us about your business first." };
  const profile = business.profile;
  const existing = await currentBusinessPlan();

  const result = await runWorkflow("business_plan", null, async () => {
    const [plan, details] = await Promise.all([getMyPlan(), getMyDetails()]);
    const structure = details.find((detail) => detail.key === "structure_choice");
    const sections = await draftBusinessPlan(getModel(), {
      profile,
      answers,
      steps: (plan?.steps ?? []).map((step) => ({ title: step.title, done: step.status === "done" })),
      structure: structure ? displayDetail("structure_choice", structure.value) : null,
      userKey: await myAiKey(),
    });
    const draft = { sections, inputs: answers, approvedAt: null, simulated: getModel().simulated };
    if (existing) {
      await updateMyDocument(existing.id, { draft });
      return existing.id;
    }
    const created = await createMyDocument({
      title: `Business plan for ${displayName(profile)}`.slice(0, 120),
      origin: "generated",
      generatedKind: "business_plan",
      mimeType: "application/pdf",
      data: null,
      sha256: null,
      content: EMPTY_CONTENT,
      draft,
    });
    if (!created.ok) throw new OwnerFacingError("Your document library is full. Delete documents you don’t need, then try again.");
    return created.id;
  });
  refresh();
  return result;
}

const sectionsSchema = z.object({
  documentId: id,
  sections: z.array(z.object({ key: z.string().max(40), heading: z.string().max(120), body: z.string().max(6000) })).max(12),
  approve: z.boolean(),
});

// Saves the owner's edits; approving also makes the PDF that goes in the library
export async function saveBusinessPlanAction(input: unknown): Promise<ActionResult> {
  const parsed = sectionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Keep each section under 6,000 characters." };
  if (parsed.data.sections.some((section) => looksLikeIdNumber(`${section.heading} ${section.body}`))) {
    return { ok: false, message: "Leave Social Security and tax id numbers out of your business plan." };
  }
  const doc = await load(parsed.data.documentId);
  if (!doc || doc.generatedKind !== "business_plan" || !doc.draft) return { ok: false, message: NOT_FOUND };

  const business = await getMyBusiness();
  const flaggedBefore = new Map(doc.draft.sections.map((section) => [section.key, section.flags]));
  const known = knownNumbers(JSON.stringify(doc.draft.inputs) + JSON.stringify(business?.profile ?? {}));
  const sections: PlanSection[] = parsed.data.sections.map((section) => ({
    key: section.key,
    heading: section.heading.trim() || "Section",
    body: section.body.trim(),
    // A flagged number stays flagged until it's changed or removed
    flags: numberFlags(section.body, known).filter((flag) => (flaggedBefore.get(section.key) ?? []).includes(flag)),
  }));

  const now = new Date();
  const approvedAt = parsed.data.approve ? now.toISOString() : null;
  const patch: Parameters<typeof updateMyDocument>[1] = { draft: { ...doc.draft, sections, approvedAt } };
  if (parsed.data.approve) {
    patch.data = await writePdf({
      title: doc.title,
      subtitle: `Approved ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`,
      notice: doc.draft.simulated ? "Practice draft: written by built-in rules, not by the AI service." : undefined,
      blocks: sections.map((section) => ({ heading: section.heading, paragraphs: [section.body] })),
      footer: "Business plan made with First Sale",
    });
    patch.mimeType = "application/pdf";
  }
  if (!(await updateMyDocument(doc.id, patch))) return { ok: false, message: NOT_FOUND };
  refresh();
  return { ok: true, value: null };
}
