import "server-only";
import { getDb } from "@/db/client";
import { pendingEmailForOwner } from "@/lib/data/customer-messages";
import { processCustomerMessage } from "@/lib/orders/process";

// AI reads per press; the rest wait for the next one
export const READS_PER_PRESS = 10;

// Reads forwarded emails waiting for the owner; `canRead` takes one AI request for each read after the first
export async function readNewEmailForOwner(
  ownerId: string,
  canRead: () => Promise<boolean>,
) {
  const db = getDb();
  const waiting = await pendingEmailForOwner(db, ownerId, READS_PER_PRESS);
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
  const remaining = (await pendingEmailForOwner(db, ownerId, 1_000)).length;
  return { read, failed, remaining };
}
