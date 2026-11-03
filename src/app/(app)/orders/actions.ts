"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { isDemoSession } from "@/lib/auth/server";
import { cancelMyOrder, recordMyOrder, replaceMyOrderLines, updateMyOrderDetails } from "@/lib/data/my-business";
import { DEMO_REFUSAL } from "@/lib/demo";
import { FULFILLMENT_METHODS } from "@/lib/domain";
import { orderIssueText, type PlaceOrderIssue } from "@/lib/rules/inventory";
import { LINE_LIMITS, lineInputSchema } from "@/lib/rules/order-lines";
import { centsSchema, WORK_TYPES } from "@/lib/rules/order-tracking";

type Result = { ok: boolean; message: string; id?: string };

const contact = {
  customerName: z.string().trim().min(1, "Type the customer’s name.").max(80),
  customerEmail: z.union([z.literal(""), z.email("Check the customer’s email.").max(254)]),
  customerPhone: z.string().trim().max(40),
};
const schedule = {
  fulfillment: z.enum(FULFILLMENT_METHODS),
  requestedDate: z.union([z.literal(""), z.iso.date("Choose a date, or leave it empty.")]),
  jobTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time, or leave it empty.")]),
  location: z.string().trim().max(300),
};
const lines = z.array(lineInputSchema).min(1, "Add at least one item or custom line.").max(LINE_LIMITS.lines, `An order can have up to ${LINE_LIMITS.lines} lines.`);

const orderSchema = z.object({
  id: z.string().min(1).max(60).optional(),
  requestKey: z.uuid(),
  ...contact,
  ...schedule,
  workType: z.enum(WORK_TYPES),
  title: z.string().trim().max(160),
  notes: z.string().trim().max(3000),
  lines,
  deposit: z.object({ amountCents: centsSchema.positive(), paidOn: z.iso.date(), note: z.string().trim().max(300) }).nullable(),
});

const issuesText = (issues: PlaceOrderIssue[], names: Record<string, string>) =>
  issues.map((issue) => orderIssueText(issue, (id) => names[id] ?? "That item")).join(" ");

export async function createOrderAction(input: unknown): Promise<Result> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the order." };
  const { requestedDate, ...order } = parsed.data;
  const result = await recordMyOrder({ ...order, requestedDate: requestedDate || null });
  if (!result.ok) {
    if (result.reason === "no_business") return { ok: false, message: "Tell us about your business first." };
    if (result.reason === "needs_review") return { ok: false, message: issuesText(result.issues, result.names) };
    if (result.reason === "bad_deposit")
      return { ok: false, message: "The deposit can’t be more than the total. Give every line a price to record a deposit now, or record it later." };
    if (result.reason === "too_large") return { ok: false, message: "This order is over $1,000,000. Split it up." };
    return { ok: false, message: "This order can’t be saved as it is. Reload and check it." };
  }
  refresh();
  return { ok: true, message: "Order saved.", id: result.id };
}

export async function saveOrderLinesAction(input: unknown): Promise<Result> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.object({ id: z.string().min(1).max(60), lines }).safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the items." };
  const result = await replaceMyOrderLines(parsed.data.id, parsed.data.lines);
  if (!result.ok) {
    const messages: Record<Exclude<typeof result.reason, "needs_review">, string> = {
      not_found: "Order not found. Reload and try again.",
      not_editable: "Items can change only while the work is open.",
      empty: "Add at least one item or custom line.",
      too_large: "This order is over $1,000,000. Split it up.",
      below_paid: "The new total is less than what’s been paid. Record a refund first.",
      unpriced_paid: "Payments are recorded on this order, so give every line a price.",
    };
    return { ok: false, message: result.reason === "needs_review" ? issuesText(result.issues, result.names) : messages[result.reason] };
  }
  refresh();
  return { ok: true, message: "Items saved. Stock and total updated." };
}

const detailsSchema = z
  .object({ id: z.string().min(1).max(60), notes: z.string().trim().max(3000), ...contact, ...schedule })
  .partial()
  .required({ id: true });

export async function saveOrderDetailsAction(input: unknown): Promise<Result> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details." };
  const { id, requestedDate, ...patch } = parsed.data;
  const result = await updateMyOrderDetails(id, {
    ...patch,
    ...(requestedDate === undefined ? {} : { requestedDate: requestedDate || null }),
  });
  if (result === "fulfillment") return { ok: false, message: "That way of handing it over doesn’t fit the order’s current step." };
  if (result !== "saved") return { ok: false, message: "This order can’t be changed now. Reload and check its status." };
  refresh();
  return { ok: true, message: "Saved." };
}

export async function cancelOrderAction(input: unknown): Promise<Result> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.object({ orderId: z.string().min(1).max(60) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Choose an order." };
  const result = await cancelMyOrder(parsed.data.orderId);
  if (result === "not_found") return { ok: false, message: "Order not found. Reload and try again." };
  if (result === "completed") return { ok: false, message: "Shipped or completed work cannot be cancelled. Record a refund separately if needed." };
  refresh();
  return { ok: true, message: result === "already_cancelled" ? "That order was already cancelled." : "Order cancelled. What it took from stock is back." };
}
