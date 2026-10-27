import { type AutofillContext, autofillAnswers, type OutdatedFact, sourcesOf, withoutOutdated } from "./autofill";
import type { Fact } from "./companion";
import type { OfficialForm } from "./form-catalog";
import type { DocumentRole } from "./library";
import { type DownloadOutcome, type FormVerification, guideFields, labelFields } from "./official-forms";
import type { DocumentContent, DraftAnswers } from "./types";

// Plain code that turns a downloaded form or an online application into a library document with drafted answers

export interface PreparedDocument {
  title: string;
  origin: "official_form";
  role: DocumentRole;
  mimeType: string;
  data: Uint8Array | null;
  sha256: string | null;
  sourceUrl: string;
  taskId: string;
  content: DocumentContent;
  answers: DraftAnswers;
  formKey: string;
  verification: FormVerification | null;
  factsUsed: Record<string, string>;
  obtainedAt: Date | null;
  requestKey: string;
}

export function officialOriginal(
  form: OfficialForm,
  download: Extract<DownloadOutcome, { ok: true }>,
  ctx: AutofillContext,
  input: { stepId: string; requestKey: string; now: Date },
): PreparedDocument {
  // A form that didn't pass every check keeps its own blanks and labels: the catalog's may not match it
  const fields = download.verification.ok ? labelFields(download.fields, form.fields) : download.fields;
  const filled = download.verification.ok ? autofillAnswers(fields, form.fields, ctx) : { answers: {}, used: {} };
  return {
    title: form.title,
    origin: "official_form",
    role: "original",
    mimeType: "application/pdf",
    data: download.bytes,
    sha256: download.sha256,
    sourceUrl: download.finalUrl,
    taskId: input.stepId,
    content: { readMethod: "pdf_form", pages: download.pages, fields, unclear: [], readAt: input.now.toISOString(), simulated: false },
    answers: filled.answers,
    formKey: form.key,
    verification: download.verification,
    factsUsed: filled.used,
    obtainedAt: input.now,
    requestKey: input.requestKey,
  };
}

// The questions an online application asks, as a document the owner reviews like a form
export function answerGuide(form: OfficialForm, ctx: AutofillContext, input: { stepId: string; requestKey: string; now: Date }): PreparedDocument {
  const rules = form.guide ?? form.fields;
  const fields = guideFields(rules);
  const filled = autofillAnswers(fields, rules, ctx);
  return {
    title: `Answers for: ${form.title}`.slice(0, 120),
    origin: "official_form",
    role: "answer_guide",
    mimeType: "text/plain",
    data: null,
    sha256: null,
    sourceUrl: form.onlineUrl ?? form.pageUrl,
    taskId: input.stepId,
    content: { readMethod: "catalog", pages: [{ number: 1, text: guideText(form) }], fields, unclear: [], readAt: input.now.toISOString(), simulated: false },
    answers: filled.answers,
    formKey: form.key,
    verification: null,
    factsUsed: filled.used,
    obtainedAt: null,
    requestKey: input.requestKey,
  };
}

export function guideText(form: OfficialForm): string {
  return [
    form.title,
    `${form.agency}. Questions below come from ${form.pageTitle}, checked ${form.checkedOn}.`,
    ...form.notes,
    ...(form.guide ?? form.fields).map((rule) => `${rule.line}: ${rule.label}`),
  ].join("\n");
}

// After facts change: catalog forms are drafted again by their rules; other forms swap in the new value where the old one was used whole
export function refreshedAnswers(
  doc: { answers: DraftAnswers; content: DocumentContent; formKey: string | null; factsUsed: Record<string, string> | null },
  form: OfficialForm | null,
  outdated: readonly OutdatedFact[],
  ctx: AutofillContext,
  facts: readonly Fact[],
): { answers: DraftAnswers; used: Record<string, string>; changed: string[] } {
  const { answers: kept, changed } = withoutOutdated(doc.answers, outdated);
  const note = (fieldId: string) => {
    const was = outdated.find((each) => doc.answers[fieldId] && sourcesOf(doc.answers[fieldId]).includes(each.id));
    return was ? `Your ${was.label.toLowerCase()} changed since this was drafted. Check it again.` : "";
  };
  const current = new Map(facts.map((each) => [each.id, each.value]));
  let answers: DraftAnswers;
  if (form) {
    answers = autofillAnswers(doc.content.fields, form.fields, ctx, kept).answers;
  } else {
    answers = { ...kept };
    for (const fieldId of changed) {
      const before = doc.answers[fieldId];
      const fresh = current.get(before.source);
      answers[fieldId] = fresh === undefined ? { value: "", source: "", state: "unanswered", note: "" } : { ...before, value: fresh, state: "suggested", note: "" };
    }
  }
  // Only what the answers now rest on, at today's values, so the outdated notice clears
  const used = Object.fromEntries(
    Object.values(answers)
      .filter((answer) => answer.state !== "fill_yourself")
      .flatMap(sourcesOf)
      .filter((id) => current.has(id))
      .map((id) => [id, current.get(id)!]),
  );
  for (const fieldId of changed) {
    if (answers[fieldId] && answers[fieldId].state !== "fill_yourself") answers[fieldId] = { ...answers[fieldId], state: answers[fieldId].value ? "suggested" : "unanswered", note: note(fieldId) };
  }
  return { answers, used, changed };
}
