import "server-only";
import { and, asc, count, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { brandLibraryFiles, businesses, orderLines, productPhotos, productPhotoVersions, productPictures, productPriceChecks, products } from "@/db/schema";
import type { PriceCheck } from "@/lib/rules/price-compare";
import { PICTURES_PER_ITEM, type NewItemPicture } from "@/lib/products/picture";
import { type DescriptionAuthor, type ItemKind, PRODUCT_LIMITS, type ProductPhotoRef, type ProductValues, readOptions } from "@/lib/rules/products";

// Owner-scoped like product-photos.ts. Values were checked by rules/products.ts before they get here.

export interface ProductRow extends ProductValues {
  id: string;
  createdAt: Date;
}

const columns = {
  id: products.id,
  kind: products.kind,
  status: products.status,
  origin: products.origin,
  name: products.name,
  description: products.description,
  descriptionBy: products.descriptionBy,
  priceCents: products.priceCents,
  priceText: products.priceText,
  unitCostCents: products.unitCostCents,
  quantity: products.quantity,
  duration: products.duration,
  location: products.location,
  included: products.included,
  options: products.options,
  photo: products.photo,
  createdAt: products.createdAt,
};

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function businessOf(db: Db | Tx, ownerId: string, lock = false): Promise<string | null> {
  const query = db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  const [row] = lock ? await query.for("update") : await query;
  return row?.id ?? null;
}

// "confirmed": only what the owner confirmed, for anything public; "all" adds suggestions, for the products page
export async function listProductsForOwner(db: Db, ownerId: string, which: "all" | "confirmed" = "all"): Promise<ProductRow[]> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return [];
  const where = which === "confirmed" ? and(eq(products.businessId, businessId), eq(products.status, "confirmed")) : eq(products.businessId, businessId);
  const rows = await db.select(columns).from(products).where(where).orderBy(asc(products.createdAt), asc(products.id));
  // Practice stand-in descriptions stay off anything public
  return rows.map((row) => ({ ...row, options: readOptions(row.options), ...(which === "confirmed" && row.descriptionBy === "practice" ? { description: "" } : {}) }));
}

export async function getProductForOwner(db: Db, ownerId: string, productId: string): Promise<ProductRow | null> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return null;
  const [row] = await db.select(columns).from(products).where(and(eq(products.id, productId), eq(products.businessId, businessId)));
  return row ? { ...row, options: readOptions(row.options) } : null;
}

// The picture must be the owner's own: a product photo, an approved edit, a Brand Library picture or an approved generated picture
async function photoIsOwned(tx: Tx, businessId: string, ref: ProductPhotoRef): Promise<boolean> {
  if (ref.source === "original") {
    const [row] = await tx.select({ id: productPhotos.id }).from(productPhotos).where(and(eq(productPhotos.id, ref.photoId), eq(productPhotos.businessId, businessId)));
    return Boolean(row);
  }
  if (ref.source === "version") {
    const [row] = await tx
      .select({ id: productPhotoVersions.id })
      .from(productPhotoVersions)
      .innerJoin(productPhotos, eq(productPhotos.id, productPhotoVersions.photoId))
      .where(
        and(
          eq(productPhotoVersions.id, ref.versionId),
          eq(productPhotos.id, ref.photoId),
          eq(productPhotos.businessId, businessId),
          isNotNull(productPhotoVersions.approvedAt),
        ),
      );
    return Boolean(row);
  }
  if (ref.source === "generated") {
    const [row] = await tx
      .select({ id: productPictures.id })
      .from(productPictures)
      .where(and(eq(productPictures.id, ref.pictureId), eq(productPictures.businessId, businessId), isNotNull(productPictures.approvedAt)));
    return Boolean(row);
  }
  // Logos aren't offered as product photos
  const [row] = await tx
    .select({ id: brandLibraryFiles.id })
    .from(brandLibraryFiles)
    .where(and(eq(brandLibraryFiles.id, ref.fileId), eq(brandLibraryFiles.businessId, businessId), ne(brandLibraryFiles.group, "logos")));
  return Boolean(row);
}

export type SaveProductOutcome = { ok: true; id: string } | { ok: false; reason: "no_business" | "too_many" | "bad_photo" | "not_found" };

