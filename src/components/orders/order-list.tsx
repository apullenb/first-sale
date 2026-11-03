"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { progressTrackedOrder } from "@/app/(app)/orders/tracking-actions";
import { Icon } from "@/components/icons";
import { useLocalToday } from "@/components/operations/live";
import { INPUT, SECONDARY } from "@/components/styles";
import {
  dateText,
  inTab,
  laterSteps,
  nextStep,
  orderAttention,
  ORDER_SORTS,
  type OrderSort,
  relativeDays,
  SORT_TEXT,
  sortOrders,
  STATUS_TABS,
  statusText,
  stepAction,
  TAB_TEXT,
  timeText,
  tabOf,
} from "@/lib/rules/order-tracking";
import { dollars } from "@/lib/rules/products";
import { filtersQuery, type ListFilters, type Show, VIEWS } from "./filters";
import { balanceOf, DemoChip, Due, type OrderRow, SourceIcon, Status, StatusChip, totalOf, useRun, whatOf } from "./shared";

const matches = (order: OrderRow, query: string) =>
  `${order.customerName} ${order.customerEmail} ${order.customerPhone} ${order.title} ${order.lines.map((line) => line.name).join(" ")}`
    .toLowerCase()
    .includes(query.trim().toLowerCase());

export function OrderList({ orders, today: serverToday, initial }: { orders: OrderRow[]; today: string; initial: ListFilters }) {
  const today = useLocalToday(serverToday);
  const router = useRouter();
  const [filters, setFilters] = useState(initial);
  const { pending, message, run } = useRun();
  const query = filtersQuery(filters);
  useEffect(() => {
    window.history.replaceState(null, "", query ? `/orders?${query}` : "/orders");
  }, [query]);
  const set = (patch: Partial<ListFilters>) => setFilters((prior) => ({ ...prior, ...patch }));

  const searched = useMemo(() => orders.filter((order) => matches(order, filters.q)), [orders, filters.q]);
  const shown = (order: OrderRow) => {
    if (!filters.show) return true;
    if (filters.show === "balance") return (balanceOf(order) ?? 0) > 0;
    return orderAttention(order, today) === filters.show;
  };
  const visible = sortOrders(
    searched.filter((order) => inTab(order.status, filters.tab) && shown(order)),
    filters.sort,
  );
  const tiles: { key: "review" | Show; label: string; value: string; on: boolean }[] = [
    { key: "review", label: "Needs review", value: String(orders.filter((order) => tabOf(order.status) === "review").length), on: filters.tab === "review" && !filters.show },
    { key: "today", label: "Due today", value: String(orders.filter((order) => orderAttention(order, today) === "today").length), on: filters.show === "today" },
    { key: "overdue", label: "Overdue", value: String(orders.filter((order) => orderAttention(order, today) === "overdue").length), on: filters.show === "overdue" },
    { key: "balance", label: "Balance owed", value: dollars(orders.reduce((sum, order) => sum + (balanceOf(order) ?? 0), 0)), on: filters.show === "balance" },
  ];
  const href = (order: OrderRow) => `/orders/${order.id}${query ? `?back=${encodeURIComponent(query)}` : ""}`;
  const move = (order: OrderRow, status: OrderRow["status"]) => run(() => progressTrackedOrder({ id: order.id, status }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            aria-pressed={tile.on}
            className={`rounded-xl border p-4 text-left shadow-soft transition hover:border-accent ${tile.on ? "border-accent bg-accent-tint" : "border-line bg-surface"}`}
            onClick={() =>
              tile.on
                ? set({ tab: "active", show: null })
                : tile.key === "review"
                  ? set({ tab: "review", show: null })
                  : set({ tab: "active", show: tile.key })
            }
          >
            <span className="block text-sm text-muted">{tile.label}</span>
            <strong className={`mt-1 block text-2xl ${tile.key === "overdue" && tile.value !== "0" ? "text-danger" : ""}`}>{tile.value}</strong>
          </button>
        ))}
      </div>

      <section aria-label="Your orders" className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line px-4 pt-4 sm:px-5">
          {filters.view !== "board" ? (
            <div role="tablist" aria-label="Status" className="-mx-1 flex gap-1 overflow-x-auto">
              {STATUS_TABS.map((tab) => {
                const count = searched.filter((order) => inTab(order.status, tab)).length;
                const on = filters.tab === tab;
                return (
                  <button
                    key={tab}
                    role="tab"
                    type="button"
                    aria-selected={on}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-2.5 font-semibold ${on ? "border-accent text-accent-ink" : "border-transparent text-muted hover:text-ink"}`}
                    onClick={() => set({ tab, show: null })}
                  >
                    {TAB_TEXT[tab]}
                    <span className={`rounded-md px-1.5 text-xs ${on ? "bg-accent-tint" : "bg-wash"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-3 pb-4">
            <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-semibold">
              Search
              <span className="relative">
                <Icon name="search" size="sm" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
                <input type="search" placeholder="Customer, item or note" className={`${INPUT} pl-9`} value={filters.q} onChange={(event) => set({ q: event.target.value })} />
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Sort by
              <select className={INPUT} value={filters.sort} onChange={(event) => set({ sort: event.target.value as OrderSort })}>
                {ORDER_SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {SORT_TEXT[sort]}
                  </option>
                ))}
              </select>
            </label>
            <div role="group" aria-label="View" className="flex rounded-[10px] border border-line-strong bg-surface p-0.5">
              {VIEWS.map((view) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={filters.view === view}
                  className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${filters.view === view ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
                  onClick={() => set({ view })}
                >
                  {view === "list" ? "List" : view === "board" ? "Board" : "Schedule"}
                </button>
              ))}
            </div>
          </div>
          {filters.show ? (
            <p className="-mt-2 flex items-center gap-2 pb-3 text-sm">
              Showing only {filters.show === "today" ? "orders due today" : filters.show === "overdue" ? "overdue orders" : "orders with a balance owed"}
              <button type="button" className="font-semibold text-accent" onClick={() => set({ show: null })}>
                Show all
              </button>
            </p>
          ) : null}
        </div>
        <div className="px-4 pb-4 sm:px-5">
          <Status message={message} />
          {!orders.length ? (
            <p className="py-6 text-muted">No orders yet. Add your first one, upload an invoice, or try the email demo.</p>
          ) : filters.view === "board" ? (
            <Board orders={searched.filter(shown)} today={today} href={href} pending={pending} move={move} />
          ) : !visible.length ? (
            <p className="py-6 text-muted">Nothing matches. Try another tab or clear the search.</p>
          ) : filters.view === "schedule" ? (
            <Schedule orders={visible} today={today} href={href} />
          ) : (
            <Table orders={visible} today={today} href={href} pending={pending} move={move} open={(order) => router.push(href(order))} />
          )}
        </div>
      </section>
    </div>
  );
}

type Move = (order: OrderRow, status: OrderRow["status"]) => void;

function StatusControl({ order, pending, move }: { order: OrderRow; pending: boolean; move: Move }) {
  const later = laterSteps(order, order.emailSample);
  const review = tabOf(order.status) === "review" && !order.isDemo;
  if (review || !later.length || (order.isDemo && !order.emailSample)) return <StatusChip status={order.status} workType={order.workType} />;
  return (
    <select
      aria-label={`Status for ${order.customerName}`}
      data-writes
      disabled={pending}
      className="min-h-10 max-w-44 rounded-lg border border-line-strong bg-surface px-2 text-sm font-semibold"
      value={order.status}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => move(order, event.target.value as OrderRow["status"])}
    >
      <option value={order.status}>{statusText(order.status, order.workType)}</option>
      {later.map((status) => (
        <option key={status} value={status}>
          → {statusText(status, order.workType)}
        </option>
      ))}
    </select>
  );
}

const money = (cents: number | null) => (cents === null ? <span className="text-muted">—</span> : dollars(cents));

function Table({ orders, today, href, pending, move, open }: { orders: OrderRow[]; today: string; href: (order: OrderRow) => string; pending: boolean; move: Move; open: (order: OrderRow) => void }) {
  return (
    <>
      <table className="hidden w-full text-left md:table">
        <thead className="border-b border-line text-sm text-muted">
          <tr>
            <th className="py-2.5 pr-3 font-semibold">Customer</th>
            <th className="py-2.5 pr-3 font-semibold">What</th>
            <th className="py-2.5 pr-3 font-semibold">Due</th>
            <th className="py-2.5 pr-3 font-semibold">Status</th>
            <th className="py-2.5 pr-3 text-right font-semibold">Total</th>
            <th className="py-2.5 pr-3 text-right font-semibold">Balance</th>
            <th className="py-2.5 font-semibold">
              <span className="sr-only">Source</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="cursor-pointer border-b border-line align-top last:border-b-0 hover:bg-soft" onClick={() => open(order)}>
              <td className="py-3 pr-3">
                <Link href={href(order)} className="font-bold hover:text-accent" onClick={(event) => event.stopPropagation()}>
                  {order.customerName}
                </Link>
                {order.isDemo ? (
                  <span className="ml-2 align-middle">
                    <DemoChip />
                  </span>
                ) : null}
              </td>
              <td className="max-w-64 py-3 pr-3">{whatOf(order)}</td>
              <td className="py-3 pr-3 whitespace-nowrap">
                <Due order={order} today={today} />
              </td>
              <td className="py-3 pr-3">
                <StatusControl order={order} pending={pending} move={move} />
              </td>
              <td className="py-3 pr-3 text-right whitespace-nowrap">{totalOf(order) === null ? <span className="text-muted">No total yet</span> : dollars(totalOf(order)!)}</td>
              <td className="py-3 pr-3 text-right font-semibold whitespace-nowrap">{money(balanceOf(order))}</td>
              <td className="py-3">
                <SourceIcon source={order.source} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="flex flex-col gap-3 pt-2 md:hidden">
        {orders.map((order) => (
          <li key={order.id} className="rounded-xl border border-line p-3.5">
            <div className="flex items-start justify-between gap-2">
              <Link href={href(order)} className="font-bold">
                {order.customerName}
              </Link>
              <SourceIcon source={order.source} />
            </div>
            <p className="mt-1">{whatOf(order)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Due order={order} today={today} stacked={false} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusControl order={order} pending={pending} move={move} />
              {order.isDemo ? <DemoChip /> : null}
              <span className="ml-auto text-sm">
                {totalOf(order) === null ? "No total yet" : dollars(totalOf(order)!)}
                {(balanceOf(order) ?? 0) > 0 ? <strong> · {dollars(balanceOf(order)!)} owed</strong> : null}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Board({ orders, today, href, pending, move }: { orders: OrderRow[]; today: string; href: (order: OrderRow) => string; pending: boolean; move: Move }) {
  const columns = STATUS_TABS.filter((tab) => tab !== "active" && tab !== "cancelled");
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pt-4 pb-2">
      {columns.map((column) => {
        const cards = sortOrders(orders.filter((order) => tabOf(order.status) === column), "due");
        return (
          <section key={column} aria-label={TAB_TEXT[column]} className="flex w-64 shrink-0 snap-start flex-col gap-2 rounded-xl bg-wash p-2.5">
            <h3 className="flex items-center justify-between px-1 font-bold">
              {TAB_TEXT[column]} <span className="text-sm font-semibold text-muted">{cards.length}</span>
            </h3>
            {cards.map((order) => {
              const next = order.isDemo && !order.emailSample ? null : column === "review" && !order.isDemo ? null : nextStep(order, order.emailSample);
              return (
                <article key={order.id} className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface p-3 shadow-soft">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={href(order)} className="font-bold hover:text-accent">
                      {order.customerName}
                    </Link>
                    {order.isDemo ? <DemoChip /> : null}
                  </div>
                  <p className="text-sm">{whatOf(order)}</p>
                  <div className="text-sm">
                    <Due order={order} today={today} stacked={false} />
                  </div>
                  {next ? (
                    <button type="button" data-writes disabled={pending} className={`${SECONDARY} mt-1 min-h-9 text-sm`} onClick={() => move(order, next)}>
                      {stepAction(next, order.workType)}
                      <Icon name="arrow" size="xs" />
                    </button>
                  ) : column === "review" && !order.isDemo ? (
                    <Link href={href(order)} className="mt-1 text-sm font-semibold text-accent">
                      Review
                    </Link>
                  ) : null}
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function Schedule({ orders, today, href }: { orders: OrderRow[]; today: string; href: (order: OrderRow) => string }) {
  const dates = [...new Set(sortOrders(orders, "due").map((order) => order.requestedDate))];
  return (
    <div className="flex flex-col gap-5 pt-4">
      {dates.map((date) => (
        <section key={date ?? "none"} aria-label={date ? dateText(date, today) : "No due date"}>
          <h3 className="mb-2 flex items-baseline gap-2 font-bold">
            {date ? dateText(date, today) : "No due date"}
            {date ? <span className={`text-sm font-semibold ${date < today ? "text-danger" : "text-muted"}`}>{relativeDays(date, today)}</span> : null}
          </h3>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {sortOrders(
              orders.filter((order) => order.requestedDate === date),
              "due",
            ).map((order) => (
              <li key={order.id}>
                <Link href={href(order)} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3 hover:bg-soft">
                  <span className="w-16 text-sm font-semibold text-muted">{timeText(order.jobTime) || "Any time"}</span>
                  <strong>{order.customerName}</strong>
                  <span className="min-w-0 flex-1">{whatOf(order)}</span>
                  {order.isDemo ? <DemoChip /> : null}
                  <StatusChip status={order.status} workType={order.workType} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
