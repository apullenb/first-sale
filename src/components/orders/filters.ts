import { ORDER_SORTS, type OrderSort, STATUS_TABS, type StatusTab } from "@/lib/rules/order-tracking";

// The order list's filters, kept in the address so going back keeps them

export const VIEWS = ["list", "board", "schedule"] as const;
export type View = (typeof VIEWS)[number];
export const SHOWS = ["today", "overdue", "balance"] as const;
export type Show = (typeof SHOWS)[number];
export interface ListFilters {
  tab: StatusTab;
  show: Show | null;
  q: string;
  sort: OrderSort;
  view: View;
}

export function filtersQuery(filters: ListFilters): string {
  const params = new URLSearchParams();
  if (filters.tab !== "active") params.set("tab", filters.tab);
  if (filters.show) params.set("show", filters.show);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.sort !== "due") params.set("sort", filters.sort);
  if (filters.view !== "list") params.set("view", filters.view);
  return params.toString();
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export function filtersFrom(params: Record<string, string | string[] | undefined>): ListFilters {
  return {
    tab: pick(params.tab, STATUS_TABS, "active"),
    show: SHOWS.includes(params.show as Show) ? (params.show as Show) : null,
    q: typeof params.q === "string" ? params.q.slice(0, 100) : "",
    sort: pick(params.sort, ORDER_SORTS, "due"),
    view: pick(params.view, VIEWS, "list"),
  };
}

// Only a query this list could have written goes back into a link
export function backQuery(value: unknown): string {
  return typeof value === "string" ? filtersQuery(filtersFrom(Object.fromEntries(new URLSearchParams(value)))) : "";
}