function row(values: ProductValues) {
  return {
    kind: values.kind,
    status: values.status,
    origin: values.origin,
    name: values.name,
    description: values.description,
    descriptionBy: values.descriptionBy,
    priceCents: values.priceCents,
    priceText: values.priceText,
    unitCostCents: values.unitCostCents,
    quantity: values.quantity,
    duration: values.duration,
    location: values.location,
    included: values.included,
    options: values.options,
    photo: values.photo,
  };
}

export async function createProductForOwner(db: Db, ownerId: string, values: ProductValues, now = new Date()): Promise<SaveProductOutcome> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return { ok: false, reason: "no_business" };
    const [used] = await tx.select({ total: count() }).from(products).where(eq(products.businessId, businessId));
    if ((used?.total ?? 0) >= PRODUCT_LIMITS.products) return { ok: false, reason: "too_many" };
    if (values.photo && !(await photoIsOwned(tx, businessId, values.photo))) return { ok: false, reason: "bad_photo" };
    const id = crypto.randomUUID();
    await tx.insert(products).values({ id, businessId, ...row(values), createdAt: now });
    return { ok: true, id };
  });
}

// Suggestions in one go; those past the limit are left out. Returns the ids added.
export async function addSuggestedItemsForOwner(
  db: Db,
  ownerId: string,
  items: { name: string; kind: ItemKind; description: string; descriptionBy: DescriptionAuthor }[],
  now = new Date(),
): Promise<string[] | null> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return null;
    const existing = await tx.select({ name: products.name }).from(products).where(eq(products.businessId, businessId));
    const taken = new Set(existing.map((each) => each.name.trim().toLowerCase()));
    const room = PRODUCT_LIMITS.products - existing.length;
    const fresh = items.filter((item) => !taken.has(item.name.trim().toLowerCase())).slice(0, Math.max(0, room));
    if (!fresh.length) return [];
    const rows = fresh.map((item, index) => ({
      id: crypto.randomUUID(),
      businessId,
      kind: item.kind,
      status: "suggested" as const,
      origin: "answers" as const,
      name: item.name,
      description: item.description,
      descriptionBy: item.descriptionBy,
      // Keeps the suggested order
      createdAt: new Date(now.getTime() + index),
    }));
    await tx.insert(products).values(rows);
    return rows.map((each) => each.id);
  });
}

export async function updateProductForOwner(db: Db, ownerId: string, productId: string, values: ProductValues): Promise<SaveProductOutcome> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return { ok: false, reason: "no_business" };
    if (values.photo && !(await photoIsOwned(tx, businessId, values.photo))) return { ok: false, reason: "bad_photo" };
    const where = and(eq(products.id, productId), eq(products.businessId, businessId));
    const [found] = await tx.select({ id: products.id }).from(products).where(where);
    if (!found) return { ok: false, reason: "not_found" };
    await tx.update(products).set(row(values)).where(where);
    return { ok: true, id: found.id };
  });
}

// A new description from AI; the item keeps everything else
export async function setDescriptionForOwner(db: Db, ownerId: string, productId: string, description: string, by: DescriptionAuthor): Promise<boolean> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return false;
  const updated = await db
    .update(products)
    .set({ description, descriptionBy: by })
    .where(and(eq(products.id, productId), eq(products.businessId, businessId)))
    .returning();
  return updated.length > 0;
}

// A product already on an order stays, so the order keeps what was sold
export async function deleteProductForOwner(db: Db, ownerId: string, productId: string): Promise<"deleted" | "not_found" | "on_orders"> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return "not_found";
    const [found] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.businessId, businessId)));
    if (!found) return "not_found";
    const [lines] = await tx.select({ total: count() }).from(orderLines).where(eq(orderLines.productId, found.id));
    if ((lines?.total ?? 0) > 0) return "on_orders";
    await tx.delete(products).where(eq(products.id, found.id));
    return "deleted";
  });
}

// --- Pictures made from an item's description

export interface PictureSummary {
  id: string;
  productId: string;
  sourceId: string | null;
  change: string | null;
  simulated: boolean;
  mimeType: string;
  approvedAt: Date | null;
  createdAt: Date;
}

const pictureColumns = {
  id: productPictures.id,
  productId: productPictures.productId,
  sourceId: productPictures.sourceId,
  change: productPictures.change,
  simulated: productPictures.simulated,
  mimeType: productPictures.mimeType,
  approvedAt: productPictures.approvedAt,
  createdAt: productPictures.createdAt,
};

export async function listPicturesForOwner(db: Db, ownerId: string): Promise<PictureSummary[]> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return [];
  return db.select(pictureColumns).from(productPictures).where(eq(productPictures.businessId, businessId)).orderBy(asc(productPictures.createdAt));
}

