import "server-only";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, productPhotos, productPhotoVersions } from "@/db/schema";
import type { AddVersionOutcome, NewPhotoVersion } from "@/lib/photos/edit";
import type { PhotoCategory, PhotoCheck, PhotoCrop, PhotoLook, PhotoReview } from "@/lib/photos/types";

// Owner-scoped like documents.ts. Bytes are only read by the *File functions.

export const PHOTO_LIMITS = { photos: 30, versionsPerPhoto: 20, totalBytes: 200_000_000 } as const;

export interface PhotoSummary {
  id: string;
  title: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  check: PhotoCheck | null;
  category: PhotoCategory | null;
  forSale: string[];
  answer: string | null;
  look: PhotoLook;
  crop: PhotoCrop;
  createdAt: Date;
  updatedAt: Date;
  versionCount: number;
  approvedCount: number;
}

export interface PhotoVersionSummary {
  id: string;
  photoId: string;
  number: number;
  parentId: string | null;
  look: PhotoLook;
  crop: PhotoCrop;
  refinement: string | null;
  model: string;
  simulated: boolean;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  review: PhotoReview | null;
  approvedAt: Date | null;
  createdAt: Date;
}

export interface NewPhoto {
  title: string;
  mimeType: string;
  sha256: string;
  width: number;
  height: number;
  data: Uint8Array;
}

const photoColumns = {
  id: productPhotos.id,
  title: productPhotos.title,
  mimeType: productPhotos.mimeType,
  byteSize: productPhotos.byteSize,
  width: productPhotos.width,
  height: productPhotos.height,
  check: productPhotos.check,
  category: productPhotos.category,
  forSale: productPhotos.forSale,
  answer: productPhotos.answer,
  look: productPhotos.look,
  crop: productPhotos.crop,
  createdAt: productPhotos.createdAt,
  updatedAt: productPhotos.updatedAt,
};

const versionColumns = {
  id: productPhotoVersions.id,
  photoId: productPhotoVersions.photoId,
  number: productPhotoVersions.number,
  parentId: productPhotoVersions.parentId,
  look: productPhotoVersions.look,
  crop: productPhotoVersions.crop,
  refinement: productPhotoVersions.refinement,
  model: productPhotoVersions.model,
  simulated: productPhotoVersions.simulated,
  mimeType: productPhotoVersions.mimeType,
  byteSize: productPhotoVersions.byteSize,
  width: productPhotoVersions.width,
  height: productPhotoVersions.height,
  review: productPhotoVersions.review,
  approvedAt: productPhotoVersions.approvedAt,
  createdAt: productPhotoVersions.createdAt,
};

const owned = (ownerId: string) => eq(businesses.ownerId, ownerId);

export async function listPhotosForOwner(db: Db, ownerId: string): Promise<PhotoSummary[]> {
  return db
    .select({
      ...photoColumns,
      versionCount: sql<number>`(select count(*) from ${productPhotoVersions} where ${productPhotoVersions.photoId} = ${productPhotos.id})`.mapWith(Number),
      approvedCount: sql<number>`(select count(*) from ${productPhotoVersions} where ${productPhotoVersions.photoId} = ${productPhotos.id} and ${productPhotoVersions.approvedAt} is not null)`.mapWith(Number),
    })
    .from(productPhotos)
    .innerJoin(businesses, eq(businesses.id, productPhotos.businessId))
    .where(owned(ownerId))
    .orderBy(desc(productPhotos.createdAt));
}

export async function getPhotoForOwner(
  db: Db,
  ownerId: string,
  photoId: string,
): Promise<{ photo: Omit<PhotoSummary, "versionCount" | "approvedCount">; versions: PhotoVersionSummary[] } | null> {
  const [photo] = await db
    .select(photoColumns)
    .from(productPhotos)
    .innerJoin(businesses, eq(businesses.id, productPhotos.businessId))
    .where(and(owned(ownerId), eq(productPhotos.id, photoId)));
  if (!photo) return null;
  const versions = await db
    .select(versionColumns)
    .from(productPhotoVersions)
    .where(eq(productPhotoVersions.photoId, photo.id))
    .orderBy(asc(productPhotoVersions.number));
  return { photo, versions };
}

export async function getPhotoFileForOwner(db: Db, ownerId: string, photoId: string) {
  const [row] = await db
    .select({ title: productPhotos.title, mimeType: productPhotos.mimeType, data: productPhotos.data })
    .from(productPhotos)
    .innerJoin(businesses, eq(businesses.id, productPhotos.businessId))
    .where(and(owned(ownerId), eq(productPhotos.id, photoId)));
  return row ? { title: row.title, mimeType: row.mimeType, data: new Uint8Array(row.data) } : null;
}

