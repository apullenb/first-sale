import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from "pdf-lib";
import { mustFillYourself } from "./companion";
import { toWinAnsi, writePdf } from "./pdf-writer";
import type { DocumentField, DraftAnswers } from "./types";

// Prepared copies of a form. Only answers the owner confirmed go in; signatures and ID numbers stay blank.
// Nothing here files anything: the owner checks, signs and files the copy themselves.

export const NOT_FILED = "Prepared with SnapStart. Not filed. Check every answer, sign it yourself, and file it with the office named on the form.";

export type FillOutcome =
  | { ok: true; bytes: Uint8Array; filled: number; skipped: string[] }
  | { ok: false; reason: "locked" | "unreadable" | "nothing_confirmed" };

export async function fillPdfCopy(original: Uint8Array, fields: readonly DocumentField[], answers: DraftAnswers): Promise<FillOutcome> {
  const confirmed = fields.filter(
    (field) => field.fillable && !mustFillYourself(field) && answers[field.id]?.state === "confirmed" && answers[field.id].value,
  );
  if (!confirmed.length) return { ok: false, reason: "nothing_confirmed" };

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(original, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  // A locked form can't be changed reliably; the owner gets an answer sheet instead
  if (doc.isEncrypted) return { ok: false, reason: "locked" };

  const form = doc.getForm();
  const skipped: string[] = [];
  let filled = 0;
  for (const field of confirmed) {
    const value = answers[field.id].value;
    try {
      const target = form.getField(field.id);
      if (target instanceof PDFTextField) {
        const max = target.getMaxLength();
        const text = toWinAnsi(value).replace(/\n+/g, target.isMultiline() ? "\n" : ", ");
        if (max !== undefined && text.length > max) throw new Error("too long");
        target.setText(text);
      } else if (target instanceof PDFCheckBox) {
        if (value === "Yes") target.check();
        else if (value === "No") target.uncheck();
        else throw new Error("not a checkbox answer");
      } else if (target instanceof PDFDropdown || target instanceof PDFOptionList || target instanceof PDFRadioGroup) {
        // Only the form's own options; pdf-lib would otherwise make the list editable
        if (!target.getOptions().includes(value)) throw new Error("not an option");
        target.select(value);
      } else {
        throw new Error("unsupported field");
      }
      filled++;
    } catch {
      skipped.push(field.label);
    }
  }
  // In the file's details rather than on the page, so a printed copy can still be filed
  doc.setSubject(toWinAnsi(NOT_FILED));
  doc.setProducer("SnapStart Business Assembly Kit");
  return { ok: true, bytes: await doc.save(), filled, skipped };
}

// For forms that can't be filled in place (scans, pasted text, online forms): every blank, its answer, and where the answer came from
export async function answerSheet(input: {
  formTitle: string;
  fields: readonly DocumentField[];
  answers: DraftAnswers;
  sourceLabel: (source: string) => string;
  preparedOn: string;
}): Promise<Uint8Array> {
  const entries = input.fields.map((field) => {
    const answer = input.answers[field.id];
    if (!answer || answer.state === "unanswered" || !answer.value) {
      return { label: field.label, value: "Not answered yet", note: answer?.state === "fill_yourself" ? answer.note : `Page ${field.page}` };
    }
    if (answer.state === "fill_yourself") return { label: field.label, value: "Fill in yourself", note: answer.note };
    // Only confirmed answers are printed
    if (answer.state !== "confirmed") return { label: field.label, value: "Not confirmed yet", note: `Check and confirm it in SnapStart · Page ${field.page}` };
    const value = field.kind === "checkbox" ? (answer.value === "Yes" ? "Tick this box" : "Leave this box unticked") : answer.value;
    return { label: field.label, value, note: `You confirmed this · From: ${input.sourceLabel(answer.source)} · Page ${field.page}` };
  });
  return writePdf({
    title: `Answers for: ${input.formTitle}`,
    subtitle: `Prepared ${input.preparedOn}`,
    notice: NOT_FILED,
    blocks: [{ entries }],
    footer: "SnapStart answer sheet · Not filed",
  });
}
