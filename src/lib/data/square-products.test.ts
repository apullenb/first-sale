import { pngBytes } from "@/lib/photos/test-images";
import { getPhotoFileForOwner } from "./product-photos";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { getBusinessForOwner } from "./businesses";
import { createProductForOwner, listProductsForOwner } from "./products";
import { productValues } from "@/lib/products/test-values";
import { products, squareConnections, squareDescriptionDrafts } from "@/db/schema";
import { encryptTokens } from "@/lib/square/crypto";
import { productSyncForOwner, pullProductsForOwner, pushProductForOwner } from "./square-products";
import { approveSquareDraftForOwner } from "./square";
import { syncFingerprint } from "@/lib/rules/square-products";
import type { SquareItem } from "@/lib/square/client";

const candle: SquareItem = { id: "CANDLE", type: "ITEM", version: 100, item_data: { name: "Lavender candle", description_plaintext: "Handmade soy candle.", description_html: "Handmade soy candle.", variations: [{ id: "V1", type: "ITEM_VARIATION", version: 100, item_variation_data: { name: "Regular", pricing_type: "FIXED_PRICING", price_money: { amount: 1200, currency: "USD" } } }], image_ids: ["KEEP_IMAGE"] } };
type TestDb = Awaited<ReturnType<typeof createTestDb>>;
describe("Square product library sync", () => {
  let db: TestDb;
  let remote: Map<string, SquareItem>;
  let writes: { idempotency_key: string; object: SquareItem }[];
  let saved: Map<string, SquareItem>;
  beforeEach(async () => {
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    vi.stubEnv("SQUARE_APPLICATION_ID", "APP");
    vi.stubEnv("SQUARE_APPLICATION_SECRET", "SECRET");
    vi.stubEnv("SQUARE_REDIRECT_URI", "http://localhost:3000/api/square/callback");
    vi.stubEnv("SQUARE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 4).toString("base64"));
    db = await createTestDb();
    await seedOwners(db);
    const businessId = (await getBusinessForOwner(db, "owner-a"))!.id;
    await db.insert(squareConnections).values({ businessId, merchantId: "M", environment: "sandbox", generation: "G", credentials: encryptTokens({ access_token: "TOKEN", refresh_token: "REFRESH", expires_at: "2035-01-01T00:00:00Z", merchant_id: "M" }, businessId) });
    remote = new Map([[candle.id, structuredClone(candle)]]);
    writes = []; saved = new Map();
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).startsWith("https://items-images-staging.s3.us-west-2.amazonaws.com/")) return new Response(new Uint8Array(pngBytes(640, 480)));
      if (String(url).endsWith("/v2/catalog/object/KEEP_IMAGE")) return Response.json({ object: { type: "IMAGE", image_data: { url: "https://items-images-staging.s3.us-west-2.amazonaws.com/candle.png" } } });
      if (url.includes("/v2/catalog/list")) return Response.json({ objects: [...remote.values()] });
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (saved.has(body.idempotency_key)) return Response.json({ catalog_object: saved.get(body.idempotency_key) });
        writes.push(body);
        const item = structuredClone(body.object) as SquareItem;
        item.id = item.id.startsWith("#") ? `NEW-${writes.length}` : item.id;
        item.version = (item.version || 0) + 1;
        item.item_data.description_plaintext = item.item_data.description_html;
        remote.set(item.id, item); saved.set(body.idempotency_key, item);
        return Response.json({ catalog_object: item });
      }
      return Response.json({ object: remote.get(decodeURIComponent(url.split("/").at(-1)!)) });
    }));
  });
  afterEach(async () => { await db.$client.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("imports Square photos into the owner library and keeps the selected photo on refresh", async () => {
    await pullProductsForOwner(db, "owner-a");
    const [product] = await listProductsForOwner(db, "owner-a");
    expect(product.photo?.source).toBe("original");
    if (product.photo?.source !== "original") throw new Error("Missing imported photo");
    expect(await getPhotoFileForOwner(db, "owner-a", product.photo.photoId)).not.toBeNull();
    expect(await getPhotoFileForOwner(db, "owner-b", product.photo.photoId)).toBeNull();
    await pullProductsForOwner(db, "owner-a");
    expect((await listProductsForOwner(db, "owner-a"))[0].photo).toEqual(product.photo);
  });
  async function imported() {
    await pullProductsForOwner(db, "owner-a");
    return (await listProductsForOwner(db, "owner-a"))[0];
  }
  it("imports into the library, records origin/date and avoids duplicates on repeated imports", async () => {
    expect(await pullProductsForOwner(db, "owner-a")).toMatchObject({ imported: 1, refreshed: 0 });
    const [product] = await listProductsForOwner(db, "owner-a");
    expect(product).toMatchObject({ name: "Lavender candle", priceCents: 1200, quantity: null });
    const sync = (await productSyncForOwner(db, "owner-a")).products[product.id];
    expect(sync).toMatchObject({ origin: "imported", linked: true, dirty: false, pushedAt: null });
    expect(sync.importedAt).toBeTruthy();
    expect(await pullProductsForOwner(db, "owner-a")).toMatchObject({ imported: 0, refreshed: 1 });
    expect(await listProductsForOwner(db, "owner-a")).toHaveLength(1);
    expect(writes).toHaveLength(0);
  });
  it("keeps edits local, skips them during bulk import, then pushes and records last-pushed date", async () => {
    const product = await imported();
    await db.update(products).set({ description: "Handmade lavender soy candle.", priceCents: 1500 }).where(eq(products.id, product.id));
    expect((await productSyncForOwner(db, "owner-a")).products[product.id].dirty).toBe(true);
    expect((await pullProductsForOwner(db, "owner-a")).skipped[0]).toContain("local changes kept");
    expect(writes).toHaveLength(0);
    const current = (await listProductsForOwner(db, "owner-a"))[0];
    await pushProductForOwner(db, "owner-a", product.id, syncFingerprint(current));
    const sync = (await productSyncForOwner(db, "owner-a")).products[product.id];
    expect(sync).toMatchObject({ dirty: false, pending: false, origin: "imported" });
    expect(sync.pushedAt).toBeTruthy();
    expect(remote.get("CANDLE")!.item_data.image_ids).toEqual(["KEEP_IMAGE"]);
    expect(writes[0].object.item_data.variations).toMatchObject([{ id: "V1", item_variation_data: { price_money: { amount: 1500 } } }]);
    await db.update(products).set({ name: "Soy candle" }).where(eq(products.id, product.id));
    expect((await productSyncForOwner(db, "owner-a")).products[product.id].dirty).toBe(true);
  });
  it("publishes a local-only item once and tracks original publication and subsequent pushes", async () => {
    const created = await createProductForOwner(db, "owner-a", productValues({ name: "Cedar candle", description: "Soy candle", quantity: 7, unitCostCents: 200 }));
    if (!created.ok) throw new Error("create failed");
    const local = (await listProductsForOwner(db, "owner-a"))[0];
    expect((await productSyncForOwner(db, "owner-a")).products[local.id]).toBeUndefined();
    await pushProductForOwner(db, "owner-a", local.id, syncFingerprint(local));
    const sync = (await productSyncForOwner(db, "owner-a")).products[local.id];
    expect(sync).toMatchObject({ origin: "published", linked: true, dirty: false });
    expect(sync.publishedAt).toBeTruthy();
    expect(sync.pushedAt).toBe(sync.publishedAt);
    expect(writes[0].object).not.toHaveProperty("version");
    expect(JSON.stringify(writes[0])).not.toContain("unitCost");
    await pushProductForOwner(db, "owner-a", local.id, syncFingerprint(local));
    expect(writes).toHaveLength(1);
    await db.update(products).set({ description: "Cedar soy candle" }).where(eq(products.id, local.id));
    const updated = (await listProductsForOwner(db, "owner-a"))[0];
    await pushProductForOwner(db, "owner-a", local.id, syncFingerprint(updated));
    expect(writes).toHaveLength(2);
    expect((await productSyncForOwner(db, "owner-a")).products[local.id].publishedAt).toBe(sync.publishedAt);
  });
  it("requires current approval and prevents cross-owner publishing", async () => {
    const product = await imported();
    await expect(pushProductForOwner(db, "owner-a", product.id, "tampered")).rejects.toThrow("changed");
    await expect(pushProductForOwner(db, "owner-b", product.id, syncFingerprint(product))).rejects.toThrow();
    expect((await productSyncForOwner(db, "owner-b")).products).toEqual({});
    expect(writes).toHaveLength(0);
  });
  it("blocks remote conflicts and supports an explicitly approved pull replacing local changes", async () => {
    const product = await imported();
    await db.update(products).set({ description: "Local candle" }).where(eq(products.id, product.id));
    remote.get("CANDLE")!.version = 500;
    remote.get("CANDLE")!.item_data.description_plaintext = "Square candle";
    const current = (await listProductsForOwner(db, "owner-a"))[0];
    await expect(pushProductForOwner(db, "owner-a", product.id, syncFingerprint(current))).rejects.toThrow("changed in Square");
    expect(writes).toHaveLength(0);
    await pullProductsForOwner(db, "owner-a", product.id, syncFingerprint(current));
    expect((await listProductsForOwner(db, "owner-a"))[0].description).toBe("Square candle");
    expect((await productSyncForOwner(db, "owner-a")).products[product.id].dirty).toBe(false);
  });
  it("recovers a create whose response was lost without creating duplicates", async () => {
    await createProductForOwner(db, "owner-a", productValues());
    const product = (await listProductsForOwner(db, "owner-a"))[0];
    const normal = vi.mocked(fetch).getMockImplementation()!;
    let fail = true;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const response = await normal(url, init);
      if (init?.method === "POST" && fail) { fail = false; throw new Error("lost response"); }
      return response;
    });
    await expect(pushProductForOwner(db, "owner-a", product.id, syncFingerprint(product))).rejects.toThrow();
    expect((await productSyncForOwner(db, "owner-a")).products[product.id].pending).toBe(true);
    await pushProductForOwner(db, "owner-a", product.id, syncFingerprint(product));
    expect(writes).toHaveLength(1);
    expect((await productSyncForOwner(db, "owner-a")).products[product.id]).toMatchObject({ pending: false, dirty: false, linked: true });
  });
  it("updates a clean linked library product when a reviewed description is sent to Square", async () => {
    const product = await imported();
    const businessId = (await getBusinessForOwner(db, "owner-a"))!.id;
    const [draft] = await db.insert(squareDescriptionDrafts).values({ businessId, connectionGeneration: "G", itemId: "CANDLE", name: "Lavender candle", original: candle, description: "Handmade lavender soy candle.", simulated: false }).returning();
    await approveSquareDraftForOwner(db, "owner-a", draft.id, draft.description);
    expect((await listProductsForOwner(db, "owner-a"))[0]).toMatchObject({ description: draft.description, descriptionBy: "ai" });
    expect((await productSyncForOwner(db, "owner-a")).products[product.id]).toMatchObject({ dirty: false, linked: true });
  });
  it("keeps unsupported imports visible in the report instead of silently truncating", async () => {
    remote.get("CANDLE")!.item_data.description_plaintext = "long ".repeat(100);
    const report = await pullProductsForOwner(db, "owner-a");
    expect(report.skipped[0]).toContain("size limits");
    expect(await listProductsForOwner(db, "owner-a")).toHaveLength(0);
  });
  it("preserves local-only costs and stock during refresh", async () => {
    const product = await imported();
    await db.update(products).set({ quantity: 17, unitCostCents: 300 }).where(eq(products.id, product.id));
    await pullProductsForOwner(db, "owner-a");
    expect((await listProductsForOwner(db, "owner-a"))[0]).toMatchObject({ quantity: 17, unitCostCents: 300 });
  });
  it("does not discard tracked option stock when Square’s option structure changes", async () => {
    const item = remote.get("CANDLE")!;
    const first = (item.item_data.variations as { id: string; item_variation_data: { name: string } }[])[0];
    first.item_variation_data.name = "Small";
    const second = structuredClone(first);
    second.id = "V2"; second.item_variation_data.name = "Large";
    (item.item_data.variations as unknown[]).push(second);
    const product = await imported();
    const options = structuredClone(product.options);
    options.variants[1].quantity = 7;
    await db.update(products).set({ options }).where(eq(products.id, product.id));
    (item.item_data.variations as unknown[]).pop();
    const report = await pullProductsForOwner(db, "owner-a");
    expect(report.skipped[0]).toContain("tracked stock");
    expect((await listProductsForOwner(db, "owner-a"))[0].options.variants[1].quantity).toBe(7);
  });
  it("blocks simulated descriptions and publishing through a different account", async () => {
    const product = await imported();
    await db.update(products).set({ descriptionBy: "practice", description: "Practice" }).where(eq(products.id, product.id));
    let current = (await listProductsForOwner(db, "owner-a"))[0];
    await expect(pushProductForOwner(db, "owner-a", product.id, syncFingerprint(current))).rejects.toThrow("practice");
    await db.update(products).set({ descriptionBy: "owner" }).where(eq(products.id, product.id));
    current = (await listProductsForOwner(db, "owner-a"))[0];
    await db.update(squareConnections).set({ merchantId: "OTHER" });
    await expect(pushProductForOwner(db, "owner-a", product.id, syncFingerprint(current))).rejects.toThrow("matching");
    expect(writes).toHaveLength(0);
  });
});
