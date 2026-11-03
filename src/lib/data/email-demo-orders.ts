import "server-only";
import { and, eq, like } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, orderEvents, orders } from "@/db/schema";
import { DEMO_EMAILS } from "@/data/email-demo";

// Confirmed email-demo samples become DEMO custom-work orders: no catalog lines, no stock, no total
export const EMAIL_DEMO_KEY = "email-demo:";
const sampleKey = (id: string) => `${EMAIL_DEMO_KEY}${id}`;
export const isEmailDemoKey = (key: string | null) => !!key?.startsWith(EMAIL_DEMO_KEY);

async function businessOf(db: Db, ownerId: string) {
  const [row] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  return row?.id ?? null;
}

const mine = (businessId: string) =>
  and(eq(orders.businessId, businessId), eq(orders.isDemo, true), eq(orders.source, "email"), like(orders.requestKey, `${EMAIL_DEMO_KEY}%`));

export type EmailDemoResult = { ok: true; id: string } | { ok: false; reason: "no_business" | "not_found" };

export async function addEmailDemoOrderForOwner(db: Db, ownerId: string, sampleId: string): Promise<EmailDemoResult> {
  const sample = DEMO_EMAILS.find((email) => email.id === sampleId);
  if (!sample || (sample.result.kind !== "order" && sample.result.kind !== "quote")) return { ok: false, reason: "not_found" };
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return { ok: false, reason: "no_business" };
  const { result } = sample;
  const quote = result.kind === "quote";
  return db.transaction(async (tx) => {
    const [made] = await tx
      .insert(orders)
      .values({
        businessId,
        isDemo: true,
        source: "email",
        requestKey: sampleKey(sample.id),
        customerName: sample.fromName,
        customerEmail: sample.from,
        title: result.title,
        workType: "made_to_order",
        fulfillment: result.fulfillment ?? "pickup",
        requestedDate: null,
        jobTime: result.jobTime ?? "",
        location: result.location ?? "",
        totalCents: null,
        status: quote ? "needs_review" : "confirmed",
        notes: [
          ...result.items.map((item) => `${item.quantity} × ${item.name}`),
          `When: ${result.when}`,
          ...(result.notes ? [result.notes] : []),
          `From sample email: ${sample.subject}`,
        ].join("\n"),
      })
      .onConflictDoNothing()
      .returning();
    if (!made) {
      const [prior] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(and(mine(businessId), eq(orders.requestKey, sampleKey(sample.id))));
      return prior ? { ok: true as const, id: prior.id } : { ok: false as const, reason: "not_found" as const };
    }
    await tx.insert(orderEvents).values([
      { orderId: made.id, actor: "owner" as const, summary: `DEMO · ${quote ? "Quote request" : "Order"} confirmed from a sample email` },
      { orderId: made.id, actor: "rule" as const, summary: "No stock taken and no total set" },
    ]);
    return { ok: true as const, id: made.id };
  });
}

// Sample ids the owner has already confirmed
export async function listEmailDemoSamplesForOwner(db: Db, ownerId: string): Promise<string[]> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return [];
  const rows = await db.select({ key: orders.requestKey }).from(orders).where(mine(businessId));
  return rows.flatMap((row) => (row.key ? [row.key.slice(EMAIL_DEMO_KEY.length)] : []));
}

// Only this demo's orders: DEMO, from email, keyed by a sample
export async function clearEmailDemoOrdersForOwner(db: Db, ownerId: string): Promise<number> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return 0;
  const gone = await db.delete(orders).where(mine(businessId)).returning();
  return gone.length;
}
