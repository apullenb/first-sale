import "server-only";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  addMessageForOwner,
  connectionForOwner,
  importedForOwner,
  pendingEmailForOwner,
} from "@/lib/data/customer-messages";
import { OwnerFacingError } from "@/lib/errors";
import { processCustomerMessage } from "@/lib/orders/process";
import { EmailApiError, emailApi, emailMessageSchema } from "./client";

// First import: the newest few from the past week; later ones: everything since the last, newest first
export const FIRST_IMPORT_DAYS = 7;
export const FIRST_IMPORT_COUNT = 25;
export const IMPORT_COUNT = 50;
// AI reads per press; the rest wait for the next one
export const READS_PER_IMPORT = 10;
// Catches mail that arrived while the last import ran
const OVERLAP_MS = 5 * 60_000;

// `canRead` takes one AI request for each read after the first
export async function importEmailForOwner(
  ownerId: string,
  canRead: () => Promise<boolean>,
) {
  const db = getDb();
  const connection = await connectionForOwner(db, ownerId);
  if (!connection || connection.status !== "connected")
    throw new OwnerFacingError("Connect your inbox first.");
  const started = new Date();
  const since = connection.importedAt
    ? connection.importedAt.getTime() - OVERLAP_MS
    : started.getTime() - FIRST_IMPORT_DAYS * 86_400_000;
  const params = new URLSearchParams({
    received_after: String(Math.floor(since / 1000)),
    limit: String(connection.importedAt ? IMPORT_COUNT : FIRST_IMPORT_COUNT),
    select: "id,thread_id,from,to,subject",
  });
  let page;
  try {
    page = z
      .object({ data: z.array(z.unknown()), next_cursor: z.string().nullish() })
      .parse(
        await emailApi(
          `/grants/${encodeURIComponent(connection.grantId)}/messages?${params}`,
        ),
      );
  } catch (error) {
    const status = error instanceof EmailApiError ? error.status : null;
    if (status === 401 || status === 403 || status === 404) {
      await importedForOwner(db, ownerId, connection.id, { status: "reconnect" });
      throw new OwnerFacingError(
        "Your inbox needs to be connected again. Choose Reconnect email.",
      );
    }
    throw error;
  }
  const waitingBefore = (
    await pendingEmailForOwner(db, ownerId, connection.id, 1_000)
  ).length;
  for (const raw of page.data) {
    // One odd address skips that message, not the import
    const parsed = emailMessageSchema.safeParse(raw);
    if (!parsed.success) continue;
    const message = parsed.data;
    // The owner's own mail, such as replies sent from SnapStart, is never a customer request
    if (
      message.from.some(
        (person) =>
          person.email.toLowerCase() === connection.email.toLowerCase(),
      )
    )
      continue;
    // Keyed by the provider's message id, so a message is imported once
    await addMessageForOwner(db, ownerId, {
      source: "email",
      sourceKey: `nylas:${connection.grantId}:${message.id}`,
      connectionId: connection.id,
      providerMessageId: message.id,
      threadId: message.thread_id ?? undefined,
      sender: message.from[0]?.email,
      subject: message.subject.slice(0, 1000) || "(No subject)",
    });
  }
  await importedForOwner(db, ownerId, connection.id, { importedAt: started });

  const pending = await pendingEmailForOwner(db, ownerId, connection.id, 1_000);
  const added = pending.length - waitingBefore;
  const waiting = pending.slice(0, READS_PER_IMPORT);
  let read = 0,
    failed = 0;
  for (const [index, id] of waiting.entries()) {
    if (index > 0 && !(await canRead())) break;
    try {
      await processCustomerMessage(ownerId, id);
      read++;
    } catch {
      // Marked for another look; the rest still get read
      failed++;
    }
  }
  const remaining = (
    await pendingEmailForOwner(db, ownerId, connection.id, 1_000)
  ).length;
  return { added, read, failed, remaining, more: !!page.next_cursor };
}
