import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { brandLibraryFiles, businesses, products } from "@/db/schema";
import type { LibraryGroup } from "@/lib/brand/library";

// Owner-scoped like product-photos.ts. Bytes are only read by getLibraryFileForOwner, and never changed.

export const LIBRARY_LIMITS = { files: 60, totalBytes: 150_000_000 } as const;

export interface LibraryFileSummary {
  id: string;
  group: LibraryGroup;
  title: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  createdAt: Date;
}

export interface NewLibraryFile {
  group: LibraryGroup;
  title: string;
  mimeType: string;
  sha256: string;
  width: number;
  height: number;
  data: Uint8Array;
}

const columns = {
  id: brandLibraryFiles.id,
  group: brandLibraryFiles.group,
  title: brandLibraryFiles.title,
  mimeType: brandLibraryFiles.mimeType,
  byteSize: brandLibraryFiles.byteSize,
  width: brandLibraryFiles.width,
  height: brandLibraryFiles.height,
  createdAt: brandLibraryFiles.createdAt,
};

const owned = (ownerId: string) => eq(businesses.ownerId, ownerId);

export async function listLibraryFilesForOwner(db: Db, ownerId: string): Promise<LibraryFileSummary[]> {
  return db
    .select(columns)
    .from(brandLibraryFiles)
    .innerJoin(businesses, eq(businesses.id, brandLibraryFiles.businessId))
    .where(owned(ownerId))
    .orderBy(desc(brandLibraryFiles.createdAt));
}

export async function getLibraryFileForOwner(db: Db, ownerId: string, fileId: string) {
  const [row] = await db
    .select({ title: brandLibraryFiles.title, mimeType: brandLibraryFiles.mimeType, data: brandLibraryFiles.data })
    .from(brandLibraryFiles)
    .innerJoin(businesses, eq(businesses.id, brandLibraryFiles.businessId))
    .where(and(owned(ownerId), eq(brandLibraryFiles.id, fileId)));
  return row ? { title: row.title, mimeType: row.mimeType, data: new Uint8Array(row.data) } : null;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function usage(db: Db | Tx, businessId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number), bytes: sql<number>`coalesce(sum(${brandLibraryFiles.byteSize}), 0)`.mapWith(Number) })
    .from(brandLibraryFiles)
    .where(eq(brandLibraryFiles.businessId, businessId));
  return { count: row?.count ?? 0, bytes: row?.bytes ?? 0 };
}

export async function libraryUsageForOwner(db: Db, ownerId: string): Promise<{ count: number; bytes: number }> {
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(owned(ownerId));
  return business ? usage(db, business.id) : { count: 0, bytes: 0 };
}

export type AddLibraryFileOutcome = { ok: true; id: string } | { ok: false; reason: "no_business" | "too_many" | "too_large" };

// Locked per business so parallel uploads can't pass the limits together
export async function addLibraryFileForOwner(db: Db, ownerId: string, input: NewLibraryFile, now = new Date()): Promise<AddLibraryFileOutcome> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(owned(ownerId)).for("update");
    if (!business) return { ok: false, reason: "no_business" };
    const used = await usage(tx, business.id);
    if (used.count >= LIBRARY_LIMITS.files) return { ok: false, reason: "too_many" };
    if (used.bytes + input.data.byteLength > LIBRARY_LIMITS.totalBytes) return { ok: false, reason: "too_large" };
    // Id made here, so the insert doesn't send the file back
    const id = crypto.randomUUID();
    await tx.insert(brandLibraryFiles).values({
      id,
      businessId: business.id,
      group: input.group,
      title: input.title,
      mimeType: input.mimeType,
      byteSize: input.data.byteLength,
      sha256: input.sha256,
      width: input.width,
      height: input.height,
      data: input.data,
      createdAt: now,
    });
    return { ok: true, id };
  });
}

// Products showing it go back to no photo
export async function deleteLibraryFileForOwner(db: Db, ownerId: string, fileId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(owned(ownerId)).for("update");
    if (!business) return false;
    const where = and(eq(brandLibraryFiles.id, fileId), eq(brandLibraryFiles.businessId, business.id));
    const [found] = await tx.select({ id: brandLibraryFiles.id }).from(brandLibraryFiles).where(where);
    if (!found) return false;
    await tx.delete(brandLibraryFiles).where(where);
    await tx
      .update(products)
      .set({ photo: null })
      .where(and(eq(products.businessId, business.id), sql`${products.photo}->>'source' = 'library' and ${products.photo}->>'fileId' = ${fileId}`));
    return true;
  });
}
