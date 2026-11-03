import "server-only";
import { and, asc, count, desc, eq, inArray, like, lt, ne, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  businesses,
  customerMessages,
  emailInboxes,
  orders,
  orderEvents,
} from "@/db/schema";
import { draftCustomerReply } from "@/lib/rules/customer-reply";
import type { ExtractedRequest } from "@/lib/orders/extract";

// Emails that reached the forwarding address; pasted ones start with "paste:"
export const INBOUND_PREFIX = "inbound:";

async function business(db: Db, ownerId: string) {
  const [row] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, ownerId));
  return row;
}
export async function emailStateForOwner(db: Db, ownerId: string) {
  const mine = await business(db, ownerId);
  if (!mine) return { inbox: null, messages: [], waiting: 0 };
  const [inbox] = await db
    .select({
      token: emailInboxes.token,
      confirmation: emailInboxes.confirmation,
      firstFrom: emailInboxes.firstFrom,
      firstAt: emailInboxes.firstAt,
    })
    .from(emailInboxes)
    .where(eq(emailInboxes.businessId, mine.id));
  const messages = await db
    .select()
    .from(customerMessages)
    .where(eq(customerMessages.businessId, mine.id))
    .orderBy(desc(customerMessages.createdAt))
    .limit(200);
  const [{ waiting }] = await db
    .select({ waiting: count() })
    .from(customerMessages)
    .where(
      and(
        eq(customerMessages.businessId, mine.id),
        like(customerMessages.sourceKey, `${INBOUND_PREFIX}%`),
        eq(customerMessages.state, "pending"),
      ),
    );
  return { inbox: inbox ?? null, messages, waiting };
}
export async function messageForOwner(db: Db, ownerId: string, id: string) {
  const mine = await business(db, ownerId);
  if (!mine) return null;
  const [row] = await db
    .select()
    .from(customerMessages)
    .where(
      and(
        eq(customerMessages.id, id),
        eq(customerMessages.businessId, mine.id),
      ),
    );
  return row ?? null;
}
export interface NewCustomerMessage {
  sourceKey: string;
  source: "email" | "invoice";
  sender?: string;
  senderName?: string;
  forwardedBy?: string | null;
  receivedAt?: Date | null;
  subject: string;
  body?: string;
  documentId?: string;
  attachmentIds?: string[];
  threadId?: string;
}
export async function addMessageForOwner(
  db: Db,
  ownerId: string,
  input: NewCustomerMessage,
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return null;
  const { getDocumentForOwner } = await import("./documents");
  for (const documentId of [
    ...(input.documentId ? [input.documentId] : []),
    ...(input.attachmentIds ?? []),
  ])
    if (!(await getDocumentForOwner(db, ownerId, documentId))) return null;
  const [row] = await db
    .insert(customerMessages)
    .values({ ...input, businessId: mine.id })
    .onConflictDoNothing()
    .returning();
  if (row) return row.id;
  const [prior] = await db
    .select({ id: customerMessages.id })
    .from(customerMessages)
    .where(
      and(
        eq(customerMessages.businessId, mine.id),
        eq(customerMessages.sourceKey, input.sourceKey),
      ),
    );
  return prior?.id ?? null;
}
// A reading cut off by the server's time limit can be claimed again after this
const STALE_MS = 10 * 60_000;

