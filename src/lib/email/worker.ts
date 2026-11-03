import "server-only";
import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { businesses, customerMessages, emailConnections } from "@/db/schema";
import { addMessageForOwner } from "@/lib/data/customer-messages";
import { runBackgroundWorkflow } from "@/lib/workflow-runner";
import { processCustomerMessage } from "@/lib/orders/process";
import { emailApi, emailMessageSchema } from "./client";

export async function enqueueEmailEvent(event: unknown) {
  const parsed = z
    .object({
      type: z.string(),
      data: z.object({
        object: z.object({
          id: z.string().max(500),
          grant_id: z.string().max(500).optional(),
        }),
      }),
    })
    .safeParse(event);
  if (!parsed.success) return;
  const {
    type,
    data: { object },
  } = parsed.data;
  const db = getDb();
  const [connection] = await db
    .select({ connection: emailConnections, ownerId: businesses.ownerId })
    .from(emailConnections)
    .innerJoin(businesses, eq(businesses.id, emailConnections.businessId))
    .where(
      and(
        eq(emailConnections.grantId, object.grant_id ?? object.id),
        eq(businesses.isDemo, false),
      ),
    );
  if (!connection) return;
  if (type === "grant.expired" || type === "grant.deleted") {
    await db
      .update(emailConnections)
      .set({ status: "reconnect", paused: true })
      .where(eq(emailConnections.id, connection.connection.id));
    return;
  }
  if (
    !["message.created", "message.created.truncated"].includes(type) ||
    connection.connection.paused
  )
    return;
  await addMessageForOwner(db, connection.ownerId, {
    source: "email",
    sourceKey: `nylas:${connection.connection.grantId}:${object.id}`,
    connectionId: connection.connection.id,
    providerMessageId: object.id,
    subject: "Incoming customer email",
  });
}
export async function pollCustomerEmail() {
  const db = getDb();
  const connections = await db
    .select({ connection: emailConnections, ownerId: businesses.ownerId })
    .from(emailConnections)
    .innerJoin(businesses, eq(businesses.id, emailConnections.businessId))
    .where(
      and(
        eq(emailConnections.paused, false),
        eq(emailConnections.status, "connected"),
        eq(businesses.isDemo, false),
      ),
    )
    .orderBy(asc(emailConnections.syncSince))
    .limit(3);
  for (const { connection, ownerId } of connections) {
    try {
      const started = connection.syncStarted ?? new Date();
      const params = new URLSearchParams({
        received_after: String(
          Math.max(0, Math.floor(connection.syncSince.getTime() / 1000) - 300),
        ),
        limit: "50",
        select: "id,thread_id,from,to,subject",
      });
      if (connection.syncCursor)
        params.set("page_token", connection.syncCursor);
      const response = z
        .object({
          data: z.array(emailMessageSchema),
          next_cursor: z.string().nullish(),
        })
        .parse(
          await emailApi(
            `/grants/${encodeURIComponent(connection.grantId)}/messages?${params}`,
          ),
        );
      for (const message of response.data) {
        if (
          message.from.some(
            (person) =>
              person.email.toLowerCase() === connection.email.toLowerCase(),
          ) ||
          !message.to.some(
            (person) =>
              person.email.toLowerCase() === connection.email.toLowerCase(),
          )
        )
          continue;
        await addMessageForOwner(db, ownerId, {
          source: "email",
          sourceKey: `nylas:${connection.grantId}:${message.id}`,
          connectionId: connection.id,
          providerMessageId: message.id,
          threadId: message.thread_id,
          sender: message.from[0]?.email,
          subject: message.subject.slice(0, 1000),
        });
      }
      await db
        .update(emailConnections)
        .set({
          syncCursor: response.next_cursor ?? null,
          syncStarted: response.next_cursor ? started : null,
          syncSince: response.next_cursor ? connection.syncSince : started,
        })
        .where(
          and(
            eq(emailConnections.id, connection.id),
            eq(emailConnections.grantId, connection.grantId),
          ),
        );
    } catch {
      /* Keep the cursor for the next scheduled attempt. */
    }
  }
}
export async function workCustomerMessages() {
  const db = getDb();
  await db
    .update(customerMessages)
    .set({ sendState: "uncertain" })
    .where(
      and(
        eq(customerMessages.sendState, "sending"),
        lt(customerMessages.updatedAt, new Date(Date.now() - 5 * 60_000)),
      ),
    );
  const pending = await db
    .select({ id: customerMessages.id, ownerId: businesses.ownerId })
    .from(customerMessages)
    .innerJoin(businesses, eq(businesses.id, customerMessages.businessId))
    .leftJoin(
      emailConnections,
      eq(emailConnections.id, customerMessages.connectionId),
    )
    .where(
      and(
        eq(businesses.isDemo, false),
        or(
          sql`${customerMessages.connectionId} is null`,
          and(
            eq(emailConnections.paused, false),
            eq(emailConnections.status, "connected"),
          ),
        ),
        lt(customerMessages.attempts, 5),
        or(
          eq(customerMessages.state, "pending"),
          and(
            inArray(customerMessages.state, ["failed", "processing"]),
            lt(customerMessages.leaseUntil, new Date()),
          ),
        ),
      ),
    )
    .orderBy(asc(customerMessages.updatedAt))
    .limit(1);
  for (const message of pending) {
    const result = await runBackgroundWorkflow(
      message.ownerId,
      message.id,
      () => processCustomerMessage(message.ownerId, message.id),
    );
    if (!result.ok)
      await db
        .update(customerMessages)
        .set({
          state: "failed",
          issue: result.message,
          leaseUntil: new Date(Date.now() + 60 * 60_000),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(customerMessages.id, message.id),
            eq(customerMessages.state, "pending"),
          ),
        );
  }
  const [remaining] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(customerMessages)
    .where(
      inArray(customerMessages.state, ["pending", "failed", "processing"]),
    );
  return { processed: pending.length, remaining: remaining.count };
}
