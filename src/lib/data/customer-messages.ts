import "server-only";
import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  businesses,
  customerMessages,
  emailConnections,
  orders,
  orderEvents,
} from "@/db/schema";
import { draftCustomerReply } from "@/lib/rules/customer-reply";
import type { ExtractedRequest } from "@/lib/orders/extract";

async function business(db: Db, ownerId: string) {
  const [row] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, ownerId));
  return row;
}
export async function emailStateForOwner(db: Db, ownerId: string) {
  const mine = await business(db, ownerId);
  if (!mine) return { connection: null, messages: [] };
  const [connection] = await db
    .select({
      email: emailConnections.email,
      reminderDays: emailConnections.reminderDays,
      paused: emailConnections.paused,
      status: emailConnections.status,
    })
    .from(emailConnections)
    .where(eq(emailConnections.businessId, mine.id));
  const messages = await db
    .select()
    .from(customerMessages)
    .where(eq(customerMessages.businessId, mine.id))
    .orderBy(desc(customerMessages.createdAt))
    .limit(200);
  return { connection: connection ?? null, messages };
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
export async function addMessageForOwner(
  db: Db,
  ownerId: string,
  input: {
    sourceKey: string;
    source: "email" | "invoice";
    sender?: string;
    subject: string;
    body?: string;
    documentId?: string;
    connectionId?: string;
    providerMessageId?: string;
    threadId?: string;
  },
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return null;
  if (input.connectionId) {
    const [linked] = await db
      .select({ id: emailConnections.id })
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.id, input.connectionId),
          eq(emailConnections.businessId, mine.id),
        ),
      );
    if (!linked) return null;
  }
  if (input.documentId) {
    const { getDocumentForOwner } = await import("./documents");
    if (!(await getDocumentForOwner(db, ownerId, input.documentId)))
      return null;
  }
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
export async function connectEmailForOwner(
  db: Db,
  ownerId: string,
  grantId: string,
  email: string,
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return false;
  const previous = await connectionForOwner(db, ownerId);
  if (previous && previous.grantId !== grantId) {
    await db
      .update(customerMessages)
      .set({
        state: "failed",
        attempts: 5,
        issue:
          "This message belongs to a disconnected inbox. Paste it again to review it.",
        connectionId: null,
      })
      .where(
        and(
          eq(customerMessages.connectionId, previous.id),
          inArray(customerMessages.state, ["pending", "processing", "failed"]),
        ),
      );
    await db
      .delete(emailConnections)
      .where(eq(emailConnections.id, previous.id));
  }
  await db
    .insert(emailConnections)
    .values({ businessId: mine.id, grantId, email })
    .onConflictDoUpdate({
      target: emailConnections.businessId,
      set: {
        grantId,
        email,
        status: "connected",
        paused: false,
      },
    });
  return true;
}
export async function changeEmailForOwner(
  db: Db,
  ownerId: string,
  paused: boolean,
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return false;
  const rows = await db
    .update(emailConnections)
    .set({ paused })
    .where(eq(emailConnections.businessId, mine.id))
    .returning();
  return !!rows.length;
}
export async function connectionForOwner(db: Db, ownerId: string) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return null;
  const [row] = await db
    .select()
    .from(emailConnections)
    .where(eq(emailConnections.businessId, mine.id));
  return row ?? null;
}
export async function removeEmailForOwner(db: Db, ownerId: string) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return;
  await db
    .update(customerMessages)
    .set({
      state: "failed",
      attempts: 5,
      issue: "Email disconnected. Paste this message again to review it.",
    })
    .where(
      and(
        eq(customerMessages.businessId, mine.id),
        sql`${customerMessages.connectionId} is not null`,
        inArray(customerMessages.state, ["pending", "processing", "failed"]),
      ),
    );
  await db
    .delete(emailConnections)
    .where(eq(emailConnections.businessId, mine.id));
}

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
    .set({
      state: "processing",
      attempts: sql`${customerMessages.attempts} + 1`,
      leaseUntil: new Date(now.getTime() + 6 * 60_000),
      updatedAt: now,
    })
    .where(
      and(
        eq(customerMessages.id, id),
        eq(customerMessages.businessId, mine.id),
        lt(customerMessages.attempts, 5),
        or(
          eq(customerMessages.state, "pending"),
          and(
            inArray(customerMessages.state, ["failed", "processing"]),
            lt(customerMessages.leaseUntil, now),
          ),
        ),
      ),
    )
    .returning();
  return row ?? null;
}
export async function completeMessageForOwner(
  db: Db,
  ownerId: string,
  id: string,
  extraction: ExtractedRequest,
  simulated: boolean,
  body: string,
  attempt = 1,
  lease?: Date,
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
      message.attempts !== attempt ||
      (lease && message.leaseUntil?.getTime() !== lease.getTime())
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
              message.connectionId
                ? eq(customerMessages.connectionId, message.connectionId)
                : sql`false`,
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
            mine.profile.offeringKinds.every((kind) => kind === "services")
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
        leaseUntil: null,
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
  attempt = 1,
  lease?: Date,
) {
  const mine = await business(db, ownerId);
  if (!mine) return;
  await db
    .update(customerMessages)
    .set({
      state: "failed",
      issue:
        "Could not read this request. Retry or enter the details manually.",
      leaseUntil: new Date(Date.now() + 5 * 60_000),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customerMessages.id, id),
        eq(customerMessages.businessId, mine.id),
        eq(customerMessages.state, "processing"),
        eq(customerMessages.attempts, attempt),
        lease ? eq(customerMessages.leaseUntil, lease) : undefined,
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
    .set({ state: "pending", attempts: 0, leaseUntil: null, issue: null })
    .where(
      and(
        eq(customerMessages.businessId, mine.id),
        eq(customerMessages.id, id),
        eq(customerMessages.state, "failed"),
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
export async function reserveReplyForOwner(
  db: Db,
  ownerId: string,
  id: string,
  reply: string,
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return null;
  return db.transaction(async (tx) => {
    await tx
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.id, mine.id))
      .for("update");
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
      message.simulated ||
      message.source !== "email" ||
      message.state !== "ready" ||
      message.sendState !== "draft" ||
      !message.connectionId
    )
      return null;
    const [connection] = await tx
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.id, message.connectionId),
          eq(emailConnections.businessId, mine.id),
        ),
      );
    if (!connection || connection.paused || connection.status !== "connected")
      return null;
    const [newer] = message.threadId
      ? await tx
          .select({ id: customerMessages.id })
          .from(customerMessages)
          .where(
            and(
              eq(customerMessages.businessId, mine.id),
              eq(customerMessages.threadId, message.threadId),
              sql`${customerMessages.createdAt} > ${message.createdAt}`,
            ),
          )
          .limit(1)
      : [];
    if (newer) return null;
    await tx
      .update(customerMessages)
      .set({ reply, sendState: "sending", updatedAt: new Date() })
      .where(eq(customerMessages.id, id));
    return { message, connection };
  });
}
export async function finishReplyForOwner(
  db: Db,
  ownerId: string,
  id: string,
  state: "sent" | "uncertain",
) {
  const mine = await business(db, ownerId);
  if (!mine) return;
  await db
    .update(customerMessages)
    .set({
      sendState: state,
      sentAt: state === "sent" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(customerMessages.businessId, mine.id),
        eq(customerMessages.id, id),
        eq(customerMessages.sendState, "sending"),
      ),
    );
}

export async function fetchedMessageForOwner(
  db: Db,
  ownerId: string,
  id: string,
  input: { sender: string; subject: string; threadId: string | null },
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return;
  await db
    .update(customerMessages)
    .set(input)
    .where(
      and(
        eq(customerMessages.id, id),
        eq(customerMessages.businessId, mine.id),
        eq(customerMessages.state, "processing"),
      ),
    );
}

export async function reminderForOwner(db: Db, ownerId: string, days: number) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo || ![1, 2, 3, 7].includes(days)) return false;
  const result = await db
    .update(emailConnections)
    .set({ reminderDays: days })
    .where(eq(emailConnections.businessId, mine.id))
    .returning();
  return !!result.length;
}

export async function ignoreIncomingForOwner(
  db: Db,
  ownerId: string,
  id: string,
  lease: Date,
) {
  const mine = await business(db, ownerId);
  if (!mine || mine.isDemo) return;
  await db
    .update(customerMessages)
    .set({ state: "dismissed", leaseUntil: null, issue: null })
    .where(
      and(
        eq(customerMessages.businessId, mine.id),
        eq(customerMessages.id, id),
        eq(customerMessages.state, "processing"),
        eq(customerMessages.leaseUntil, lease),
      ),
    );
}
