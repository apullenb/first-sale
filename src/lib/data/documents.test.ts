import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { businessDetails, checklistTasks, documents } from "@/db/schema";
import { type DocumentContent, EMPTY_CONTENT } from "@/lib/documents/types";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { saveDetailsForOwner } from "./details";
import {
  createDocumentForOwner,
  deleteDocumentForOwner,
  DOCUMENT_LIMITS,
  getDocumentFileForOwner,
  getDocumentForOwner,
  listDocumentsForOwner,
  type NewDocument,
  updateDocumentForOwner,
} from "./documents";

let db: Awaited<ReturnType<typeof createTestDb>>;
let businessA: string;
let businessB: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ businessA, businessB } = await seedOwners(db));
});

const NOW = new Date("2026-10-27T12:00:00Z");
const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0x10, 0x80]);

const upload = (overrides: Partial<NewDocument> = {}): NewDocument => ({
  title: "Vendor form",
  origin: "upload",
  mimeType: "application/pdf",
  data: bytes,
  sha256: "abc",
  content: EMPTY_CONTENT,
  ...overrides,
});

async function create(ownerId: string, overrides: Partial<NewDocument> = {}, now = NOW): Promise<string> {
  const outcome = await createDocumentForOwner(db, ownerId, upload(overrides), now);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.id;
}

async function addTask(businessId: string, key: string): Promise<string> {
  const [row] = await db.insert(checklistTasks).values({ businessId, key, title: key }).returning({ id: checklistTasks.id });
  return row.id;
}