export async function claimMessageForOwner(
  db: Db,
  ownerId: string,
  id: string,
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return null;
  const now = new Date();
  const [row] = await db
    .update(customerMessages)
    .set({ state: "processing", updatedAt: now })
    .where(
      and(
        eq(customerMessages.id, id),
        eq(customerMessages.businessId, mine.id),
        or(
          inArray(customerMessages.state, ["pending", "failed"]),
          and(
            eq(customerMessages.state, "processing"),
            lt(customerMessages.updatedAt, new Date(now.getTime() - STALE_MS)),
          ),
        ),
      ),
    )
    .returning();
  return row ?? null;
}
// Forwarded emails waiting to be read, oldest first
export async function pendingEmailForOwner(
  db: Db,
  ownerId: string,
  limit: number,
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return [];
  const rows = await db
    .select({ id: customerMessages.id })
    .from(customerMessages)
    .where(
      and(
        eq(customerMessages.businessId, mine.id),
        like(customerMessages.sourceKey, `${INBOUND_PREFIX}%`),
        eq(customerMessages.state, "pending"),
      ),
    )
    .orderBy(asc(customerMessages.createdAt))
    .limit(limit);
  return rows.map((row) => row.id);
}
// The owner's record that they sent this reply from their own email
export async function markReplySentForOwner(
  db: Db,
  ownerId: string,
  id: string,
  reply: string,
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return false;
  const rows = await db
    .update(customerMessages)
    .set({ reply, sendState: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(customerMessages.id, id),
        eq(customerMessages.businessId, mine.id),
        eq(customerMessages.state, "ready"),
        eq(customerMessages.sendState, "draft"),
      ),
    )
    .returning();
  return !!rows.length;
}
export async function completeMessageForOwner(
  db: Db,
  ownerId: string,
  id: string,
  extraction: ExtractedRequest,
  simulated: boolean,
  body: string,
  claimedAt: Date,
) {
  return db.transaction(async (tx) => {
    const [mine] = await tx
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, ownerId))
      .for("update");
    if (!mine || mine.isDemo) return null;
    const [message] = await tx
      .select()
      .from(customerMessages)
      .where(
        and(
          eq(customerMessages.id, id),
          eq(customerMessages.businessId, mine.id),
        ),
      )
      .for("update");
    if (
      !message ||
      message.state !== "processing" ||
      message.updatedAt.getTime() !== claimedAt.getTime()
    )
      return null;
    let orderId = message.orderId;
    const [linked] = message.threadId
      ? await tx
          .select({ orderId: customerMessages.orderId })
          .from(customerMessages)
          .where(
            and(
              eq(customerMessages.businessId, mine.id),
              eq(customerMessages.threadId, message.threadId),
              sql`${customerMessages.orderId} is not null`,
            ),
          )
          .orderBy(asc(customerMessages.createdAt))
          .limit(1)
      : [];
    orderId ??= linked?.orderId ?? null;
    if (
      !orderId &&
      extraction.reference &&
      (extraction.customerEmail || message.sender)
    ) {
      const matches = await tx
        .select({ orderId: customerMessages.orderId })
        .from(customerMessages)
        .where(
          and(
            eq(customerMessages.businessId, mine.id),
            sql`${customerMessages.orderId} is not null`,
            sql`lower(${customerMessages.extraction}->>'reference') = ${extraction.reference.toLowerCase()}`,
            sql`lower(coalesce(nullif(${customerMessages.extraction}->>'customerEmail', ''), ${customerMessages.sender})) = ${(extraction.customerEmail || message.sender).toLowerCase()}`,
          ),
        )
        .limit(2);
      if (matches.length === 1) orderId = matches[0].orderId;
    }
    if (!orderId && ["order", "job", "update"].includes(extraction.category)) {
      const [made] = await tx
        .insert(orders)
        .values({
          businessId: mine.id,
          customerName: extraction.customerName || "Customer to confirm",
          customerEmail: extraction.customerEmail || message.sender,
          title: extraction.title || message.subject.slice(0, 160),
          workType:
            extraction.category === "job" ||
            (mine.profile.offeringKinds.length > 0 &&
              mine.profile.offeringKinds.every((kind) => kind === "services"))
              ? "services"
              : mine.profile.offeringKinds.includes("handmade") ||
                  mine.profile.offeringKinds.includes("food")
                ? "made_to_order"
                : "products",
          requestedDate: extraction.requestedDate || null,
          jobTime: extraction.jobTime,
          location: extraction.location,
          fulfillment: "pickup",
          source: message.source,
          status: "needs_review",
          isDemo: simulated,
          notes: extraction.items
            .map((item) => `${item.quantity} × ${item.name}`)
            .join("\n"),
          requestKey: `intake:${id}`,
        })
        .returning();
      orderId = made.id;
      await tx.insert(orderEvents).values({
        orderId,
        actor: "ai",
        summary: `${simulated ? "DEMO · " : ""}Imported for review; stock and payments unchanged`,
      });
    } else if (orderId) {
      await tx.insert(orderEvents).values({
        orderId,
        actor: "ai",
        summary: "A new customer message needs review; order unchanged",
      });
    }
    const reply = draftCustomerReply(extraction);
    await tx
      .update(customerMessages)
      .set({
        extraction,
        simulated,
        body: body.slice(0, 30_000),
        orderId,
        reply,
        state: "ready",
        issue: null,
        updatedAt: new Date(),
      })
      .where(eq(customerMessages.id, id));
    return orderId;
  });
}
export async function failMessageForOwner(
  db: Db,
  ownerId: string,
  id: string,
  claimedAt: Date,
) {
  const mine = await business(db, ownerId);
  if (!mine) return;
  await db
    .update(customerMessages)
    .set({
      state: "failed",
      issue:
        "Could not read this request. Retry or enter the details manually.",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customerMessages.id, id),
        eq(customerMessages.businessId, mine.id),
        eq(customerMessages.state, "processing"),
        eq(customerMessages.updatedAt, claimedAt),
      ),
    );
}
export async function retryMessageForOwner(
  db: Db,
  ownerId: string,
  id: string,
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return false;
  const rows = await db
    .update(customerMessages)
    .set({ state: "pending", issue: null })
    .where(
      and(
        eq(customerMessages.businessId, mine.id),
        eq(customerMessages.id, id),
        eq(customerMessages.state, "failed"),
        // An email with no saved text has nothing to read again
        or(
          ne(customerMessages.source, "email"),
          ne(customerMessages.body, ""),
        ),
      ),
    )
    .returning();
  return !!rows.length;
}
export async function dismissMessageForOwner(
  db: Db,
  ownerId: string,
  id: string,
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return false;
  const rows = await db
    .update(customerMessages)
    .set({ state: "dismissed", updatedAt: new Date() })
    .where(
      and(
        eq(customerMessages.id, id),
        eq(customerMessages.businessId, mine.id),
        eq(customerMessages.state, "ready"),
      ),
    )
    .returning();
  return !!rows.length;
}
