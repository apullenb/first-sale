import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, getTableColumns } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, squareConnections, squareDescriptionDrafts, squareProductLinks, products } from "@/db/schema";
import { OwnerFacingError } from "@/lib/errors";
import { squareConfig } from "@/lib/square/config";
import { decryptTokens, encryptTokens } from "@/lib/square/crypto";
import { descriptionMatches, listItems, obtainTokens, retrieveItem, squareRequest, tokenSchema, type SquareTokens } from "@/lib/square/client";
import { descriptionProblems, descriptionUpdate, originalDescription } from "@/lib/rules/square-description";
import { draftSquareDescription } from "@/lib/square/draft";
import { syncFingerprint } from "@/lib/rules/square-products";
import { getModel } from "@/lib/ai";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function business(db: Db, owner: string) {
  const [row] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, owner));
  if (!row) throw new OwnerFacingError("Tell us about your business first.");
  return row.id;
}

export async function squareStateForOwner(db: Db, owner: string) {
  const id = await business(db, owner);
  const [connection] = await db.select({ merchantId: squareConnections.merchantId, environment: squareConnections.environment }).from(squareConnections).where(eq(squareConnections.businessId, id));
  const drafts = await db.select({ id: squareDescriptionDrafts.id, name: squareDescriptionDrafts.name, description: squareDescriptionDrafts.description,
    original: squareDescriptionDrafts.original, status: squareDescriptionDrafts.status, simulated: squareDescriptionDrafts.simulated,
  }).from(squareDescriptionDrafts).where(eq(squareDescriptionDrafts.businessId, id)).orderBy(desc(squareDescriptionDrafts.createdAt)).limit(20);
  return { connection: connection?.merchantId ? connection : null, drafts: drafts.map(({ original, ...draft }) => ({ ...draft, original: originalDescription(original) })) };
}

export async function beginSquareForOwner(db: Db, owner: string) {
  const id = await business(db, owner);
  const config = squareConfig();
  const state = randomBytes(32).toString("hex");
  await db.insert(squareConnections).values({ businessId: id, environment: config.environment, generation: crypto.randomUUID(), oauthStateHash: hash(state), oauthExpiresAt: new Date(Date.now() + 10 * 60_000) })
    .onConflictDoUpdate({ target: squareConnections.businessId, set: { oauthStateHash: hash(state), oauthExpiresAt: new Date(Date.now() + 10 * 60_000) } });
  const url = new URL("/oauth2/authorize", config.baseUrl);
  url.search = new URLSearchParams({ client_id: config.applicationId, scope: "ITEMS_READ ITEMS_WRITE", state, redirect_uri: config.redirectUri, session: "false" }).toString();
  return { url: url.toString(), state };
}

export async function finishSquareForOwner(db: Db, owner: string, state: string, code: string) {
  const id = await business(db, owner);
  if (!/^[a-f0-9]{64}$/.test(state)) throw new OwnerFacingError("Square sign-in expired. Connect again.");
  await db.transaction(async (tx) => {
    const [connection] = await tx.select().from(squareConnections).where(eq(squareConnections.businessId, id)).for("update");
    if (!connection?.oauthStateHash || !connection.oauthExpiresAt || connection.oauthExpiresAt.getTime() < Date.now() || !timingSafeEqual(Buffer.from(connection.oauthStateHash), Buffer.from(hash(state)))) {
      throw new OwnerFacingError("Square sign-in expired. Connect again.");
    }
    const tokens = await obtainTokens({ code });
    await tx.update(squareConnections).set({ merchantId: tokens.merchant_id, credentials: encryptTokens(tokens, id), environment: squareConfig().environment,
      generation: crypto.randomUUID(), oauthStateHash: null, oauthExpiresAt: null, updatedAt: new Date() }).where(eq(squareConnections.businessId, id));
  });
}

export async function withSquareConnectionForOwner<T>(db: Db, owner: string, job: (tokens: SquareTokens, connection: typeof squareConnections.$inferSelect, tx: Parameters<Parameters<Db["transaction"]>[0]>[0]) => Promise<T>) {
  const id = await business(db, owner);
  return db.transaction(async (tx) => {
    const [connection] = await tx.select().from(squareConnections).where(eq(squareConnections.businessId, id)).for("update");
    if (!connection?.credentials || !connection.merchantId || connection.environment !== squareConfig().environment) throw new OwnerFacingError("Connect your Square account first.");
    let tokens = tokenSchema.parse(decryptTokens(connection.credentials, id));
    if (new Date(tokens.expires_at).getTime() < Date.now() + 24 * 60 * 60_000) {
      tokens = await obtainTokens({ refresh_token: tokens.refresh_token });
      if (tokens.merchant_id !== connection.merchantId) throw new OwnerFacingError("Reconnect your Square account.");
      await tx.update(squareConnections).set({ credentials: encryptTokens(tokens, id), updatedAt: new Date() }).where(eq(squareConnections.businessId, id));
    }
    return job(tokens, connection, tx);
  });
}

export async function listSquareItemsForOwner(db: Db, owner: string) {
  return withSquareConnectionForOwner(db, owner, (tokens) => listItems(tokens.access_token));
}

export async function draftSquareForOwner(db: Db, owner: string, itemId: string, request: string) {
  const snapshot = await withSquareConnectionForOwner(db, owner, async (tokens, connection) => ({ item: await retrieveItem(tokens.access_token, itemId), generation: connection.generation }));
  if (originalDescription(snapshot.item).length > 8000) throw new OwnerFacingError("This description is too long to rewrite here.");
  const draft = await draftSquareDescription(getModel(), snapshot.item, request, owner);
  const businessId = await business(db, owner);
  await db.insert(squareDescriptionDrafts).values({ businessId, connectionGeneration: snapshot.generation, itemId, name: snapshot.item.item_data.name, original: snapshot.item, ...draft });
}

