import { z } from "zod";
import { ORDER_STATUSES, type BusinessProfile } from "@/lib/domain";

export const WORK_TYPES = ["products", "made_to_order", "services"] as const;
export type WorkType = (typeof WORK_TYPES)[number];
export const TRACKING_STATUSES = ORDER_STATUSES;
export type TrackingStatus = (typeof TRACKING_STATUSES)[number];
export const STATUS_TEXT: Record<TrackingStatus, string> = {
  new: "New",
  needs_review: "Needs review",
  confirmed: "Confirmed",
  in_progress: "In progress",
  ready: "Ready",
  shipped: "Shipped",
  fulfilled: "Completed",
  cancelled: "Cancelled",
};
export const WORK_TEXT: Record<WorkType, string> = {
  products: "Products",
  made_to_order: "Made to order",
  services: "Service job",
};
// Largest order total or payment, $1,000,000
export const MAX_ORDER_CENTS = 100_000_000;
export const centsSchema = z.number().int().min(0).max(MAX_ORDER_CENTS);
export const trackingInputSchema = z.object({
  id: z.string().max(60).optional(),
  requestKey: z.uuid(),
  customerName: z.string().trim().min(1, "Enter a customer name.").max(80),
  customerEmail: z.union([z.literal(""), z.email().max(254)]),
  customerPhone: z.string().trim().max(40),
  workType: z.enum(WORK_TYPES),
  title: z.string().trim().min(1, "Describe the order or job.").max(160),
  fulfillment: z.enum(["pickup", "delivery", "shipping"]),
  requestedDate: z.union([z.literal(""), z.iso.date()]),
  jobTime: z.union([
    z.literal(""),
    z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  ]),
  location: z.string().trim().max(300),
  notes: z.string().trim().max(3000),
  totalCents: centsSchema.nullable(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1).max(60),
        values: z.array(z.string().max(100)).max(5),
        quantity: z.number().int().min(1).max(1_000_000),
      }),
    )
    .max(20),
});
export type TrackingInput = z.infer<typeof trackingInputSchema>;

export function workDefault(
  profile: BusinessProfile | null,
  items: readonly { kind: string }[],
): WorkType {
  if (!profile)
    return items.length && items.every((item) => item.kind === "service")
      ? "services"
      : "products";
  const services =
    items.some((item) => item.kind === "service") ||
    profile.offeringKinds.includes("services");
  const products =
    items.some((item) => item.kind === "product") ||
    profile.offeringKinds.some((kind) => kind !== "services");
  if (services && !products) return "services";
  return profile.offeringKinds.includes("handmade") ||
    profile.offeringKinds.includes("food")
    ? "made_to_order"
    : "products";
}

export function statusesFor(
  type: WorkType,
  fulfillment: string,
): TrackingStatus[] {
  return [
    "confirmed",
    ...(type === "services" || type === "made_to_order"
      ? ["in_progress" as const]
      : []),
    ...(type === "services"
      ? []
      : [
          fulfillment === "shipping"
            ? ("shipped" as const)
            : ("ready" as const),
        ]),
    "fulfilled",
  ];
}
export function statusText(status: TrackingStatus, type: WorkType): string {
  return type === "services" && status === "confirmed"
    ? "Scheduled"
    : type === "made_to_order" && status === "in_progress"
      ? "Making"
      : STATUS_TEXT[status];
}
export function canTransition(
  from: TrackingStatus,
  to: TrackingStatus,
  type: WorkType,
  fulfillment: string,
): boolean {
  const steps = statusesFor(type, fulfillment);
  return steps.includes(from) && steps.indexOf(to) > steps.indexOf(from);
}
// Email-demo samples have no editor, so one still in review moves straight to a step
export function canProgressSample(
  from: TrackingStatus,
  to: TrackingStatus,
  type: WorkType,
  fulfillment: string,
): boolean {
  return from === "new" || from === "needs_review"
    ? statusesFor(type, fulfillment).includes(to)
    : canTransition(from, to, type, fulfillment);
}

export interface PaymentEntry {
  amountCents: number;
  kind: "payment" | "refund";
}
export function paymentSummary(
  total: number | null,
  entries: readonly PaymentEntry[],
) {
  const received = entries
    .filter((entry) => entry.kind === "payment")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const refunded = entries
    .filter((entry) => entry.kind === "refund")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const paid = received - refunded;
  return {
    received,
    refunded,
    paid,
    balance: total === null ? null : Math.max(0, total - paid),
    credit: total === null ? 0 : Math.max(0, paid - total),
    // The balance decides first, so a refund paid back in full still reads Paid
    status:
      total !== null && total > 0 && paid >= total
        ? "Paid"
        : refunded > 0
          ? paid === 0
            ? "Refunded"
            : "Partially refunded"
          : total === 0
            ? "Nothing due"
            : received === 0
              ? "Unpaid"
              : "Partially paid",
  };
}
export function validPayment(
  total: number | null,
  entries: readonly PaymentEntry[],
  entry: PaymentEntry,
): boolean {
  if (
    !Number.isSafeInteger(entry.amountCents) ||
    entry.amountCents <= 0 ||
    entry.amountCents > 100_000_000
  )
    return false;
  const summary = paymentSummary(total, entries);
  return entry.kind === "refund"
    ? entry.amountCents <= summary.paid
    : total !== null && entry.amountCents <= (summary.balance ?? 0);
}
export function orderAttention(
  order: { status: TrackingStatus; requestedDate: string | null },
  today: string,
): "review" | "overdue" | "today" | "upcoming" | "closed" {
  if (order.status === "cancelled" || order.status === "fulfilled")
    return "closed";
  if (order.status === "new" || order.status === "needs_review")
    return "review";
  // The owner's part is done once it ships, so its date can't make it late
  if (order.status === "shipped") return "upcoming";
  return order.requestedDate && order.requestedDate < today
    ? "overdue"
    : order.requestedDate === today
      ? "today"
      : "upcoming";
}