describe("document data access", () => {
  it("creates and lists documents without their file bytes", async () => {
    const first = await create("owner-a", { title: "First" }, new Date("2026-10-27T10:00:00Z"));
    await create("owner-a", { title: "Pasted", origin: "paste", mimeType: "text/plain", data: null, sha256: null }, NOW);

    const list = await listDocumentsForOwner(db, "owner-a");
    expect(list.map((doc) => doc.title)).toEqual(["Pasted", "First"]);
    expect(list[1]).toMatchObject({ id: first, businessId: businessA, origin: "upload", byteSize: bytes.byteLength, hasFile: true });
    expect(list[0]).toMatchObject({ byteSize: 0, hasFile: false });
    for (const doc of list) expect(doc).not.toHaveProperty("data");
    expect(await listDocumentsForOwner(db, "owner-b")).toEqual([]);
  });

  it("reads a document and its file back, byte for byte, only for its owner", async () => {
    const id = await create("owner-a");

    expect(await getDocumentForOwner(db, "owner-a", id)).toMatchObject({ id, title: "Vendor form", content: EMPTY_CONTENT, answers: {}, questions: [] });
    expect(await getDocumentForOwner(db, "owner-b", id)).toBeNull();

    const file = await getDocumentFileForOwner(db, "owner-a", id);
    expect(file).toEqual({ title: "Vendor form", mimeType: "application/pdf", data: bytes });
    expect(file?.data).toBeInstanceOf(Uint8Array);
    expect(await getDocumentFileForOwner(db, "owner-b", id)).toBeNull();
  });

  it("has no file for a document stored without one", async () => {
    const id = await create("owner-a", { data: null });
    expect(await getDocumentFileForOwner(db, "owner-a", id)).toBeNull();
  });

  it("updates only the owner's own documents", async () => {
    const id = await create("owner-a");
    const content: DocumentContent = { ...EMPTY_CONTENT, readMethod: "pasted", pages: [{ number: 1, text: "Name:" }] };
    const later = new Date("2026-10-28T12:00:00Z");

    expect(await updateDocumentForOwner(db, "owner-b", id, { title: "Hijacked" }, later)).toBe(false);
    expect((await getDocumentForOwner(db, "owner-a", id))?.title).toBe("Vendor form");

    expect(await updateDocumentForOwner(db, "owner-a", id, { title: "Renamed", content }, later)).toBe(true);
    expect(await getDocumentForOwner(db, "owner-a", id)).toMatchObject({ title: "Renamed", content, updatedAt: later });
  });

  it("keeps the byte size in step with a replaced file", async () => {
    const id = await create("owner-a");
    const replacement = new Uint8Array(1234).fill(7);
    await updateDocumentForOwner(db, "owner-a", id, { data: replacement, mimeType: "image/png", sha256: "def" });

    expect((await getDocumentForOwner(db, "owner-a", id))?.byteSize).toBe(1234);
    expect((await getDocumentFileForOwner(db, "owner-a", id))?.data).toEqual(replacement);
  });

  it("deletes only the owner's own documents", async () => {
    const id = await create("owner-a");
    expect(await deleteDocumentForOwner(db, "owner-b", id)).toBe(false);
    expect(await getDocumentForOwner(db, "owner-a", id)).not.toBeNull();

    expect(await deleteDocumentForOwner(db, "owner-a", id)).toBe(true);
    expect(await getDocumentForOwner(db, "owner-a", id)).toBeNull();
    expect(await deleteDocumentForOwner(db, "owner-a", id)).toBe(false);
  });

  it("keeps details saved from a deleted document, without the link", async () => {
    const id = await create("owner-a");
    await saveDetailsForOwner(db, "owner-a", [{ key: "business_email", value: "jo@example.test" }], { source: "document", documentId: id });

    await deleteDocumentForOwner(db, "owner-a", id);

    const [detail] = await db.select().from(businessDetails).where(eq(businessDetails.businessId, businessA));
    expect(detail).toMatchObject({ key: "business_email", value: "jo@example.test", source: "document", documentId: null });
  });

  it("links a document only to the owner's own plan step", async () => {
    const mine = await addTask(businessA, "ein");
    const theirs = await addTask(businessB, "ein");

    expect(await createDocumentForOwner(db, "owner-a", upload({ taskId: theirs }))).toEqual({ ok: false, reason: "bad_task" });
    expect(await createDocumentForOwner(db, "owner-a", upload({ taskId: "no-such-task" }))).toEqual({ ok: false, reason: "bad_task" });
    const id = await create("owner-a", { taskId: mine });
    expect((await getDocumentForOwner(db, "owner-a", id))?.taskId).toBe(mine);

    expect(await updateDocumentForOwner(db, "owner-a", id, { taskId: theirs })).toBe(false);
    expect((await getDocumentForOwner(db, "owner-a", id))?.taskId).toBe(mine);
    expect(await updateDocumentForOwner(db, "owner-a", id, { taskId: null })).toBe(true);
    expect((await getDocumentForOwner(db, "owner-a", id))?.taskId).toBeNull();
  });

  it("refuses an owner without a business", async () => {
    expect(await createDocumentForOwner(db, "nobody", upload())).toEqual({ ok: false, reason: "no_business" });
  });

  it("stops at the document count limit", async () => {
    await db.insert(documents).values(
      Array.from({ length: DOCUMENT_LIMITS.count - 1 }, (_, i) => ({
        businessId: businessA,
        title: `Doc ${i}`,
        origin: "paste" as const,
        mimeType: "text/plain",
        content: EMPTY_CONTENT,
      })),
    );
    expect((await createDocumentForOwner(db, "owner-a", upload())).ok).toBe(true);
    expect(await createDocumentForOwner(db, "owner-a", upload())).toEqual({ ok: false, reason: "too_many" });
    // Each owner has their own limit
    expect((await createDocumentForOwner(db, "owner-b", upload())).ok).toBe(true);
  });

  it("stops at the total size limit", async () => {
    // Recorded size only, so the test doesn't store 150 MB
    await db.insert(documents).values({
      businessId: businessA,
      title: "Big",
      origin: "upload",
      mimeType: "application/pdf",
      byteSize: DOCUMENT_LIMITS.totalBytes - bytes.byteLength,
      content: EMPTY_CONTENT,
    });
    expect((await createDocumentForOwner(db, "owner-a", upload())).ok).toBe(true);
    expect(await createDocumentForOwner(db, "owner-a", upload())).toEqual({ ok: false, reason: "too_large" });
    expect((await createDocumentForOwner(db, "owner-a", upload({ data: null }))).ok).toBe(true);
  });

  it("holds the count limit when uploads arrive at the same time", async () => {
    await db.insert(documents).values(
      Array.from({ length: DOCUMENT_LIMITS.count - 2 }, (_, i) => ({
        businessId: businessA,
        title: `Doc ${i}`,
        origin: "paste" as const,
        mimeType: "text/plain",
        content: EMPTY_CONTENT,
      })),
    );
    const results = await Promise.all(Array.from({ length: 5 }, () => createDocumentForOwner(db, "owner-a", upload())));
    expect(results.filter((result) => result.ok)).toHaveLength(2);
  });
});