export async function getPhotoVersionFileForOwner(db: Db, ownerId: string, photoId: string, versionId: string) {
  const [row] = await db
    .select({
      title: productPhotos.title,
      number: productPhotoVersions.number,
      simulated: productPhotoVersions.simulated,
      mimeType: productPhotoVersions.mimeType,
      data: productPhotoVersions.data,
    })
    .from(productPhotoVersions)
    .innerJoin(productPhotos, eq(productPhotos.id, productPhotoVersions.photoId))
    .innerJoin(businesses, eq(businesses.id, productPhotos.businessId))
    .where(and(owned(ownerId), eq(productPhotos.id, photoId), eq(productPhotoVersions.id, versionId)));
  return row ? { ...row, data: new Uint8Array(row.data) } : null;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Originals and versions together, for the library's size limit
async function bytesUsed(db: Db | Tx, businessId: string): Promise<number> {
  const [originals] = await db
    .select({ bytes: sql<number>`coalesce(sum(${productPhotos.byteSize}), 0)`.mapWith(Number) })
    .from(productPhotos)
    .where(eq(productPhotos.businessId, businessId));
  const [versions] = await db
    .select({ bytes: sql<number>`coalesce(sum(${productPhotoVersions.byteSize}), 0)`.mapWith(Number) })
    .from(productPhotoVersions)
    .innerJoin(productPhotos, eq(productPhotos.id, productPhotoVersions.photoId))
    .where(eq(productPhotos.businessId, businessId));
  return (originals?.bytes ?? 0) + (versions?.bytes ?? 0);
}

export type CreatePhotoOutcome = { ok: true; id: string } | { ok: false; reason: "no_business" | "too_many" | "too_large" };

// Locked per business so parallel uploads can't pass the limits together
export async function createPhotoForOwner(db: Db, ownerId: string, input: NewPhoto, now = new Date()): Promise<CreatePhotoOutcome> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!business) return { ok: false, reason: "no_business" };
    const [count] = await tx
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(productPhotos)
      .where(eq(productPhotos.businessId, business.id));
    if (count.count >= PHOTO_LIMITS.photos) return { ok: false, reason: "too_many" };
    if ((await bytesUsed(tx, business.id)) + input.data.byteLength > PHOTO_LIMITS.totalBytes) return { ok: false, reason: "too_large" };

    // Id made here, so the insert doesn't send the file back
    const id = crypto.randomUUID();
    await tx.insert(productPhotos).values({
      id,
      businessId: business.id,
      title: input.title,
      mimeType: input.mimeType,
      byteSize: input.data.byteLength,
      sha256: input.sha256,
      width: input.width,
      height: input.height,
      data: input.data,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, id };
  });
}

export interface PhotoPatch {
  check?: PhotoCheck | null;
  category?: PhotoCategory | null;
  forSale?: string[];
  answer?: string | null;
  look?: PhotoLook;
  crop?: PhotoCrop;
}

export async function updatePhotoForOwner(db: Db, ownerId: string, photoId: string, patch: PhotoPatch, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const where = await ownedPhoto(tx, ownerId, photoId);
    if (!where) return false;
    await tx.update(productPhotos).set({ ...patch, updatedAt: now }).where(where);
    return true;
  });
}

// Removes the original and every version with it
export async function deletePhotoForOwner(db: Db, ownerId: string, photoId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const where = await ownedPhoto(tx, ownerId, photoId);
    if (!where) return false;
    await tx.delete(productPhotos).where(where);
    return true;
  });
}

async function ownedPhoto(tx: Tx, ownerId: string, photoId: string) {
  const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  if (!business) return null;
  const where = and(eq(productPhotos.id, photoId), eq(productPhotos.businessId, business.id));
  const [found] = await tx.select({ id: productPhotos.id }).from(productPhotos).where(where);
  return found ? where : null;
}

export async function findPhotoVersionByRequestForOwner(db: Db, ownerId: string, photoId: string, requestKey: string): Promise<string | null> {
  const [row] = await db
    .select({ id: productPhotoVersions.id })
    .from(productPhotoVersions)
    .innerJoin(productPhotos, eq(productPhotos.id, productPhotoVersions.photoId))
    .innerJoin(businesses, eq(businesses.id, productPhotos.businessId))
    .where(and(owned(ownerId), eq(productPhotos.id, photoId), eq(productPhotoVersions.requestKey, requestKey)));
  return row?.id ?? null;
}

type Room = "ok" | "not_found" | "too_many" | "too_large";

async function roomIn(db: Db | Tx, businessId: string, photoId: string, adding: number): Promise<Room> {
  const [photo] = await db
    .select({ id: productPhotos.id })
    .from(productPhotos)
    .where(and(eq(productPhotos.id, photoId), eq(productPhotos.businessId, businessId)));
  if (!photo) return "not_found";
  const [count] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(productPhotoVersions)
    .where(eq(productPhotoVersions.photoId, photoId));
  if (count.count >= PHOTO_LIMITS.versionsPerPhoto) return "too_many";
  // Checked before paying for an edit: a new version is no bigger than this
  if ((await bytesUsed(db, businessId)) + adding > PHOTO_LIMITS.totalBytes) return "too_large";
  return "ok";
}

