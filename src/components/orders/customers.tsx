"use client";
import Link from "next/link";
import { Fragment, useState } from "react";
import { Icon } from "@/components/icons";
import { useLocalToday } from "@/components/operations/live";
import { INPUT, SECONDARY_LINK } from "@/components/styles";
import type { Customer } from "@/lib/rules/customers";
import { dateText, sortOrders } from "@/lib/rules/order-tracking";
import { dollars } from "@/lib/rules/products";
import { DemoChip, Due, type OrderRow, StatusChip, whatOf } from "./shared";

export function CustomerList({ customers, orders, today: serverToday }: { customers: Customer[]; orders: OrderRow[]; today: string }) {
  const today = useLocalToday(serverToday);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const shown = customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(query.trim().toLowerCase()));
  const last = (customer: Customer) => dateText(customer.lastOrderAt.slice(0, 10), today);
  const theirs = (customer: Customer) => sortOrders(orders.filter((order) => customer.orderIds.includes(order.id)), "newest");
  const contact = (customer: Customer) => [customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact saved";

  if (!customers.length) return <p className="py-6 text-muted">Customers appear here once you have orders.</p>;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-md flex-col gap-1 text-sm font-semibold">
        Search customers
        <input type="search" className={INPUT} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <table className="w-full text-left">
        <thead className="border-b border-line text-sm text-muted">
          <tr>
            <th className="py-2.5 pr-3 font-semibold">Customer</th>
            <th className="hidden py-2.5 pr-3 font-semibold md:table-cell">Contact</th>
            <th className="py-2.5 pr-3 text-right font-semibold">Orders</th>
            <th className="hidden py-2.5 pr-3 text-right font-semibold sm:table-cell">Paid</th>
            <th className="py-2.5 pr-3 text-right font-semibold">Owes</th>
            <th className="hidden py-2.5 text-right font-semibold md:table-cell">Last order</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((customer) => {
            const expanded = open === customer.key;
            return (
              <Fragment key={customer.key}>
                <tr className={`border-b border-line align-top ${expanded ? "bg-accent-tint/50" : "hover:bg-soft"}`}>
                  <td className="py-3 pr-3">
                    <button type="button" aria-expanded={expanded} className="flex items-start gap-1.5 text-left font-bold hover:text-accent" onClick={() => setOpen(expanded ? null : customer.key)}>
                      <Icon name="chevron" size="sm" className={`mt-1 shrink-0 text-faint transition-transform ${expanded ? "rotate-90" : ""}`} />
                      {customer.name}
                    </button>
                    {customer.demo ? (
                      <span className="mt-1 ml-6 block">
                        <DemoChip />
                      </span>
                    ) : null}
                    <span className="ml-6 block text-sm text-muted md:hidden">{contact(customer)}</span>
                  </td>
                  <td className="hidden py-3 pr-3 text-sm md:table-cell">{contact(customer)}</td>
                  <td className="py-3 pr-3 text-right">{customer.orders}</td>
                  <td className="hidden py-3 pr-3 text-right sm:table-cell">{dollars(customer.spentCents)}</td>
                  <td className={`py-3 pr-3 text-right font-semibold ${customer.balanceCents ? "text-check" : ""}`}>{dollars(customer.balanceCents)}</td>
                  <td className="hidden py-3 text-right whitespace-nowrap md:table-cell">{last(customer)}</td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-line bg-accent-tint/50">
                    <td colSpan={6} className="px-3 pb-4">
                      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
                        <ul className="flex flex-col divide-y divide-line" aria-label={`Orders for ${customer.name}`}>
                          {theirs(customer).map((order) => (
                            <li key={order.id}>
                              <Link href={`/orders/${order.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:text-accent">
                                <span className="min-w-0 flex-1 font-semibold">{whatOf(order)}</span>
                                <span className="text-sm">
                                  <Due order={order} today={today} stacked={false} />
                                </span>
                                <StatusChip status={order.status} workType={order.workType} />
                              </Link>
                            </li>
                          ))}
                        </ul>
                        {!customer.demo ? (
                          <Link href={`/orders/new?customer=${encodeURIComponent(customer.key)}`} className={SECONDARY_LINK}>
                            <Icon name="plus" size="sm" />
                            New order for {customer.name}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
