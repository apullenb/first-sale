import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import { seedOwners } from "@/test/fixtures";
import { getBusinessForOwner } from "./businesses";
import { squareConnections, squareDescriptionDrafts } from "@/db/schema";
import { encryptTokens, decryptTokens } from "@/lib/square/crypto";
import { approveSquareDraftForOwner, beginSquareForOwner, editSquareDraftForOwner, finishSquareForOwner, squareStateForOwner, draftSquareForOwner, disconnectSquareForOwner, connectSandboxTokenForOwner, listSquareItemsForOwner } from "./square";
import * as ai from "@/lib/ai";
import { createMockProvider } from "@/lib/ai/providers/mock";
import type { SquareItem } from "@/lib/square/client";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;
const original: SquareItem = { id: "CANDLE", type: "ITEM", version: 100, item_data: { name: "Lavender candle", description_plaintext: "Handmade soy candle with lavender.", description_html: "Handmade soy candle with lavender.", variations: [{ id: "V", type: "ITEM_VARIATION", version: 100, item_variation_data: { name: "Regular", price_money: { amount: 1200, currency: "USD" } } }], image_ids: ["IMAGE"] } };
const tokens = { access_token: "secret-access", refresh_token: "secret-refresh", merchant_id: "M", expires_at: "2035-01-01T00:00:00Z" };