export async function editSquareDraftForOwner(db: Db, owner: string, draftId: string, description: string, cancel: boolean) {
  const id = await business(db, owner);
  const [draft] = await db.select().from(squareDescriptionDrafts).where(and(eq(squareDescriptionDrafts.id, draftId), eq(squareDescriptionDrafts.businessId, id)));
  if (!draft || draft.status !== "pending") throw new OwnerFacingError("This draft is no longer editable.");
  const problems = cancel ? [] : descriptionProblems(description, draft.original);
  if (problems.length) throw new OwnerFacingError(problems.join(" "));
  const rows = await db.update(squareDescriptionDrafts).set(cancel ? { status: "cancelled" } : { description: description.trim() })
    .where(and(eq(squareDescriptionDrafts.id, draftId), eq(squareDescriptionDrafts.businessId, id), eq(squareDescriptionDrafts.status, "pending"))).returning();
  if (!rows.length) throw new OwnerFacingError("The draft changed. Reload and review it again.");
}

export async function approveSquareDraftForOwner(db: Db, owner: string, draftId: string, expected: string) {
  const id = await business(db, owner);
  await db.transaction(async (tx) => {
    const [draft] = await tx.select().from(squareDescriptionDrafts).where(and(eq(squareDescriptionDrafts.id, draftId), eq(squareDescriptionDrafts.businessId, id))).for("update");
    if (!draft || !["pending", "approved", "succeeded"].includes(draft.status) || draft.description !== expected) throw new OwnerFacingError("The draft changed. Review it again.");
    if (draft.simulated) throw new OwnerFacingError("Practice drafts cannot be sent to Square. Connect SnapStart’s AI service and draft again.");
    const problems = descriptionProblems(draft.description, draft.original);
    if (problems.length) throw new OwnerFacingError(problems.join(" "));
    if (draft.status === "pending") await tx.update(squareDescriptionDrafts).set({ status: "approved", approvedAt: new Date() }).where(eq(squareDescriptionDrafts.id, draft.id));
  });
  const result = await withSquareConnectionForOwner(db, owner, async (tokens, connection, tx) => {
    const [draft] = await tx.select(getTableColumns(squareDescriptionDrafts)).from(squareDescriptionDrafts)
      .where(and(eq(squareDescriptionDrafts.id, draftId), eq(squareDescriptionDrafts.businessId, id))).for("update");
    if (!draft || draft.connectionGeneration !== connection.generation) throw new OwnerFacingError("Square was reconnected. Create a new draft for the connected account.");
    if (draft.status === "succeeded") return "succeeded";
    if (draft.status !== "approved") throw new OwnerFacingError("Review and approve this draft first.");
    const current = await retrieveItem(tokens.access_token, draft.itemId);
    const body = { idempotency_key: draft.id, object: descriptionUpdate(draft.original, draft.description) };
    if (current.version !== draft.original.version && !descriptionMatches(current, draft.description)) {
      await tx.update(squareDescriptionDrafts).set({ status: "conflict" }).where(eq(squareDescriptionDrafts.id, draft.id));
      return "conflict";
    }
    if (current.version === draft.original.version) await squareRequest("/v2/catalog/object", tokens.access_token, body);
    const verified = await retrieveItem(tokens.access_token, draft.itemId);
    if (!descriptionMatches(verified, draft.description)) throw new OwnerFacingError("Square’s result could not be confirmed. Retry the saved approval to check again.");
    const [link] = await tx.select().from(squareProductLinks).where(and(eq(squareProductLinks.businessId, id), eq(squareProductLinks.remoteId, draft.itemId), eq(squareProductLinks.merchantId, connection.merchantId!), eq(squareProductLinks.environment, connection.environment)));
    if (link) {
      const [product] = await tx.select().from(products).where(and(eq(products.id, link.productId), eq(products.businessId, id))).for("update");
      if (product && syncFingerprint(product) === link.fingerprint) {
        await tx.update(products).set({ description: draft.description, descriptionBy: "ai" }).where(eq(products.id, product.id));
      }
      const fingerprint = link.fingerprint ? JSON.stringify({ ...JSON.parse(link.fingerprint), description: draft.description }) : null;
      await tx.update(squareProductLinks).set({ remote: verified, fingerprint, pushedAt: new Date() }).where(eq(squareProductLinks.productId, link.productId));
    }
    await tx.update(squareDescriptionDrafts).set({ status: "succeeded", completedAt: new Date() }).where(eq(squareDescriptionDrafts.id, draft.id));
    return "succeeded";
  });
  if (result === "conflict") throw new OwnerFacingError("This product changed in Square. Create a new draft from its latest description.");
}

export async function disconnectSquareForOwner(db: Db, owner: string) {
  const id = await business(db, owner);
  return db.transaction(async (tx) => {
    const [connection] = await tx.select().from(squareConnections).where(eq(squareConnections.businessId, id)).for("update");
    if (!connection) return true;
    let revoked = !connection.merchantId;
    try {
      const config = squareConfig();
      if (connection.merchantId && connection.environment === config.environment) {
        await squareRequest("/oauth2/revoke", config.applicationSecret, { client_id: config.applicationId, merchant_id: connection.merchantId, revoke_only_access_token: false }, true);
        revoked = true;
      }
    } catch {
      // Local credentials can be removed even when Square is unavailable.
    }
    await tx.delete(squareConnections).where(eq(squareConnections.businessId, id));
    return revoked;
  });
}
