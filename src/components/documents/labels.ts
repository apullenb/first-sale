import type { DocumentOrigin, GeneratedKind } from "@/lib/domain";
import type { DocumentContent } from "@/lib/documents/types";

// Owner-facing names for document kinds, origins and how a form was read

export const GENERATED_LABELS: Record<GeneratedKind, string> = {
  business_plan: "Business plan",
  filled_form: "Filled copy of a form",
  answer_sheet: "Answer sheet",
  startup_plan: "Licenses and registrations",
  website_copy: "Website words",
  answer_guide: "Answer guide",
  owners_agreement: "Owners’ agreement",
  marketing_plan: "Marketing plan",
  logo_guide: "Logo guide",
};

export const READ_METHOD_LABELS: Record<DocumentContent["readMethod"], string> = {
  pdf_form: "Read from the PDF’s own text and fill-in boxes",
  pdf_text: "Read from the PDF’s own text",
  ai_reading: "Read by AI from the picture of each page",
  pasted: "From the text you pasted",
  catalog: "Questions from SnapStart’s checked list for this application",
  none: "Not read yet",
};

const FILE_KINDS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "photo",
  "image/jpeg": "photo",
  "image/webp": "photo",
};

export function formKindLabel(origin: DocumentOrigin, mimeType: string): string {
  if (origin === "paste") return "Pasted text";
  if (origin === "official_form") return "Official form (PDF)";
  return `Uploaded ${FILE_KINDS[mimeType] ?? "file"}`;
}

export function originSentence(origin: DocumentOrigin, role: string | null = null): string {
  if (role === "answer_guide") return "SnapStart listed these questions from the official rules for this application";
  if (origin === "paste") return "You pasted this form’s text";
  if (origin === "official_form") return "SnapStart fetched this form from an official government website";
  return "You uploaded this form";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} bytes`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${Number((bytes / 1_000_000).toFixed(1))} MB`;
}

export function fileHref(id: string, view = false): string {
  return `/documents/${encodeURIComponent(id)}/file${view ? "?view=1" : ""}`;
}

export function isReadable(content: DocumentContent): boolean {
  return content.readMethod !== "none" && content.pages.some((page) => page.text.trim());
}

// Square-bracket placeholders the plan draft leaves for the owner
export function countPlaceholders(text: string): number {
  return [...text.matchAll(/\[[^\[\]\n]{2,200}\]/g)].length;
}
