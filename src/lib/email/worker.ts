import "server-only";
import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { businesses, customerMessages, emailConnections } from "@/db/schema";
import { addMessageForOwner } from "@/lib/data/customer-messages";
import { runBackgroundWorkflow } from "@/lib/workflow-runner";
import { processCustomerMessage } from "@/lib/orders/process";
import { EmailApiError, emailApi, emailMessageSchema } from "./client";

// Runs stop starting new work after this, inside the routes' time limits
const SYNC_BUDGET_MS = 90_000;
const WORK_BUDGET_MS = 240_000;

// The owner's own mail, such as replies sent from SnapStart, is never a customer request
function fromOwner(from: readonly { email: string }[], owner: string): boolean {
  return from.some(
    (person) => person.email.toLowerCase() === owner.toLowerCase(),
  );
}

export async function enqueueEmailEvent(event: unknown) {
  const parsed = z
    .object({
      type: z.string(),
      data: z.object({
        object: z.object({
          id: z.string().max(500),
          grant_id: z.string().max(500).optional(),
          from: z.array(z.object({ email: z.string().max(500) })).optional(),
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
    connection.connection.paused ||
    fromOwner(object.from ?? [], connection.connection.email)
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
// Every inbox by default; one owner's for their Sync now button
export async function pollCustomerEmail(ownerId?: string) {
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
        ownerId ? eq(businesses.ownerId, ownerId) : undefined,
      ),
    )
    .orderBy(asc(emailConnections.syncSince))
    .limit(50);
  const started = Date.now();
  for (const { connection, ownerId } of connections) {
    if (Date.now() - started > SYNC_BUDGET_MS) break;
    try {
      const syncStarted = connection.syncStarted ?? new Date();
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
          data: z.array(z.unknown()),
          next_cursor: z.string().nullish(),
        })
        .parse(
          await emailApi(
            `/grants/${encodeURIComponent(connection.grantId)}/messages?${params}`,
          ),
        );
      for (const raw of response.data) {
        // One odd address skips that message, not the whole page; mail by Cc, alias or forward still counts
        const parsed = emailMessageSchema.safeParse(raw);
        if (!parsed.success || fromOwner(parsed.data.from, connection.email))
          continue;
        const message = parsed.data;
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
          syncStarted: response.next_cursor ? syncStarted : null,
          syncSince: response.next_cursor ? connection.syncSince : syncStarted,
        })
        .where(
          and(
            eq(emailConnections.id, connection.id),
            eq(emailConnections.grantId, connection.grantId),
          ),
        );
    } catch (error) {
      const status = error instanceof EmailApiError ? error.status : null;
      // A revoked or deleted grant waits for the owner to reconnect; a rejected cursor starts its window again
      if (status === 401 || status === 403 || status === 404) {
        await db
          .update(emailConnections)
          .set({ status: "reconnect", paused: true })
          .where(eq(emailConnections.id, connection.id));
      } else if (status === 400 && connection.syncCursor) {
        await db
          .update(emailConnections)
          .set({ syncCursor: null, syncStarted: null })
          .where(eq(emailConnections.id, connection.id));
      }
      /* Anything else keeps the cursor for the next scheduled attempt. */
    }
  }
}
export async function workCustomerMessages(
  ownerId?: string,
  budgetMs = WORK_BUDGET_MS,
) {
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
  const started = Date.now();
  let processed = 0;
  // Each message once per run, so one that stays eligible can't spend AI requests over and over
  const tried = new Set<string>();
  // One at a time, oldest first, until the time runs out or nothing is left
  while (Date.now() - started < budgetMs) {
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
          ownerId ? eq(businesses.ownerId, ownerId) : undefined,
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
    if (!pending.length || tried.has(pending[0].id)) break;
    for (const message of pending) {
      processed++;
      tried.add(message.id);
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
  }
  const [remaining] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(customerMessages)
    .innerJoin(businesses, eq(businesses.id, customerMessages.businessId))
    .where(
      and(
        inArray(customerMessages.state, ["pending", "failed", "processing"]),
        ownerId ? eq(businesses.ownerId, ownerId) : undefined,
      ),
    );
  return { processed, remaining: remaining.count };
}