const TYPICAL_VERSION_BYTES = 8_000_000;

export async function photoVersionRoomForOwner(db: Db, ownerId: string, photoId: string): Promise<Room> {
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  return business ? roomIn(db, business.id, photoId, TYPICAL_VERSION_BYTES) : "not_found";
}

// Numbered under a lock on the business; a repeated request key returns the version already saved.
// Limits are checked before paying for the edit (photoVersionRoomForOwner), so a paid result is never thrown away.
export async function addPhotoVersionForOwner(
  db: Db,
  ownerId: string,
  photoId: string,
  input: NewPhotoVersion,
  now = new Date(),
): Promise<AddVersionOutcome> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!business) return { ok: false, reason: "not_found" };
    const [existing] = await tx
      .select({ id: productPhotoVersions.id })
      .from(productPhotoVersions)
      .innerJoin(productPhotos, eq(productPhotos.id, productPhotoVersions.photoId))
      .where(and(eq(productPhotos.businessId, business.id), eq(productPhotos.id, photoId), eq(productPhotoVersions.requestKey, input.requestKey)));
    if (existing) return { ok: true, id: existing.id };

    const [photo] = await tx
      .select({ id: productPhotos.id })
      .from(productPhotos)
      .where(and(eq(productPhotos.id, photoId), eq(productPhotos.businessId, business.id)));
    if (!photo) return { ok: false, reason: "not_found" };
    if (input.parentId) {
      const [parent] = await tx
        .select({ id: productPhotoVersions.id })
        .from(productPhotoVersions)
        .where(and(eq(productPhotoVersions.id, input.parentId), eq(productPhotoVersions.photoId, photoId)));
      if (!parent) return { ok: false, reason: "not_found" };
    }

    const [last] = await tx
      .select({ number: sql<number>`coalesce(max(${productPhotoVersions.number}), 0)`.mapWith(Number) })
      .from(productPhotoVersions)
      .where(eq(productPhotoVersions.photoId, photoId));
    const id = crypto.randomUUID();
    await tx.insert(productPhotoVersions).values({
      id,
      photoId,
      number: (last?.number ?? 0) + 1,
      parentId: input.parentId,
      look: input.look,
      crop: input.crop,
      refinement: input.refinement,
      instruction: input.instruction,
      model: input.model,
      simulated: input.simulated,
      requestKey: input.requestKey,
      mimeType: input.mimeType,
      byteSize: input.data.byteLength,
      width: input.width,
      height: input.height,
      data: input.data,
      createdAt: now,
    });
    return { ok: true, id };
  });
}

async function ownedVersion(db: Db, ownerId: string, versionId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: productPhotoVersions.id })
    .from(productPhotoVersions)
    .innerJoin(productPhotos, eq(productPhotos.id, productPhotoVersions.photoId))
    .innerJoin(businesses, eq(businesses.id, productPhotos.businessId))
    .where(and(owned(ownerId), eq(productPhotoVersions.id, versionId)));
  return row?.id ?? null;
}

export async function setPhotoVersionReviewForOwner(db: Db, ownerId: string, versionId: string, review: PhotoReview): Promise<boolean> {
  const id = await ownedVersion(db, ownerId, versionId);
  if (!id) return false;
  await db.update(productPhotoVersions).set({ review }).where(eq(productPhotoVersions.id, id));
  return true;
}

// The owner has confirmed it shows the product accurately; the action checks that first
export async function approvePhotoVersionForOwner(db: Db, ownerId: string, versionId: string, approved: boolean, now = new Date()): Promise<boolean> {
  const id = await ownedVersion(db, ownerId, versionId);
  if (!id) return false;
  await db
    .update(productPhotoVersions)
    .set({ approvedAt: approved ? now : null })
    .where(eq(productPhotoVersions.id, id));
  return true;
}

export interface LibraryPhoto extends PhotoVersionSummary {
  title: string;
}

// The product library: versions the owner approved
export async function listPhotoLibraryForOwner(db: Db, ownerId: string): Promise<LibraryPhoto[]> {
  return db
    .select({ ...versionColumns, title: productPhotos.title })
    .from(productPhotoVersions)
    .innerJoin(productPhotos, eq(productPhotos.id, productPhotoVersions.photoId))
    .innerJoin(businesses, eq(businesses.id, productPhotos.businessId))
    .where(and(owned(ownerId), isNotNull(productPhotoVersions.approvedAt)))
    .orderBy(desc(productPhotoVersions.approvedAt));
}
