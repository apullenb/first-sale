import "server-only";
import { and, eq, like } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, orderEvents, orderLines, orders } from "@/db/schema";
import { DEMO_EMAILS } from "@/data/email-demo";
import { dueDateFromWording } from "@/lib/rules/demo-dates";
import { customLineFrom } from "@/lib/rules/order-lines";

// Confirmed email-demo samples become DEMO orders with custom lines: no saved items, no stock, no total
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

// Today as the server sees it, so a sample's "Saturday" lands on the next one
export async function addEmailDemoOrderForOwner(
  db: Db,
  ownerId: string,
  sampleId: string,
  today = new Date().toISOString().slice(0, 10),
): Promise<EmailDemoResult> {
  const sample = DEMO_EMAILS.find((email) => email.id === sampleId);
  if (!sample || (sample.result.kind !== "order" && sample.result.kind !== "quote")) return { ok: false, reason: "not_found" };
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return { ok: false, reason: "no_business" };
  const { result } = sample;
  const quote = result.kind === "quote";
  const lines = result.items.flatMap((item) => customLineFrom(item.name, item.quantity) ?? []);
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
        requestedDate: dueDateFromWording(result.when, today),
        jobTime: result.jobTime ?? "",
        location: result.location ?? "",
        totalCents: null,
        status: quote ? "needs_review" : "confirmed",
        notes: [...(result.notes ? [result.notes] : []), `Timing as written: ${result.when}`, `From sample email: ${sample.subject}`].join("\n"),
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
    if (lines.length)
      await tx.insert(orderLines).values(
        lines.map((line) => ({ orderId: made.id, productId: null, nameSnapshot: line.description, quantity: line.quantity, unitPriceCents: null })),
      );
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

// Only this demo's orders: DEMO, from email, keyed by a sample; their lines go with them
export async function clearEmailDemoOrdersForOwner(db: Db, ownerId: string): Promise<number> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return 0;
  const gone = await db.delete(orders).where(mine(businessId)).returning();
  return gone.length;
}
