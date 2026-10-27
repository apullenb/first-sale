import "server-only";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, checklistTasks, documents } from "@/db/schema";
import type { DocumentOrigin, GeneratedKind } from "@/lib/domain";
import type { DocumentRole } from "@/lib/documents/library";
import type { FormVerification } from "@/lib/documents/official-forms";
import type { DocumentContent, DocumentGuide, DocumentQuestion, DraftAnswers, GeneratedContent } from "@/lib/documents/types";

// Owner-scoped like businesses.ts. File bytes are only read by getDocumentFileForOwner.

export const DOCUMENT_LIMITS = { count: 60, totalBytes: 150_000_000 } as const;

type Row = typeof documents.$inferSelect;
export type StoredDocument = Omit<Row, "data"> & { hasFile: boolean };

export interface NewDocument {
  title: string;
  origin: DocumentOrigin;
  generatedKind?: GeneratedKind | null;
  mimeType: string;
  data: Uint8Array | null;
  sha256: string | null;
  sourceUrl?: string | null;
  taskId?: string | null;
  fromDocumentId?: string | null;
  content: DocumentContent;
  draft?: GeneratedContent | null;
  answers?: DraftAnswers;
  role?: DocumentRole | null;
  // A new version of this document; the new row joins its family
  versionOf?: string | null;
  formKey?: string | null;
  verification?: FormVerification | null;
  factsUsed?: Record<string, string> | null;
  obtainedAt?: Date | null;
  requestKey?: string | null;
}

// `existed`: the request key matched a document already made, so nothing new was saved
export type CreateOutcome =
  | { ok: true; id: string; existed?: boolean }
  | { ok: false; reason: "no_business" | "too_many" | "too_large" | "bad_task" | "bad_version" };

const summary = {
  id: documents.id,
  businessId: documents.businessId,
  title: documents.title,
  origin: documents.origin,
  generatedKind: documents.generatedKind,
  mimeType: documents.mimeType,
  byteSize: documents.byteSize,
  sha256: documents.sha256,
  sourceUrl: documents.sourceUrl,
  taskId: documents.taskId,
  fromDocumentId: documents.fromDocumentId,
  content: documents.content,
  guide: documents.guide,
  answers: documents.answers,
  questions: documents.questions,
  draft: documents.draft,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
  role: documents.role,
  familyId: documents.familyId,
  version: documents.version,
  formKey: documents.formKey,
  verification: documents.verification,
  factsUsed: documents.factsUsed,
  obtainedAt: documents.obtainedAt,
  requestKey: documents.requestKey,
  hasFile: sql<boolean>`${documents.data} is not null`,
};

export async function listDocumentsForOwner(db: Db, ownerId: string): Promise<StoredDocument[]> {
  const rows = await db
    .select(summary)
    .from(documents)
    .innerJoin(businesses, eq(businesses.id, documents.businessId))
    .where(eq(businesses.ownerId, ownerId))
    .orderBy(desc(documents.updatedAt));
  return rows;
}

export async function getDocumentForOwner(db: Db, ownerId: string, id: string): Promise<StoredDocument | null> {
  const [row] = await db
    .select(summary)
    .from(documents)
    .innerJoin(businesses, eq(businesses.id, documents.businessId))
    .where(and(eq(businesses.ownerId, ownerId), eq(documents.id, id)));
  return row ?? null;
}

export async function getDocumentFileForOwner(
  db: Db,
  ownerId: string,
  id: string,
): Promise<{ title: string; mimeType: string; data: Uint8Array } | null> {
  const [row] = await db
    .select({ title: documents.title, mimeType: documents.mimeType, data: documents.data })
    .from(documents)
    .innerJoin(businesses, eq(businesses.id, documents.businessId))
    .where(and(eq(businesses.ownerId, ownerId), eq(documents.id, id)));
  return row?.data ? { title: row.title, mimeType: row.mimeType, data: new Uint8Array(row.data) } : null;
}

