import { createHash } from "node:crypto";
import { governmentFor } from "@/lib/research/official-sites";
import { fetchOfficialPage } from "@/lib/research/retrieve";
import type { FieldRule } from "./autofill";
import type { OfficialForm } from "./form-catalog";
import { readPdf } from "./pdf";
import type { DocumentField, DocumentPage } from "./types";
import { MAX_UPLOAD_BYTES } from "./upload";

// Downloads a catalog form from its official site and checks it's the exact form SnapStart knows, unchanged.

export interface FormVerification {
  formKey: string;
  title: string;
  formNumber: string | null;
  revision: string | null;
  // Owner of the site in the .gov registry
  government: string;
  sourceUrl: string;
  checkedAt: string;
  checks: { label: string; ok: boolean }[];
  // Every check passed, so the catalog's field rules can be used
  ok: boolean;
}

export type DownloadOutcome =
  | {
      ok: true;
      bytes: Uint8Array;
      sha256: string;
      finalUrl: string;
      pages: DocumentPage[];
      fields: DocumentField[];
      verification: FormVerification;
    }
  | { ok: false; reason: string };

export async function downloadOfficialForm(form: OfficialForm, fetchImpl: typeof fetch = fetch, now = new Date()): Promise<DownloadOutcome> {
  if (!form.pdfUrl) return { ok: false, reason: "This application is online only, so there’s no form to download." };
  const government = governmentFor(form.pdfUrl);
  if (!government || government.domain !== form.domain) return { ok: false, reason: "That link isn’t on the agency’s official site." };

  const fetched = await fetchOfficialPage(form.pdfUrl, [government.domain], fetchImpl, { pdf: true, html: false, maxBytes: MAX_UPLOAD_BYTES });
  if (!fetched.ok || !fetched.pdf) return { ok: false, reason: fetched.ok ? "The official link didn’t return a PDF." : fetched.reason };
  const bytes = fetched.pdf;

  let reading;
  try {
    reading = await readPdf(bytes);
  } catch {
    return { ok: false, reason: "The downloaded file couldn’t be opened as a PDF." };
  }
  const text = squash(reading.pages.map((page) => page.text).join(" "));
  const has = (words: string) => text.includes(squash(words));
  const finalOwner = governmentFor(fetched.finalUrl);
  const checks = [
    { label: `Downloaded from ${government.domain}, which the official .gov registry lists as ${government.name}`, ok: finalOwner?.domain === form.domain },
    ...form.mustContain.map((words) => ({ label: `The form says “${words}”`, ok: has(words) })),
    { label: "It has fill-in boxes SnapStart can fill", ok: reading.fields.length > 0 },
  ];
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    ok: true,
    bytes,
    sha256,
    finalUrl: fetched.finalUrl,
    pages: reading.pages,
    fields: reading.fields,
    verification: {
      formKey: form.key,
      title: form.title,
      formNumber: form.formNumber,
      revision: form.revision,
      government: government.name,
      sourceUrl: fetched.finalUrl,
      checkedAt: now.toISOString(),
      checks,
      ok: checks.every((check) => check.ok),
    },
  };
}

// Checked labels from the catalog replace the reader's guess at nearby text, so "f1_2" reads "Line 1: Legal name…"
// and the sensitive-blank check judges the right words (line 1's printed text mentions "the EIN")
export function labelFields(fields: readonly DocumentField[], rules: readonly FieldRule[]): DocumentField[] {
  const byId = new Map(rules.map((rule) => [rule.fieldId, rule]));
  return fields.map((field) => {
    const rule = byId.get(field.id);
    return rule ? { ...field, label: `${rule.line}: ${rule.label}`, printedText: rule.label } : field;
  });
}

// An online application's questions as blanks, so the same review and answer sheet work for it
export function guideFields(rules: readonly FieldRule[]): DocumentField[] {
  return rules.map((rule) => ({
    id: rule.fieldId,
    label: `${rule.line}: ${rule.label}`,
    page: 1,
    kind: rule.kind ?? "text",
    options: [],
    printedText: rule.label,
    confidence: "high",
    fillable: false,
  }));
}

function squash(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, "")
    .toLowerCase();
}