export async function getPictureFileForOwner(db: Db, ownerId: string, pictureId: string) {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return null;
  const [found] = await db
    .select({ id: productPictures.id, productId: productPictures.productId, simulated: productPictures.simulated, mimeType: productPictures.mimeType, data: productPictures.data, name: products.name })
    .from(productPictures)
    .innerJoin(products, eq(products.id, productPictures.productId))
    .where(and(eq(productPictures.id, pictureId), eq(productPictures.businessId, businessId)));
  return found ?? null;
}

export async function findPictureByRequestForOwner(db: Db, ownerId: string, requestKey: string): Promise<string | null> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return null;
  const [found] = await db.select({ id: productPictures.id }).from(productPictures).where(and(eq(productPictures.businessId, businessId), eq(productPictures.requestKey, requestKey)));
  return found?.id ?? null;
}

export async function pictureRoomForOwner(db: Db, ownerId: string, productId: string): Promise<"ok" | "too_many" | "not_found"> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return "not_found";
  const [item] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.businessId, businessId)));
  if (!item) return "not_found";
  const [used] = await db.select({ total: count() }).from(productPictures).where(eq(productPictures.productId, productId));
  return (used?.total ?? 0) >= PICTURES_PER_ITEM ? "too_many" : "ok";
}

export async function addPictureForOwner(db: Db, ownerId: string, productId: string, picture: NewItemPicture): Promise<{ ok: true; id: string } | { ok: false; reason: "not_found" | "too_many" }> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return { ok: false, reason: "not_found" };
    const [item] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.businessId, businessId)));
    if (!item) return { ok: false, reason: "not_found" };
    const [used] = await tx.select({ total: count() }).from(productPictures).where(eq(productPictures.productId, productId));
    if ((used?.total ?? 0) >= PICTURES_PER_ITEM) return { ok: false, reason: "too_many" };
    const id = crypto.randomUUID();
    await tx.insert(productPictures).values({ id, businessId, productId, ...picture, byteSize: picture.data.byteLength });
    return { ok: true, id };
  });
}

// The owner's approval: the picture becomes the item's photo
export async function approvePictureForOwner(db: Db, ownerId: string, productId: string, pictureId: string, now = new Date()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return false;
    const [found] = await tx
      .select({ id: productPictures.id })
      .from(productPictures)
      .where(and(eq(productPictures.id, pictureId), eq(productPictures.productId, productId), eq(productPictures.businessId, businessId)));
    if (!found) return false;
    await tx.update(productPictures).set({ approvedAt: sql`coalesce(${productPictures.approvedAt}, ${now})` }).where(eq(productPictures.id, found.id));
    await tx.update(products).set({ photo: { source: "generated", pictureId: found.id } }).where(eq(products.id, productId));
    return true;
  });
}

// Pictures the owner didn't keep; approved ones still in use stay
export async function deleteUnusedPicturesForOwner(db: Db, ownerId: string, productId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const businessId = await businessOf(tx, ownerId, true);
    if (!businessId) return 0;
    const used = await tx.select({ photo: products.photo }).from(products).where(eq(products.businessId, businessId));
    const keep = used.flatMap(({ photo }) => (photo?.source === "generated" ? [photo.pictureId] : []));
    const pictures = await tx.select({ id: productPictures.id }).from(productPictures).where(and(eq(productPictures.productId, productId), eq(productPictures.businessId, businessId)));
    const remove = pictures.map((each) => each.id).filter((id) => !keep.includes(id));
    if (remove.length) await tx.delete(productPictures).where(inArray(productPictures.id, remove));
    return remove.length;
  });
}

// --- Price comparisons: the last search per item

export async function listPriceChecksForOwner(db: Db, ownerId: string): Promise<{ productId: string; result: PriceCheck }[]> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return [];
  return db.select({ productId: productPriceChecks.productId, result: productPriceChecks.result }).from(productPriceChecks).where(eq(productPriceChecks.businessId, businessId));
}

export async function savePriceCheckForOwner(db: Db, ownerId: string, productId: string, result: PriceCheck, now = new Date()): Promise<boolean> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return false;
  const [item] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.businessId, businessId)));
  if (!item) return false;
  await db
    .insert(productPriceChecks)
    .values({ productId, businessId, result, checkedAt: now })
    .onConflictDoUpdate({ target: productPriceChecks.productId, set: { result, checkedAt: now } });
  return true;
}
