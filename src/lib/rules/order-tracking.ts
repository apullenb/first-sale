import { z } from "zod";
import { FULFILLMENT_METHODS, ORDER_STATUSES, type BusinessProfile, type FulfillmentMethod } from "@/lib/domain";

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
  fulfillment: z.enum(FULFILLMENT_METHODS),
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

// Presenting the tracker: tabs, next steps, due dates and sorting

export const STATUS_TABS = ["active", "review", "todo", "in_progress", "ready", "done", "cancelled"] as const;
export type StatusTab = (typeof STATUS_TABS)[number];
export const TAB_TEXT: Record<StatusTab, string> = {
  active: "All active",
  review: "Needs review",
  todo: "To do",
  in_progress: "In progress",
  ready: "Ready",
  done: "Done",
  cancelled: "Cancelled",
};
// Shipped sits with Ready: the owner's part is finished, the customer's isn't yet
export function tabOf(status: TrackingStatus): Exclude<StatusTab, "active"> {
  switch (status) {
    case "new":
    case "needs_review":
      return "review";
    case "confirmed":
      return "todo";
    case "in_progress":
      return "in_progress";
    case "ready":
    case "shipped":
      return "ready";
    case "fulfilled":
      return "done";
    case "cancelled":
      return "cancelled";
  }
}
export function inTab(status: TrackingStatus, tab: StatusTab): boolean {
  return tab === "active" ? !["fulfilled", "cancelled"].includes(status) : tabOf(status) === tab;
}

interface Tracked {
  status: TrackingStatus;
  workType: WorkType;
  fulfillment: string;
}
// Steps the owner can move to now, nearest first; samples in review may go to any step
export function laterSteps(order: Tracked, sample = false): TrackingStatus[] {
  const steps = statusesFor(order.workType, order.fulfillment);
  if (order.status === "cancelled") return [];
  if (order.status === "new" || order.status === "needs_review") return sample ? steps : [];
  const at = steps.indexOf(order.status);
  return at < 0 ? [] : steps.slice(at + 1);
}
export function nextStep(order: Tracked, sample = false): TrackingStatus | null {
  return laterSteps(order, sample)[0] ?? null;
}
// Button text for moving to a step: "Start work", "Mark ready", "Mark completed"
export function stepAction(status: TrackingStatus, type: WorkType): string {
  if (status === "confirmed") return type === "services" ? "Mark scheduled" : "Mark confirmed";
  if (status === "in_progress") return type === "made_to_order" ? "Start making" : "Start work";
  if (status === "fulfilled") return "Mark completed";
  return `Mark ${STATUS_TEXT[status].toLowerCase()}`;
}

export const FULFILLMENT_TEXT: Record<FulfillmentMethod, string> = {
  pickup: "Pickup",
  delivery: "Delivery",
  shipping: "Shipping",
  at_customer: "At the customer’s place",
  at_business: "At your place",
};
export const LOCATION_TEXT: Record<FulfillmentMethod, string> = {
  pickup: "Pickup place (optional)",
  delivery: "Delivery address",
  shipping: "Shipping address",
  at_customer: "Customer’s address",
  at_business: "Where (optional)",
};
// A new way to hand it over must still have the order's current step
export function fulfillmentFits(status: TrackingStatus, type: WorkType, fulfillment: string): boolean {
  return ["new", "needs_review", "cancelled"].includes(status) || statusesFor(type, fulfillment).includes(status);
}

const DAY = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY);
}
// "10:00" -> "10 am", "07:30" -> "7:30 am"
export function timeText(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return "";
  const hour = Number(match[1]);
  const twelve = hour % 12 || 12;
  return `${twelve}${match[2] === "00" ? "" : `:${match[2]}`} ${hour < 12 ? "am" : "pm"}`;
}
export function dateText(date: string, today: string): string {
  const options: Intl.DateTimeFormatOptions = { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" };
  if (date.slice(0, 4) !== today.slice(0, 4)) options.year = "numeric";
  return new Date(utc(date)).toLocaleDateString("en-US", options);
}
export function relativeDays(date: string, today: string): string {
  const days = daysBetween(today, date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}
// "Sat, Nov 7 · 10 am" and "in 4 days"; overdue only while the owner still has work to do
export function dueText(order: { status: TrackingStatus; requestedDate: string | null; jobTime: string }, today: string) {
  if (!order.requestedDate) return { date: "No due date", relative: "", overdue: false, today: false };
  const attention = orderAttention(order, today);
  const time = timeText(order.jobTime);
  return {
    date: `${dateText(order.requestedDate, today)}${time ? ` · ${time}` : ""}`,
    relative: relativeDays(order.requestedDate, today),
    overdue: attention === "overdue",
    today: attention === "today",
  };
}

export const ORDER_SORTS = ["due", "newest", "customer"] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];
export const SORT_TEXT: Record<OrderSort, string> = { due: "Due date", newest: "Newest", customer: "Customer" };
interface Sortable {
  requestedDate: string | null;
  jobTime: string;
  createdAt: string;
  customerName: string;
}
// Due date: soonest first, undated last; ties by time, then newest
export function sortOrders<T extends Sortable>(rows: readonly T[], sort: OrderSort): T[] {
  const newest = (a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
  return [...rows].sort((a, b) => {
    if (sort === "newest") return newest(a, b);
    if (sort === "customer") return a.customerName.localeCompare(b.customerName, "en", { sensitivity: "base" }) || newest(a, b);
    const byDate = (a.requestedDate ?? "9999-99-99").localeCompare(b.requestedDate ?? "9999-99-99");
    return byDate || (a.jobTime || "99:99").localeCompare(b.jobTime || "99:99") || newest(a, b);
  });
}
