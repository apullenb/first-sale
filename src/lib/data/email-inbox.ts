import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, eq, gt, like } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, customerMessages, emailInboxes } from "@/db/schema";
import type { ForwardingConfirmation } from "@/lib/email/confirmation";
import { INBOUND_PREFIX } from "./customer-messages";

// 128 random bits as 26 lowercase letters and digits: mail apps may lowercase addresses
export function newInboxToken() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  const bytes = randomBytes(17);
  let bits = 0,
    value = 0,
    token = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && token.length < 26) {
      token += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return token;
}
export const TOKEN_PATTERN = /^[a-z2-7]{26}$/;

async function business(db: Db, ownerId: string) {
  const [row] = await db
    .select({ id: businesses.id, isDemo: businesses.isDemo })
    .from(businesses)
    .where(eq(businesses.ownerId, ownerId));
  return row;
}
// Makes the address on first use; `rotate` replaces it, so the old one stops working
export async function ensureInboxForOwner(
  db: Db,
  ownerId: string,
  rotate = false,
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return null;
  const token = newInboxToken();
  const [row] = await db
    .insert(emailInboxes)
    .values({ businessId: mine.id, token })
    .onConflictDoUpdate({
      target: emailInboxes.businessId,
      set: rotate
        ? { token, confirmation: null, firstFrom: null, firstAt: null }
        : { businessId: mine.id },
    })
    .returning();
  return row.token;
}
export async function clearConfirmationForOwner(db: Db, ownerId: string) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return;
  await db
    .update(emailInboxes)
    .set({ confirmation: null })
    .where(eq(emailInboxes.businessId, mine.id));
}

// Webhook only, after its password check: the token in the address names the business
export async function inboxForToken(db: Db, token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const [row] = await db
    .select({
      id: emailInboxes.id,
      businessId: emailInboxes.businessId,
      firstAt: emailInboxes.firstAt,
      ownerId: businesses.ownerId,
      isDemo: businesses.isDemo,
    })
    .from(emailInboxes)
    .innerJoin(businesses, eq(businesses.id, emailInboxes.businessId))
    .where(eq(emailInboxes.token, token));
  return row && !row.isDemo ? row : null;
}
export async function saveConfirmationForInbox(
  db: Db,
  inboxId: string,
  confirmation: ForwardingConfirmation,
) {
  await db
    .update(emailInboxes)
    .set({ confirmation })
    .where(eq(emailInboxes.id, inboxId));
}
export async function markFirstEmailForInbox(
  db: Db,
  inboxId: string,
  from: string,
  at: Date,
) {
  await db
    .update(emailInboxes)
    .set({ firstFrom: from.slice(0, 320), firstAt: at })
    .where(eq(emailInboxes.id, inboxId));
}
export async function inboundSeenForBusiness(
  db: Db,
  businessId: string,
  sourceKey: string,
) {
  const [row] = await db
    .select({ id: customerMessages.id })
    .from(customerMessages)
    .where(
      and(
        eq(customerMessages.businessId, businessId),
        eq(customerMessages.sourceKey, sourceKey),
      ),
    );
  return !!row;
}
export async function inboundCountSince(
  db: Db,
  businessId: string,
  since: Date,
) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(customerMessages)
    .where(
      and(
        eq(customerMessages.businessId, businessId),
        like(customerMessages.sourceKey, `${INBOUND_PREFIX}%`),
        gt(customerMessages.createdAt, since),
      ),
    );
  return total;
}
