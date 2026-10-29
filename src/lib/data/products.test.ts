import { beforeEach, describe, expect, it } from "vitest";
import { orderLines, orders } from "@/db/schema";
import { pngBytes } from "@/lib/photos/test-images";
import type { ProductValues } from "@/lib/rules/products";
import { PRODUCT_LIMITS } from "@/lib/rules/products";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { addLibraryFileForOwner } from "./brand-library";
import { approvePhotoVersionForOwner, createPhotoForOwner, deletePhotoForOwner } from "./product-photos";
import { createProductForOwner, deleteProductForOwner, listProductsForOwner, updateProductForOwner } from "./products";

let db: Awaited<ReturnType<typeof createTestDb>>;
let businessA: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ businessA } = await seedOwners(db));
});

const values = (overrides: Partial<ProductValues> = {}): ProductValues => ({ name: "Sourdough loaf", description: "Naturally leavened", priceCents: 950, unitCostCents: 300, quantity: 12, photo: null, ...overrides });

async function create(overrides: Partial<ProductValues> = {}, ownerId = "owner-a") {
  const made = await createProductForOwner(db, ownerId, values(overrides));
  if (!made.ok) throw new Error(made.reason);
  return made.id;
}

describe("products", () => {
  it("are listed in the order added, for their owner only", async () => {
    const first = await create({ name: "Loaf" }, "owner-a");
    const second = await create({ name: "Rolls", unitCostCents: null, quantity: null });
    await create({ name: "Other" }, "owner-b");
    expect((await listProductsForOwner(db, "owner-a")).map((each) => [each.id, each.name, each.unitCostCents, each.quantity])).toEqual([
      [first, "Loaf", 300, 12],
      [second, "Rolls", null, null],
    ]);
    expect(await listProductsForOwner(db, "nobody")).toEqual([]);
  });

  it("change and delete only for their owner", async () => {
    const id = await create();
    expect(await updateProductForOwner(db, "owner-b", id, values({ name: "Taken" }))).toEqual({ ok: false, reason: "not_found" });
    expect(await updateProductForOwner(db, "owner-a", id, values({ name: "Country loaf", priceCents: 1000 }))).toEqual({ ok: true, id });
    expect((await listProductsForOwner(db, "owner-a"))[0]).toMatchObject({ name: "Country loaf", priceCents: 1000 });
    expect(await deleteProductForOwner(db, "owner-b", id)).toBe("not_found");
    expect(await deleteProductForOwner(db, "owner-a", id)).toBe("deleted");
    expect(await listProductsForOwner(db, "owner-a")).toEqual([]);
  });

  it("stay when they're on an order", async () => {
    const id = await create();
    const [order] = await db.insert(orders).values({ businessId: businessA, customerName: "Sam", fulfillment: "pickup" }).returning();
    await db.insert(orderLines).values({ orderId: order.id, productId: id, quantity: 1 });
    expect(await deleteProductForOwner(db, "owner-a", id)).toBe("on_orders");
  });

  it("only show the owner's own photos, and only approved edits", async () => {
    const photo = await createPhotoForOwner(db, "owner-a", { title: "Loaf", mimeType: "image/png", sha256: "x", width: 400, height: 400, data: pngBytes(400, 400) });
    const theirs = await addLibraryFileForOwner(db, "owner-b", { group: "other", title: "Theirs", mimeType: "image/png", sha256: "y", width: 64, height: 64, data: pngBytes(64, 64) });
    if (!photo.ok || !theirs.ok) throw new Error("setup");
    expect(await createProductForOwner(db, "owner-a", values({ photo: { source: "original", photoId: photo.id } }))).toMatchObject({ ok: true });
    expect(await createProductForOwner(db, "owner-a", values({ photo: { source: "library", fileId: theirs.id } }))).toEqual({ ok: false, reason: "bad_photo" });
    expect(await createProductForOwner(db, "owner-b", values({ photo: { source: "original", photoId: photo.id } }))).toEqual({ ok: false, reason: "bad_photo" });
    expect(await createProductForOwner(db, "owner-a", values({ photo: { source: "version", photoId: photo.id, versionId: "nope" } }))).toEqual({ ok: false, reason: "bad_photo" });
    expect(await approvePhotoVersionForOwner(db, "owner-a", "nope", true)).toBe(false);
  });

  it("go back to no photo when their product photo is deleted", async () => {
    const photo = (title: string) => createPhotoForOwner(db, "owner-a", { title, mimeType: "image/png", sha256: "x", width: 400, height: 400, data: pngBytes(400, 400) });
    const [loaf, rolls] = [await photo("Loaf"), await photo("Rolls")];
    if (!loaf.ok || !rolls.ok) throw new Error("setup");
    const shown = await create({ photo: { source: "original", photoId: loaf.id } });
    const other = await create({ name: "Rolls", photo: { source: "original", photoId: rolls.id } });
    expect(await deletePhotoForOwner(db, "owner-a", loaf.id)).toBe(true);
    const listed = await listProductsForOwner(db, "owner-a");
    expect(listed.find((each) => each.id === shown)!.photo).toBeNull();
    expect(listed.find((each) => each.id === other)!.photo).toEqual({ source: "original", photoId: rolls.id });
  });

  it("refuse more than the limit, and need a business", async () => {
    for (let i = 0; i < PRODUCT_LIMITS.products; i++) await create({ name: `Item ${i}` });
    expect(await createProductForOwner(db, "owner-a", values())).toEqual({ ok: false, reason: "too_many" });
    expect(await createProductForOwner(db, "nobody", values())).toEqual({ ok: false, reason: "no_business" });
  });
});
