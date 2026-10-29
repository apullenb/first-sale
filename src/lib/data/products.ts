import "server-only";
import { and, asc, count, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { brandLibraryFiles, businesses, orderLines, productPhotos, productPhotoVersions, products } from "@/db/schema";
import { PRODUCT_LIMITS, type ProductPhotoRef, type ProductValues } from "@/lib/rules/products";

// Owner-scoped like product-photos.ts. Values were checked by rules/products.ts before they get here.

export interface ProductRow extends ProductValues {
  id: string;
  createdAt: Date;
}

const columns = {
  id: products.id,
  name: products.name,
  description: products.description,
  priceCents: products.priceCents,
  unitCostCents: products.unitCostCents,
  quantity: products.quantity,
  photo: products.photo,
  createdAt: products.createdAt,
};

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function businessOf(db: Db | Tx, ownerId: string, lock = false): Promise<string | null> {
  const query = db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  const [row] = lock ? await query.for("update") : await query;
  return row?.id ?? null;
}

export async function listProductsForOwner(db: Db, ownerId: string): Promise<ProductRow[]> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return [];
  return db.select(columns).from(products).where(eq(products.businessId, businessId)).orderBy(asc(products.createdAt), asc(products.id));
}

// The picture must be the owner's own: a product photo, an approved edit of one, or a Brand Library picture
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
  const [row] = await tx.select({ id: brandLibraryFiles.id }).from(brandLibraryFiles).where(and(eq(brandLibraryFiles.id, ref.fileId), eq(brandLibraryFiles.businessId, businessId)));
  return Boolean(row);
}

export type SaveProductOutcome = { ok: true; id: string } | { ok: false; reason: "no_business" | "too_many" | "bad_photo" | "not_found" };

function row(values: ProductValues) {
  return {
    name: values.name,
    description: values.description,
    priceCents: values.priceCents,
    unitCostCents: values.unitCostCents,
    quantity: values.quantity,
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
