"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isDemoSession } from "@/lib/auth/server";
import { cancelMyOrder, recordMyOrder } from "@/lib/data/my-business";
import { DEMO_REFUSAL } from "@/lib/demo";
import { FULFILLMENT_METHODS } from "@/lib/domain";
import { orderIssueText } from "@/lib/rules/inventory";
import { OPTION_LIMITS, PRODUCT_LIMITS } from "@/lib/rules/products";

const orderSchema = z.object({
  customerName: z.string().trim().min(1, "Type the customer’s name.").max(80),
  fulfillment: z.enum(FULFILLMENT_METHODS),
  requestedDate: z.union([z.literal(""), z.iso.date("Choose a date, or leave it empty.")]),
  notes: z.string().trim().max(300),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1).max(60),
        values: z.array(z.string().max(OPTION_LIMITS.label)).max(OPTION_LIMITS.groups),
        quantity: z.number().int("Type how many as a whole number.").min(1, "Type how many as a whole number.").max(PRODUCT_LIMITS.quantity),
      }),
    )
    .min(1, "Add at least one item to the order.")
    .max(20),
});

export async function recordOrderAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the order." };
  const result = await recordMyOrder({ ...parsed.data, requestedDate: parsed.data.requestedDate || null });
  if (!result.ok) {
    if (result.reason !== "needs_review") return { ok: false, message: "Tell us about your business first." };
    return { ok: false, message: result.issues.map((issue) => orderIssueText(issue, (id) => result.names[id] ?? "That item")).join(" ") };
  }
  refresh();
  return { ok: true, message: "Order saved." };
}

export async function cancelOrderAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.object({ orderId: z.string().min(1).max(60) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose an order." };
  const result = await cancelMyOrder(parsed.data.orderId);
  if (result === "not_found") return { ok: false, message: "Order not found. Reload and try again." };
  if (result === "completed") return { ok: false, message: "Shipped or completed work cannot be cancelled. Record a refund separately if needed." };
  refresh();
  return { ok: true, message: result === "already_cancelled" ? "That order was already cancelled." : "Order cancelled. What it took from stock is back." };
}
