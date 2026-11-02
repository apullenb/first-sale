import { beforeEach, describe, expect, it } from "vitest";
import { orderLines, orders } from "@/db/schema";
import { pngBytes } from "@/lib/photos/test-images";
import type { ProductValues } from "@/lib/rules/products";
import { PRODUCT_LIMITS } from "@/lib/rules/products";
import { productValues } from "@/lib/products/test-values";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { addLibraryFileForOwner } from "./brand-library";
import { approvePhotoVersionForOwner, createPhotoForOwner, deletePhotoForOwner } from "./product-photos";
import {
  addPictureForOwner,
  addSuggestedItemsForOwner,
  approvePictureForOwner,
  createProductForOwner,
  deletePictureForOwner,
  deleteProductForOwner,
  deleteUnusedPicturesForOwner,
  getPictureFileForOwner,
  listPicturesForOwner,
  listPriceChecksForOwner,
  listProductsForOwner,
  savePriceCheckForOwner,
  setDescriptionForOwner,
  setWearerForOwner,
  updateProductForOwner,
} from "./products";

let db: Awaited<ReturnType<typeof createTestDb>>;
let businessA: string;

beforeEach(async () => {
  db = await createTestDb();
  ({ businessA } = await seedOwners(db));
});

const values = (overrides: Partial<ProductValues> = {}): ProductValues => productValues(overrides);

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

describe("suggested items", () => {
  it("are added once, kept out of the confirmed list, and confirmed by saving", async () => {
    await create({ name: "Loaf" });
    const ids = await addSuggestedItemsForOwner(db, "owner-a", [
      { name: "loaf", kind: "product", description: "", descriptionBy: "owner" },
      { name: "Rolls", kind: "product", description: "Soft rolls", descriptionBy: "ai" },
    ]);
    expect(ids).toHaveLength(1);
    expect((await listProductsForOwner(db, "owner-a", "confirmed")).map((each) => each.name)).toEqual(["Loaf"]);
    const all = await listProductsForOwner(db, "owner-a");
    expect(all.map((each) => [each.name, each.status, each.origin, each.descriptionBy, each.priceCents])).toEqual([
      ["Loaf", "confirmed", "owner", "owner", 950],
      ["Rolls", "suggested", "answers", "ai", null],
    ]);
    expect(await setDescriptionForOwner(db, "owner-b", ids![0], "Taken", "ai")).toBe(false);
    expect(await setDescriptionForOwner(db, "owner-a", ids![0], "Fresh rolls", "practice")).toBe(true);
    await updateProductForOwner(db, "owner-a", ids![0], values({ name: "Rolls", priceCents: 400 }));
    expect((await listProductsForOwner(db, "owner-a", "confirmed")).map((each) => each.name)).toEqual(["Loaf", "Rolls"]);
    expect(await addSuggestedItemsForOwner(db, "nobody", [])).toBeNull();
  });

  it("never hand a practice description to public uses", async () => {
    await create({ description: "Practice draft: describe it", descriptionBy: "practice" });
    expect((await listProductsForOwner(db, "owner-a", "confirmed"))[0].description).toBe("");
    expect((await listProductsForOwner(db, "owner-a"))[0].description).toBe("Practice draft: describe it");
  });

  it("keep options and service details", async () => {
    const options = { groups: [{ name: "Size", values: ["S", "L"] }], variants: [{ values: ["S"], priceCents: 800, quantity: 2 }, { values: ["L"], priceCents: null, quantity: 3 }] };
    await create({ kind: "service", name: "Groom", priceCents: null, priceText: "$65 a visit", duration: "2 hours", options });
    expect((await listProductsForOwner(db, "owner-a"))[0]).toMatchObject({ kind: "service", priceText: "$65 a visit", duration: "2 hours", options });
  });
});

describe("pictures made from a description", () => {
  const picture = (requestKey: string, view: "main" | "angle" = "main") => ({ view, sourceId: null, change: null, prompt: "p", model: "practice-preview", simulated: true, requestKey, mimeType: "image/svg+xml", data: new Uint8Array([1, 2, 3]), width: 1024, height: 1024 });

  it("belong to the owner's item, and become its photo only once approved", async () => {
    const id = await create();
    expect(await addPictureForOwner(db, "owner-b", id, picture("k0"))).toEqual({ ok: false, reason: "not_found" });
    const added = await addPictureForOwner(db, "owner-a", id, picture("k1"));
    if (!added.ok) throw new Error("setup");
    expect(await getPictureFileForOwner(db, "owner-b", added.id)).toBeNull();
    expect(await createProductForOwner(db, "owner-a", values({ name: "Other", photo: { source: "generated", pictureId: added.id } }))).toEqual({ ok: false, reason: "bad_photo" });
    expect(await approvePictureForOwner(db, "owner-b", id, added.id)).toBe(false);
    expect(await approvePictureForOwner(db, "owner-a", id, added.id)).toBe(true);
    expect((await listProductsForOwner(db, "owner-a"))[0].photo).toEqual({ source: "generated", pictureId: added.id });
    const unused = await addPictureForOwner(db, "owner-a", id, picture("k2"));
    expect(unused.ok).toBe(true);
    expect(await deleteUnusedPicturesForOwner(db, "owner-a", id)).toBe(1);
    expect(await getPictureFileForOwner(db, "owner-a", added.id)).toMatchObject({ productId: id, simulated: true });
  });

  it("keep one approved picture per view; only a main becomes the photo, and the photo can't be removed", async () => {
    const id = await create();
    const add = async (key: string, view: "main" | "angle") => {
      const made = await addPictureForOwner(db, "owner-a", id, picture(key, view));
      if (!made.ok) throw new Error("setup");
      return made.id;
    };
    const main = await add("m1", "main");
    const [first, second] = [await add("a1", "angle"), await add("a2", "angle")];
    await approvePictureForOwner(db, "owner-a", id, main);
    await approvePictureForOwner(db, "owner-a", id, first);
    await approvePictureForOwner(db, "owner-a", id, second);
    const listed = await listPicturesForOwner(db, "owner-a");
    expect(listed.filter((each) => each.approvedAt).map((each) => each.id)).toEqual([main, second]);
    expect((await listProductsForOwner(db, "owner-a"))[0].photo).toEqual({ source: "generated", pictureId: main });
    expect(await deletePictureForOwner(db, "owner-a", main)).toBe("in_use");
    expect(await deletePictureForOwner(db, "owner-b", first)).toBe("not_found");
    expect(await deletePictureForOwner(db, "owner-a", first)).toBe("deleted");
    expect(await setWearerForOwner(db, "owner-a", id, "kids")).toBe(true);
    expect((await listProductsForOwner(db, "owner-a"))[0].wearer).toBe("kids");
  });
});

describe("price checks", () => {
  it("keep the last search per item, for its owner only", async () => {
    const id = await create();
    const result = { prices: [], area: "Denver, Colorado", searchedAt: "2026-11-01T00:00:00.000Z", simulated: true };
    expect(await savePriceCheckForOwner(db, "owner-b", id, result)).toBe(false);
    expect(await savePriceCheckForOwner(db, "owner-a", id, result)).toBe(true);
    expect(await savePriceCheckForOwner(db, "owner-a", id, { ...result, area: "online" })).toBe(true);
    expect(await listPriceChecksForOwner(db, "owner-a")).toEqual([{ productId: id, result: { ...result, area: "online" } }]);
    expect(await listPriceChecksForOwner(db, "owner-b")).toEqual([]);
  });
});
