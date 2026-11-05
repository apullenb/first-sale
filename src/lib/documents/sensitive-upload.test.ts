import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { documents } from "@/db/schema";
import { createMockProvider } from "@/lib/ai/providers/mock";
import { createDocumentForOwner, getDocumentFileForOwner, getDocumentForOwner, updateDocumentForOwner } from "@/lib/data/documents";
import { REDACTED } from "@/lib/privacy/sensitive";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { textPdf } from "@/test/pdf";
import { LOOKALIKES, type PrivacySample, SSN_LETTER } from "@/test/privacy-samples";
import { readPdf } from "./pdf";
import { readDocument } from "./read";
import { afterReading, screenUpload } from "./screen";

// Two made-up PDFs through the same steps an upload takes (uploadDocumentAction, then readAndSave): screened, redacted
// when needed, stored sealed, read and scrubbed. PUBLISH_PRIVACY_REPORT=1 also writes what was stored to
// docs/validation/privacy/ for docs/VALIDATION.md.

const PUBLISH = process.env.PUBLISH_PRIVACY_REPORT === "1";
const OUT = path.resolve(__dirname, "../../../docs/validation/privacy");
const report: Record<string, unknown>[] = [];

let db: Awaited<ReturnType<typeof createTestDb>>;

beforeEach(async () => {
  vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
  db = await createTestDb();
  await seedOwners(db);
});

// The upload action's steps, in order, with the ForOwner functions its wrappers call
async function upload(sample: PrivacySample) {
  const original = await textPdf([sample.lines.map((line) => line.text)]);
  const sha256 = createHash("sha256").update(original).digest("hex");
  const stored = await screenUpload(original, "application/pdf", sha256);
  const created = await createDocumentForOwner(db, "owner-a", { title: sample.title, origin: "upload", role: "form", mimeType: "application/pdf", ...stored });
  if (!created.ok) throw new Error(created.reason);
  const content = await readDocument(createMockProvider(), { type: "application/pdf", data: original });
  const before = await getDocumentForOwner(db, "owner-a", created.id);
  const settled = await afterReading({ before, content, data: original, type: "application/pdf" });
  const patch = settled.file.kind === "replace" ? { data: settled.file.data } : settled.file.kind === "drop" ? { data: null } : {};
  await updateDocumentForOwner(db, "owner-a", created.id, { content: settled.content, ...patch });

  const [row] = await db.select().from(documents).where(eq(documents.id, created.id));
  const file = await getDocumentFileForOwner(db, "owner-a", created.id);
  const text = row.content.pages.map((page) => page.text).join("\n");
  return { original, row, file, text, redactedAtUpload: Boolean(stored.content.fileRedacted) };
}

// Each line's value, kept as is or replaced by its label
function outcomes(sample: PrivacySample, text: string) {
  return sample.lines.map((line) => {
    const removedAs = line.expect === "kept" ? null : line.expect;
    const actual = text.includes(line.value) ? "kept" : removedAs && text.includes(line.text.replace(line.value, REDACTED[removedAs])) ? removedAs : "changed";
    return { line: line.text, value: line.value, expected: line.expect, actual, why: line.why };
  });
}

async function publish(sample: PrivacySample, result: Awaited<ReturnType<typeof upload>>) {
  const lines = outcomes(sample, result.text);
  const entry = {
    id: sample.id,
    title: sample.title,
    fileKept: result.file !== null,
    redactedBeforeStorage: result.redactedAtUpload,
    storedFileBytes: result.row.data ? `${result.row.data.length} bytes, sealed (starts "${Buffer.from(result.row.data).subarray(0, 4).toString()}")` : null,
    readBackMatchesOriginal: result.file ? Buffer.from(result.file.data).equals(Buffer.from(result.original)) : null,
    removed: result.row.content.removed ?? {},
    fileRedacted: result.row.content.fileRedacted ?? false,
    fileRemoved: result.row.content.fileRemoved ?? false,
    storedFileTextLayer: result.file ? (await readPdf(result.file.data)).pages.map((page) => page.text).join("").trim() : null,
    lines,
  };
  report.push(entry);
  if (!PUBLISH) return;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, `${sample.id}.original.pdf`), result.original);
  // What SnapStart kept: the text, drawn as a PDF so it reads side by side with the original
  writeFileSync(path.join(OUT, `${sample.id}.stored-text.pdf`), await textPdf([["WHAT SNAPSTART STORED (text of the document after scrubbing)", "", ...result.text.split("\n")]]));
  if (result.file) writeFileSync(path.join(OUT, `${sample.id}.stored-file.pdf`), result.file.data);
}

afterAll(() => {
  if (PUBLISH && report.length) writeFileSync(path.join(OUT, "results.json"), `${JSON.stringify({ ranAt: new Date().toISOString(), samples: report }, null, 2)}\n`);
});

describe("an uploaded PDF with a Social Security number", () => {
  it("stores a redacted copy of the file, and the text, with every private number taken out of both", async () => {
    const result = await upload(SSN_LETTER);

    // Redacted before storage: the original's bytes never reached the database
    expect(result.redactedAtUpload).toBe(true);
    expect(Buffer.from(result.row.data!).subarray(0, 4).toString()).toBe("SSE1");
    expect(result.row.content).toMatchObject({ readMethod: "pdf_text", removed: { ssn: 1, routing: 1, account: 1 }, fileRedacted: true });
    expect(result.row.content.fileRemoved).toBeUndefined();
    // The file kept is the redacted copy: a page image with the numbers painted out, and no text layer to extract
    expect(Buffer.from(result.file!.data).equals(Buffer.from(result.original))).toBe(false);
    const kept = await readPdf(result.file!.data);
    expect(kept.totalPages).toBe(1);
    expect(kept.pages.map((page) => page.text).join("").trim()).toBe("");
    const bytes = Buffer.from(result.file!.data);
    for (const secret of ["123-45-6789", "021000021", "000123456789"]) expect(bytes.includes(Buffer.from(secret))).toBe(false);
    // Nowhere in the stored record's text either, in any form
    const everything = JSON.stringify({ ...result.row, data: null });
    for (const secret of ["123-45-6789", "123456789", "021000021", "000123456789"]) expect(everything).not.toContain(secret);
    // Every line comes out as expected: private numbers labeled, everything else word for word
    for (const each of outcomes(SSN_LETTER, result.text)) expect(each.actual, each.line).toBe(each.expected);
    await publish(SSN_LETTER, result);
  });
});

describe("an uploaded PDF full of numbers that only look sensitive", () => {
  it("keeps the file, sealed, and every number in it exactly as written", async () => {
    const result = await upload(LOOKALIKES);

    expect(result.redactedAtUpload).toBe(false);
    expect(Buffer.from(result.row.data!).subarray(0, 4).toString()).toBe("SSE1");
    expect(Buffer.from(result.file!.data).equals(Buffer.from(result.original))).toBe(true);
    expect(result.row.content.removed).toBeUndefined();
    expect(result.row.content.fileRemoved).toBeUndefined();
    expect(result.row.content.fileRedacted).toBeUndefined();
    // The stored text is exactly what the PDF says
    expect(result.text).toBe((await readPdf(result.original)).pages.map((page) => page.text).join("\n"));
    for (const each of outcomes(LOOKALIKES, result.text)) expect(each.actual, each.line).toBe("kept");
    await publish(LOOKALIKES, result);
  });
});
