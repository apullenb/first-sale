import "server-only";
import type { OrderView } from "@/lib/data/orders";
import { customersFrom } from "@/lib/rules/customers";
import type { OrderableItem, OrderRow } from "./shared";

// Plain data for client components; dates as ISO text

export function rowOf(order: OrderView): OrderRow {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    events: order.events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
  };
}

export function orderableOf(items: readonly OrderableItem[]): OrderableItem[] {
  return items.map(({ id, name, kind, priceCents, priceText, quantity, options }) => ({ id, name, kind, priceCents, priceText, quantity, options }));
}

export const customersOf = (rows: readonly OrderRow[]) => customersFrom(rows);

export const serverToday = () => new Date().toISOString().slice(0, 10);