// Locked per business so parallel uploads can't pass the limits together
export async function createDocumentForOwner(db: Db, ownerId: string, input: NewDocument, now = new Date()): Promise<CreateOutcome> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!business) return { ok: false, reason: "no_business" };
    if (input.requestKey) {
      const [made] = await tx
        .select({ id: documents.id })
        .from(documents)
        .where(and(eq(documents.businessId, business.id), eq(documents.requestKey, input.requestKey)));
      if (made) return { ok: true, id: made.id, existed: true };
    }
    let familyId: string | null = null;
    let version = 1;
    if (input.versionOf) {
      const [base] = await tx
        .select({ id: documents.id, familyId: documents.familyId })
        .from(documents)
        .where(and(eq(documents.businessId, business.id), eq(documents.id, input.versionOf)));
      if (!base) return { ok: false, reason: "bad_version" };
      familyId = base.familyId ?? base.id;
      const [{ top }] = await tx
        .select({ top: sql<number>`coalesce(max(${documents.version}), 1)`.mapWith(Number) })
        .from(documents)
        .where(and(eq(documents.businessId, business.id), or(eq(documents.id, familyId), eq(documents.familyId, familyId))));
      version = top + 1;
    }
    if (input.taskId) {
      const [task] = await tx
        .select({ id: checklistTasks.id })
        .from(checklistTasks)
        .where(and(eq(checklistTasks.id, input.taskId), eq(checklistTasks.businessId, business.id)));
      if (!task) return { ok: false, reason: "bad_task" };
    }
    const [usage] = await tx
      .select({ count: sql<number>`count(*)`.mapWith(Number), bytes: sql<number>`coalesce(sum(${documents.byteSize}), 0)`.mapWith(Number) })
      .from(documents)
      .where(eq(documents.businessId, business.id));
    const size = input.data?.byteLength ?? 0;
    if (usage.count >= DOCUMENT_LIMITS.count) return { ok: false, reason: "too_many" };
    if (usage.bytes + size > DOCUMENT_LIMITS.totalBytes) return { ok: false, reason: "too_large" };

    // Id made here, so the insert doesn't send the file back
    const id = crypto.randomUUID();
    await tx
      .insert(documents)
      .values({
        id,
        businessId: business.id,
        title: input.title,
        origin: input.origin,
        generatedKind: input.generatedKind ?? null,
        mimeType: input.mimeType,
        byteSize: size,
        sha256: input.sha256,
        data: input.data,
        sourceUrl: input.sourceUrl ?? null,
        taskId: input.taskId ?? null,
        fromDocumentId: input.fromDocumentId ?? null,
        content: input.content,
        draft: input.draft ?? null,
        answers: input.answers ?? {},
        role: input.role ?? null,
        familyId,
        version,
        formKey: input.formKey ?? null,
        verification: input.verification ?? null,
        factsUsed: input.factsUsed ?? null,
        obtainedAt: input.obtainedAt ?? null,
        requestKey: input.requestKey ?? null,
        createdAt: now,
        updatedAt: now,
      });
    return { ok: true, id };
  });
}

export interface DocumentPatch {
  title?: string;
  content?: DocumentContent;
  guide?: DocumentGuide | null;
  answers?: DraftAnswers;
  questions?: DocumentQuestion[];
  draft?: GeneratedContent | null;
  taskId?: string | null;
  data?: Uint8Array;
  mimeType?: string;
  sha256?: string;
  factsUsed?: Record<string, string> | null;
}

export async function updateDocumentForOwner(db: Db, ownerId: string, id: string, patch: DocumentPatch, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
    if (!business) return false;
    if (patch.taskId) {
      const [task] = await tx
        .select({ id: checklistTasks.id })
        .from(checklistTasks)
        .where(and(eq(checklistTasks.id, patch.taskId), eq(checklistTasks.businessId, business.id)));
      if (!task) return false;
    }
    const where = and(eq(documents.id, id), eq(documents.businessId, business.id));
    const [found] = await tx.select({ id: documents.id }).from(documents).where(where).for("update");
    if (!found) return false;
    const set: Partial<typeof documents.$inferInsert> = { ...patch, updatedAt: now };
    if (patch.data) set.byteSize = patch.data.byteLength;
    await tx.update(documents).set(set).where(where);
    return true;
  });
}

// Removes the file, its text, drafts and questions. Details saved from it stay, without the link.
export async function deleteDocumentForOwner(db: Db, ownerId: string, id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
    if (!business) return false;
    const where = and(eq(documents.id, id), eq(documents.businessId, business.id));
    const [found] = await tx.select({ id: documents.id }).from(documents).where(where);
    if (!found) return false;
    await tx.delete(documents).where(where);
    return true;
  });
}
