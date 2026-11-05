import { countOf, findSensitive, SENSITIVE_KINDS, type SensitiveCounts } from "@/lib/privacy/sensitive";
import { readPdf } from "./pdf";
import { redactImage, redactPdf, redactScannedPdf } from "./redact";
import type { readDocument } from "./read";
import { type DocumentContent, EMPTY_CONTENT } from "./types";

type ReadType = Parameters<typeof readDocument>[1]["type"];

// What's kept when a document shows a number SnapStart never keeps: a redacted copy of the file, with those numbers
// painted out and no text layer under them, plus its text with each number replaced by a label. A PDF with a text
// layer is redacted before anything is stored. A photo or scan can only be checked once it's read, so it's redacted
// then, and the copy is read again to make sure nothing is left. A copy that can't be made or checked isn't kept.

export async function showsSensitiveNumber(bytes: Uint8Array, type: string): Promise<boolean | null> {
  if (type !== "application/pdf") return null;
  try {
    const reading = await readPdf(bytes);
    if (reading.looksScanned) return null;
    return reading.pages.some((page) => findSensitive(page.text).length > 0);
  } catch {
    return null;
  }
}

// What an upload is stored as: the file as it is, or, when its text shows one of those numbers, its redacted copy
export async function screenUpload(
  bytes: Uint8Array,
  type: string,
  sha256: string,
): Promise<{ data: Uint8Array | null; sha256: string | null; content: DocumentContent }> {
  if (!(await showsSensitiveNumber(bytes, type))) return { data: bytes, sha256, content: EMPTY_CONTENT };
  const redacted = await redactPdf(bytes);
  if (!redacted.ok) return { data: null, sha256: null, content: { ...EMPTY_CONTENT, fileRemoved: true } };
  return { data: redacted.data, sha256: await sha256Of(redacted.data), content: { ...EMPTY_CONTENT, fileRedacted: true } };
}

export type FileOutcome = { kind: "keep" } | { kind: "replace"; data: Uint8Array; mimeType: ReadType } | { kind: "drop" };

// After reading: keep the stored file, replace it with a redacted copy, or drop it. `check` reads a copy again and
// says whether it still shows one of those numbers.
export async function afterReading(input: {
  before: { hasFile: boolean; content: DocumentContent } | null;
  content: DocumentContent;
  // The file as read, when there is one
  data?: Uint8Array;
  type: ReadType;
  check?: (data: Uint8Array, type: ReadType) => Promise<boolean>;
}): Promise<{ content: DocumentContent; file: FileOutcome }> {
  const { before, data, type } = input;
  const { regions, ...content } = input.content;
  // Text scrubbed earlier, such as a paste, has nothing left to find: what was removed then still counts
  const removed = mostOf(before?.content.removed ?? {}, content.removed ?? {});
  const shows = countOf(content.removed) > 0;
  const hasFile = before?.hasFile ?? Boolean(data);
  const saved = (extra: Partial<DocumentContent>): DocumentContent => {
    const next: DocumentContent = { ...content, ...extra };
    delete next.removed;
    delete next.fileRedacted;
    delete next.fileRemoved;
    if (countOf(removed)) next.removed = removed;
    if (extra.fileRedacted ?? before?.content.fileRedacted) next.fileRedacted = true;
    if (extra.fileRemoved ?? before?.content.fileRemoved) next.fileRemoved = true;
    return next;
  };

  // Nothing to cover, or the stored file is already the redacted copy
  if (!shows || !hasFile || before?.content.fileRedacted) return { content: saved({}), file: { kind: "keep" } };
  if (!data) return { content: saved({ fileRemoved: true }), file: { kind: "drop" } };

  let copy: { ok: true; data: Uint8Array } | { ok: false; reason: string };
  if (type === "application/pdf") copy = regions?.length ? await redactScannedPdf(data, regions) : await redactPdf(data);
  else copy = await redactImage(data, regions ?? []);
  const copyType = type;
  // A copy made from the AI's places is read again: it's kept only if nothing is left
  const fromRegions = Boolean(regions?.length) || type !== "application/pdf";
  const clean = copy.ok && (!fromRegions || (input.check ? !(await input.check(copy.data, copyType)) : false));
  if (!copy.ok || !clean) return { content: saved({ fileRemoved: true }), file: { kind: "drop" } };
  return { content: saved({ fileRedacted: true }), file: { kind: "replace", data: copy.data, mimeType: copyType } };
}

async function sha256Of(data: Uint8Array): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(data).digest("hex");
}

function mostOf(a: SensitiveCounts, b: SensitiveCounts): SensitiveCounts {
  return Object.fromEntries(SENSITIVE_KINDS.flatMap((kind) => (a[kind] || b[kind] ? [[kind, Math.max(a[kind] ?? 0, b[kind] ?? 0)]] : [])));
}