describe("Square reviewed updates", () => {
  let db: TestDb;
  let businessId: string;
  let draftId: string;
  let remote: SquareItem;
  let writes: unknown[];
  beforeEach(async () => {
    vi.stubEnv("SQUARE_ENVIRONMENT", "sandbox");
    vi.stubEnv("SQUARE_APPLICATION_ID", "APP");
    vi.stubEnv("SQUARE_APPLICATION_SECRET", "APP_SECRET");
    vi.stubEnv("SQUARE_REDIRECT_URI", "http://localhost:3000/api/square/callback");
    vi.stubEnv("SQUARE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 3).toString("base64"));
    db = await createTestDb();
    await seedOwners(db);
    businessId = (await getBusinessForOwner(db, "owner-a"))!.id;
    await db.insert(squareConnections).values({ businessId, environment: "sandbox", generation: "G", merchantId: "M", credentials: encryptTokens(tokens, businessId) });
    const [draft] = await db.insert(squareDescriptionDrafts).values({ businessId, connectionGeneration: "G", itemId: "CANDLE", name: "Lavender candle", original, description: "Discover our handmade lavender soy candle.", simulated: false }).returning();
    draftId = draft.id;
    remote = structuredClone(original);
    writes = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/oauth2/token")) return Response.json(tokens);
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        writes.push(body);
        remote = { ...body.object, version: 101 };
        return Response.json({ catalog_object: remote });
      }
      return Response.json({ object: remote });
    }));
  });
  afterEach(async () => { await db.$client.close(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const proposal = "Discover our handmade lavender soy candle.";

  it("drafts through the AI wrapper, saves for review, then publishes only on approval", async () => {
    const model = { ...createMockProvider(() => JSON.stringify({ description: proposal })), simulated: false };
    vi.spyOn(ai, "getModel").mockReturnValue(model);
    await draftSquareForOwner(db, "owner-a", "CANDLE", "Make it warmer");
    const drafts = (await squareStateForOwner(db, "owner-a")).drafts;
    const draft = drafts.find((row) => row.id !== draftId)!;
    expect(draft).toMatchObject({ status: "pending", description: proposal, simulated: false });
    expect(writes).toHaveLength(0);
    await editSquareDraftForOwner(db, "owner-a", draft.id, "Our handmade lavender soy candle.", false);
    await expect(approveSquareDraftForOwner(db, "owner-a", draft.id, proposal)).rejects.toThrow("changed");
    await approveSquareDraftForOwner(db, "owner-a", draft.id, "Our handmade lavender soy candle.");
    expect(writes).toHaveLength(1);
  });
  it("keeps another owner from reading, approving or editing the draft", async () => {
    expect((await squareStateForOwner(db, "owner-b")).drafts).toEqual([]);
    await expect(approveSquareDraftForOwner(db, "owner-b", draftId, proposal)).rejects.toThrow();
    await expect(editSquareDraftForOwner(db, "owner-b", draftId, "Candle", false)).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });
  it("requires exact approved text, then preserves fields and verifies the update", async () => {
    await expect(approveSquareDraftForOwner(db, "owner-a", draftId, "Changed in the browser")).rejects.toThrow();
    expect(writes).toHaveLength(0);
    await approveSquareDraftForOwner(db, "owner-a", draftId, proposal);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ idempotency_key: draftId, object: { version: 100, item_data: { variations: original.item_data.variations, image_ids: ["IMAGE"], description_html: proposal } } });
    expect((await squareStateForOwner(db, "owner-a")).drafts[0].status).toBe("succeeded");
    await approveSquareDraftForOwner(db, "owner-a", draftId, proposal);
    expect(writes).toHaveLength(1);
  });
  it("accepts Square’s equivalent HTML formatting when verifying approved plain text", async () => {
    const normal = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const response = await normal(url, init);
      if (init?.method === "POST") remote.item_data.description_html = `<p>${remote.item_data.description_html}</p>`;
      return response;
    });
    await approveSquareDraftForOwner(db, "owner-a", draftId, proposal);
    expect((await squareStateForOwner(db, "owner-a")).drafts[0].status).toBe("succeeded");
  });
  it("stops stale reviews without sending a catalog write", async () => {
    remote.version = 200;
    await expect(approveSquareDraftForOwner(db, "owner-a", draftId, proposal)).rejects.toThrow("changed in Square");
    expect(writes).toHaveLength(0);
    expect((await squareStateForOwner(db, "owner-a")).drafts[0].status).toBe("conflict");
  });
  it("cannot send a practice draft or a draft for a reconnected account", async () => {
    await db.update(squareDescriptionDrafts).set({ simulated: true }).where(eq(squareDescriptionDrafts.id, draftId));
    await expect(approveSquareDraftForOwner(db, "owner-a", draftId, proposal)).rejects.toThrow("Practice");
    await db.update(squareDescriptionDrafts).set({ simulated: false }).where(eq(squareDescriptionDrafts.id, draftId));
    await db.update(squareConnections).set({ generation: "NEW" }).where(eq(squareConnections.businessId, businessId));
    await expect(approveSquareDraftForOwner(db, "owner-a", draftId, proposal)).rejects.toThrow("reconnected");
    expect(writes).toHaveLength(0);
  });
  it("keeps a durable approval after an ambiguous failure and retries safely", async () => {
    const fetchMock = vi.mocked(fetch);
    const normal = fetchMock.getMockImplementation()!;
    let failed = false;
    fetchMock.mockImplementation(async (url, init) => {
      const response = await normal(url, init);
      if (init?.method === "POST" && !failed) { failed = true; throw new Error("response lost"); }
      return response;
    });
    await expect(approveSquareDraftForOwner(db, "owner-a", draftId, proposal)).rejects.toThrow();
    expect((await squareStateForOwner(db, "owner-a")).drafts[0].status).toBe("approved");
    await approveSquareDraftForOwner(db, "owner-a", draftId, proposal);
    expect(writes).toHaveLength(1);
    expect((await squareStateForOwner(db, "owner-a")).drafts[0].status).toBe("succeeded");
  });
  it("removes credentials even when a revoked or unavailable account cannot confirm revocation", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    expect(await disconnectSquareForOwner(db, "owner-a")).toBe(false);
    expect((await squareStateForOwner(db, "owner-a")).connection).toBeNull();
    await expect(approveSquareDraftForOwner(db, "owner-a", draftId, proposal)).rejects.toThrow("Connect");
  });
  it("connects a provided sandbox token only in local development and keeps it owner-scoped", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SQUARE_SANDBOX_ACCESS_TOKEN", "local-sandbox-token");
    await expect(connectSandboxTokenForOwner(db, "owner-a")).rejects.toThrow("local development");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SQUARE_APPLICATION_SECRET", "");
    vi.mocked(fetch).mockResolvedValue(Response.json({ merchant: { id: "M" } }));
    await connectSandboxTokenForOwner(db, "owner-a");
    expect((await squareStateForOwner(db, "owner-a")).connection).toMatchObject({ merchantId: "M", environment: "sandbox", sandboxTokenTest: true });
    expect((await squareStateForOwner(db, "owner-b")).connection).toBeNull();
    expect(JSON.stringify(await squareStateForOwner(db, "owner-a"))).not.toContain("local-sandbox-token");
    vi.stubEnv("NODE_ENV", "production");
    await expect(listSquareItemsForOwner(db, "owner-a")).rejects.toThrow("local development");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SQUARE_ENVIRONMENT", "production");
    await expect(connectSandboxTokenForOwner(db, "owner-a")).rejects.toThrow("local development");
  });
  it("binds encrypted tokens to the business and never exposes them in page data", async () => {
    const encrypted = encryptTokens(tokens, businessId);
    expect(encrypted).not.toContain(tokens.access_token);
    expect(decryptTokens(encrypted, businessId)).toEqual(tokens);
    expect(() => decryptTokens(encrypted, "other-business")).toThrow();
    expect(JSON.stringify(await squareStateForOwner(db, "owner-a"))).not.toContain("secret-access");
  });
  it("requires an unexpired, single-use authorization state belonging to the owner", async () => {
    const started = await beginSquareForOwner(db, "owner-a");
    expect(new URL(started.url).searchParams.get("scope")).toBe("ITEMS_READ ITEMS_WRITE");
    await expect(finishSquareForOwner(db, "owner-b", started.state, "code")).rejects.toThrow();
    await expect(finishSquareForOwner(db, "owner-a", "f".repeat(64), "code")).rejects.toThrow();
    await finishSquareForOwner(db, "owner-a", started.state, "code");
    await expect(finishSquareForOwner(db, "owner-a", started.state, "code")).rejects.toThrow();
  });
  it("cancels drafts and rejects edits with unsupported claims", async () => {
    await expect(editSquareDraftForOwner(db, "owner-a", draftId, "Organic candle", false)).rejects.toThrow();
    await editSquareDraftForOwner(db, "owner-a", draftId, "", true);
    await expect(approveSquareDraftForOwner(db, "owner-a", draftId, proposal)).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });
});
