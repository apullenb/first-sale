import { paymentSummary, type PaymentEntry, type TrackingStatus } from "./order-tracking";

// Customers worked out from orders: no separate customer records

export interface CustomerOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: TrackingStatus;
  isDemo: boolean;
  totalCents: number | null;
  payments: readonly PaymentEntry[];
  createdAt: string;
}

export interface Customer {
  key: string;
  name: string;
  email: string;
  phone: string;
  orders: number;
  // Payments kept, net of refunds
  spentCents: number;
  balanceCents: number;
  lastOrderAt: string;
  orderIds: string[];
  // Every order of theirs is a DEMO sample
  demo: boolean;
}

export const PLACEHOLDER_NAME = "Customer to confirm";
const digits = (phone: string) => phone.replace(/\D/g, "");

// Same email, else same phone, else same name
export function customerKey(order: Pick<CustomerOrder, "customerName" | "customerEmail" | "customerPhone">): string {
  const email = order.customerEmail.trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = digits(order.customerPhone);
  if (phone.length >= 7) return `phone:${phone}`;
  return `name:${order.customerName.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

// Most recent first; cancelled orders don't count toward orders or balance
export function customersFrom(orders: readonly CustomerOrder[]): Customer[] {
  const byKey = new Map<string, Customer>();
  const newestFirst = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const order of newestFirst) {
    if (order.customerName === PLACEHOLDER_NAME && !order.customerEmail) continue;
    const key = customerKey(order);
    const summary = paymentSummary(order.totalCents, order.payments);
    const counts = order.status !== "cancelled";
    const owes = counts && !["new", "needs_review"].includes(order.status);
    const found = byKey.get(key);
    if (!found) {
      byKey.set(key, {
        key,
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
        orders: counts ? 1 : 0,
        spentCents: summary.paid,
        balanceCents: owes ? (summary.balance ?? 0) : 0,
        lastOrderAt: order.createdAt,
        orderIds: [order.id],
        demo: order.isDemo,
      });
      continue;
    }
    found.email ||= order.customerEmail;
    found.phone ||= order.customerPhone;
    found.orders += counts ? 1 : 0;
    found.spentCents += summary.paid;
    found.balanceCents += owes ? (summary.balance ?? 0) : 0;
    found.orderIds.push(order.id);
    found.demo &&= order.isDemo;
  }
  return [...byKey.values()];
}

export function matchCustomers(customers: readonly Customer[], query: string, limit = 6): Customer[] {
  const text = query.trim().toLowerCase();
  if (!text) return [];
  return customers
    .filter((customer) => !customer.demo && `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(text))
    .slice(0, limit);
}
