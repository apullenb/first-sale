import "server-only";
import { and, eq, getTableColumns } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, products, squareConnections, squareProductLinks } from "@/db/schema";
import { OwnerFacingError } from "@/lib/errors";
import { withSquareConnectionForOwner } from "./square";
import { catalogDescription, itemSchema, listCatalogItems, retrieveItem, squareRequest, type SquareItem } from "@/lib/square/client";
import { importSquareProduct, squareProductObject, syncFingerprint, type ProductSyncStatus } from "@/lib/rules/square-products";
import { PRODUCT_LIMITS } from "@/lib/rules/products";

import { retrieveProductPhoto } from "@/lib/square/images";
import { createPhotoForOwner } from "./product-photos";

const scoped = (businessId: string, productId: string) => and(eq(products.businessId, businessId), eq(products.id, productId));
const project = (item: SquareItem) => JSON.stringify({ name: item.item_data.name, description: catalogDescription(item), variations: (item.item_data.variations as { item_variation_data: { name: string; price_money?: unknown } }[] ?? []).map((variation) => ({ name: variation.item_variation_data.name, price: variation.item_variation_data.price_money })) });
const problem = (error: unknown) => error instanceof Error && error.name !== "ZodError" ? error.message : "Only fixed-price USD products with supported options can be synced.";

export async function productSyncForOwner(db: Db, owner: string): Promise<{ connected: boolean; products: Record<string, ProductSyncStatus> }> {
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, owner));
  if (!business) return { connected: false, products: {} };
  const [connection] = await db.select({ merchantId: squareConnections.merchantId, environment: squareConnections.environment }).from(squareConnections).where(eq(squareConnections.businessId, business.id));
  const rows = await db.select({ link: getTableColumns(squareProductLinks), product: getTableColumns(products) }).from(squareProductLinks)
    .innerJoin(products, eq(products.id, squareProductLinks.productId)).where(eq(squareProductLinks.businessId, business.id));
  return { connected: Boolean(connection?.merchantId), products: Object.fromEntries(rows.map(({ link, product }) => [product.id, {
    origin: link.origin, linked: Boolean(link.remoteId), dirty: syncFingerprint(product) !== link.fingerprint, pending: Boolean(link.pending),
    accountMatches: connection?.merchantId === link.merchantId && connection?.environment === link.environment,
    importedAt: link.importedAt?.toISOString() ?? null, publishedAt: link.publishedAt?.toISOString() ?? null, pushedAt: link.pushedAt?.toISOString() ?? null,
  }])) };
}

export async function pullProductsForOwner(db: Db, owner: string, forceProductId?: string, expected?: string) {
  return withSquareConnectionForOwner(db, owner, async (tokens, connection, tx) => {
    const businessId = connection.businessId;
    await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).for("update");
    const local = await tx.select().from(products).where(eq(products.businessId, businessId));
    const links = await tx.select().from(squareProductLinks).where(eq(squareProductLinks.businessId, businessId));
    let catalog: SquareItem[];
    if (forceProductId) {
      const link = links.find((link) => link.productId === forceProductId && link.merchantId === connection.merchantId && link.environment === connection.environment);
      const product = local.find((product) => product.id === forceProductId);
      if (!link?.remoteId || !product || syncFingerprint(product) !== expected) throw new OwnerFacingError("The product changed. Reload before replacing it with Square’s version.");
      catalog = [await retrieveItem(tokens.access_token, link.remoteId)];
    } else catalog = await listCatalogItems(tokens.access_token);
    const report = { imported: 0, refreshed: 0, skipped: [] as string[] };
    let used = local.length;
    for (const item of catalog) {
      const link = links.find((link) => link.remoteId === item.id && link.merchantId === connection.merchantId && link.environment === connection.environment);
      const product = link ? local.find((product) => product.id === link.productId) : null;
      if (link?.pending && !forceProductId) { report.skipped.push(`${item.item_data.name}: retry its pending push first.`); continue; }
      if (product && link && syncFingerprint(product) !== link.fingerprint && product.id !== forceProductId) { report.skipped.push(`${item.item_data.name}: local changes kept.`); continue; }
      let values;
      try {
        values = importSquareProduct(item);
        const previous = product?.options.variants ?? [];
        if (previous.some((variant) => variant.quantity !== null) && JSON.stringify(previous.map((variant) => variant.values)) !== JSON.stringify(values.options.variants.map((variant) => variant.values))) {
          throw new Error("Option changes would replace tracked stock. Resolve those options before importing.");
        }
      }
      catch (error) { report.skipped.push(`${item.item_data.name}: ${problem(error)}`); continue; }
      if (!product && used >= PRODUCT_LIMITS.products) { report.skipped.push(`${item.item_data.name}: product library is full.`); continue; }
      const productId = product?.id ?? crypto.randomUUID();
      if (product) {
        await tx.update(products).set({ name: values.name, description: values.description, descriptionBy: "owner", kind: values.kind, priceCents: values.priceCents,
          options: { ...values.options, variants: values.options.variants.map((variant) => ({ ...variant, quantity: product.options.variants.find((old) => JSON.stringify(old.values) === JSON.stringify(variant.values))?.quantity ?? null })) },
        }).where(scoped(businessId, productId));
        report.refreshed++;
      } else {
        await tx.insert(products).values({ id: productId, businessId, name: values.name, description: values.description, descriptionBy: "owner", kind: values.kind, priceCents: values.priceCents, options: values.options, status: "confirmed" });
        used++; report.imported++;
      }
      if (!product?.photo) {
        try {
          const photo = await retrieveProductPhoto(tokens.access_token, item);
          if (photo) {
            const created = await createPhotoForOwner(tx, owner, photo);
            if (!created.ok) throw new Error("Your photo library is full.");
            await tx.update(products).set({ photo: { source: "original", photoId: created.id } }).where(scoped(businessId, productId));
          }
        } catch { report.skipped.push(`${item.item_data.name}: product saved, but its photo could not be imported. Add a photo or try again.`); }
      }
      const patch = { remote: item, fingerprint: syncFingerprint(values), importedAt: new Date(), pending: null };
      await tx.insert(squareProductLinks).values({ productId, businessId, merchantId: connection.merchantId!, environment: connection.environment, remoteId: item.id, origin: "imported", ...patch })
        .onConflictDoUpdate({ target: squareProductLinks.productId, set: patch });
    }
    return report;
  });
}

