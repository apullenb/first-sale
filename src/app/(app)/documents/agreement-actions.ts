"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { createMyDocument, getMyBusiness, getMyDetails, listMyDocuments, updateMyDocument } from "@/lib/data/my-business";
import { autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import {
  agreementName,
  agreementPdf,
  agreementReadiness,
  buildAgreement,
  checkChoices,
  choicesInputSchema,
  choicesToInputs,
  draftStamp,
  inputsToChoices,
} from "@/lib/documents/owners-agreement";
import { writePdf } from "@/lib/documents/pdf-writer";
import { EMPTY_CONTENT, type GeneratedContent, type PlanSection } from "@/lib/documents/types";
import { structureOf } from "@/lib/research/applicability";

const NOT_FOUND = "Your agreement wasn’t found. Reload the page and try again.";
const STALE = "Your agreement changed in another tab. Reload the page to see the latest one.";

async function current() {
  const [business, details, documents] = await Promise.all([getMyBusiness(), getMyDetails(), listMyDocuments()]);
  if (!business?.profile) return null;
  const facts = autofillFacts(business.profile, details);
  return {
    facts,
    readiness: agreementReadiness(business.profile, new Map(facts.map((fact) => [fact.id, fact])), structureOf(business.profile, details).structure),
    doc: documents.find((doc) => doc.generatedKind === "owners_agreement") ?? null,
  };
}

// Fills the agreement's fixed wording from saved details and the owner's choices; preparing again replaces it
export async function prepareAgreementAction(input: unknown): Promise<ActionResult> {
  const parsed = choicesInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check your answers: one of them is too long." };
  const now = await current();
  if (!now) return { ok: false, message: "Tell us about your business first." };
  const { readiness, doc } = now;
  if (readiness.kind === "none") return { ok: false, message: readiness.why };
  if (readiness.kind === "missing") return { ok: false, message: `Add these first: ${readiness.missing.join(" ")}` };

  const checked = checkChoices(readiness.basis, parsed.data);
  if (!checked.ok) return checked;
  const built = buildAgreement(readiness.basis, checked.choices);
  const draft: GeneratedContent = { sections: built.sections, inputs: choicesToInputs(checked.choices, new Date().toISOString()), approvedAt: null, simulated: false };
  const title = `${agreementName(readiness.basis.structure, readiness.basis.texas)} for ${readiness.basis.name}`.slice(0, 120);
  // An approved PDF no longer matches, so it goes until this one is approved
  const patch = { title, draft, factsUsed: readiness.used, data: null };
  // Only replaces the draft the page showed, so a newer one or an approval isn't lost unseen
  const unchanged = (row: { draft: GeneratedContent | null }) => draftStamp(row.draft) === parsed.data.basedOn;

  if (doc) {
    if (!(await updateMyDocument(doc.id, patch, unchanged))) return { ok: false, message: STALE };
  } else {
    const created = await createMyDocument({
      ...patch,
      origin: "generated",
      generatedKind: "owners_agreement",
      mimeType: "application/pdf",
      sha256: null,
      content: EMPTY_CONTENT,
      requestKey: "owners_agreement",
    });
    if (!created.ok) {
      return { ok: false, message: created.reason === "no_business" ? "Tell us about your business first." : "Your document library is full. Delete documents you don’t need, then try again." };
    }
    // Prepared at the same time in another tab
    if (created.existed && !(await updateMyDocument(created.id, patch, unchanged))) return { ok: false, message: STALE };
  }
  refresh();
  return { ok: true, value: null };
}

const approveSchema = z.object({ documentId: z.string().min(1).max(60), preparedAt: z.string().min(1).max(40) });

// Approving makes the PDF the owners print and sign; only a draft that still matches their details can be approved
export async function approveAgreementAction(documentId: unknown, preparedAt: unknown): Promise<ActionResult> {
  const parsed = approveSchema.safeParse({ documentId, preparedAt });
  if (!parsed.success) return { ok: false, message: NOT_FOUND };
  const now = await current();
  if (!now) return { ok: false, message: "Tell us about your business first." };
  const { readiness, doc, facts } = now;
  if (!doc || doc.id !== parsed.data.documentId || !doc.draft) return { ok: false, message: NOT_FOUND };
  if (doc.draft.inputs.prepared_at !== parsed.data.preparedAt) return { ok: false, message: STALE };
  if (doc.draft.approvedAt) {
    refresh();
    return { ok: true, value: null };
  }
  if (readiness.kind !== "ready" || outdatedFacts(doc.factsUsed, facts).length) {
    return { ok: false, message: "Your details changed since this agreement was prepared. Prepare it again, then approve it." };
  }

  const checked = checkChoices(readiness.basis, inputsToChoices(doc.draft.inputs, readiness.basis.owners));
  if (!checked.ok) return { ok: false, message: "Prepare your agreement again, then approve it." };
  const built = buildAgreement(readiness.basis, checked.choices);
  // The PDF must say exactly what the owner read; stored JSON doesn't keep key order, so compare the words
  const words = (sections: PlanSection[]) => JSON.stringify(sections.map((section) => [section.key, section.heading, section.body]));
  if (words(built.sections) !== words(doc.draft.sections)) return { ok: false, message: "Prepare your agreement again, then approve it." };

  const approvedAt = new Date();
  const day = (date: Date) => date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const data = await writePdf(agreementPdf(built, day(new Date(parsed.data.preparedAt)), day(approvedAt)));
  const saved = await updateMyDocument(
    doc.id,
    { draft: { ...doc.draft, approvedAt: approvedAt.toISOString() }, data, mimeType: "application/pdf" },
    (row) => row.draft?.inputs.prepared_at === parsed.data.preparedAt && !row.draft.approvedAt,
  );
  if (!saved) return { ok: false, message: STALE };
  refresh();
  return { ok: true, value: null };
}