export async function pushProductForOwner(db: Db, owner: string, productId: string, expected: string) {
  await withSquareConnectionForOwner(db, owner, async (tokens, connection, tx) => {
    const businessId = connection.businessId;
    await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).for("update");
    const [product] = await tx.select().from(products).where(scoped(businessId, productId)).for("update");
    if (!product || syncFingerprint(product) !== expected) throw new OwnerFacingError("The product changed. Reload and review it before publishing.");
    const [link] = await tx.select().from(squareProductLinks).where(eq(squareProductLinks.productId, productId));
    if (link && (link.merchantId !== connection.merchantId || link.environment !== connection.environment)) throw new OwnerFacingError("This product belongs to a different Square connection. Reconnect its original account.");
    if (link?.pending || link?.fingerprint === expected) return;
    let remote: SquareItem | null = null;
    if (link?.fingerprint && JSON.stringify(JSON.parse(link.fingerprint).options.groups) !== JSON.stringify(product.options.groups)) {
      throw new OwnerFacingError("Option groups changed. Update their structure in Square, then get its latest version here.");
    }
    if (link?.remoteId) {
      remote = await retrieveItem(tokens.access_token, link.remoteId);
      if (link.remote?.version !== remote.version) throw new OwnerFacingError("This product changed in Square. Get its latest version before pushing local changes.");
    }
    let object: SquareItem;
    try { object = squareProductObject(product, productId, remote); }
    catch (error) { throw new OwnerFacingError(problem(error)); }
    const pending = { key: crypto.randomUUID(), fingerprint: expected, object };
    await tx.insert(squareProductLinks).values({ productId, businessId, merchantId: connection.merchantId!, environment: connection.environment, origin: "published", pending })
      .onConflictDoUpdate({ target: squareProductLinks.productId, set: { pending } });
  });
  await withSquareConnectionForOwner(db, owner, async (tokens, connection, tx) => {
    const [link] = await tx.select().from(squareProductLinks).where(and(eq(squareProductLinks.productId, productId), eq(squareProductLinks.businessId, connection.businessId))).for("update");
    if (!link?.pending) return;
    if (link.merchantId !== connection.merchantId || link.environment !== connection.environment) throw new OwnerFacingError("Square connection changed. Reconnect the original account.");
    const pending = link.pending;
    let remote: SquareItem | null = null;
    if (link.remoteId) {
      remote = await retrieveItem(tokens.access_token, link.remoteId);
      if (remote.version !== pending.object.version && project(remote) !== project(pending.object)) throw new OwnerFacingError("This product changed in Square. Get its latest version to resolve the conflict.");
    }
    if (!remote || project(remote) !== project(pending.object)) {
      const object = { ...pending.object, ...(pending.object.id.startsWith("#") ? { version: undefined } : {}) };
      const response = await squareRequest("/v2/catalog/object", tokens.access_token, { idempotency_key: pending.key, object }) as { catalog_object?: unknown };
      remote = itemSchema.parse(response.catalog_object);
    }
    const verified = await retrieveItem(tokens.access_token, remote.id);
    if (project(verified) !== project(pending.object)) throw new OwnerFacingError("The Square result could not be confirmed. Retry the saved push.");
    const now = new Date();
    await tx.update(squareProductLinks).set({ remoteId: verified.id, remote: verified, fingerprint: pending.fingerprint, pending: null,
      publishedAt: link.publishedAt ?? (link.origin === "published" ? now : null), pushedAt: now }).where(eq(squareProductLinks.productId, productId));
  });
}
