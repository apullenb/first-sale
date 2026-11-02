"use client";

import { useState, useTransition } from "react";
import { cancelOrderAction, recordOrderAction } from "@/app/(app)/orders/actions";
import { INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { Card, Chip } from "@/components/ui";
import { FULFILLMENT_METHODS } from "@/lib/domain";
import { orderTotalCents } from "@/lib/rules/inventory";
import { dollars, type ItemOptions, variantLabel } from "@/lib/rules/products";

export interface OrderableItem {
  id: string;
  name: string;
  kind: "product" | "service";
  priceCents: number | null;
  priceText: string;
  quantity: number | null;
  options: ItemOptions;
}

export interface OrderRow {
  id: string;
  isDemo: boolean;
  customerName: string;
  fulfillment: (typeof FULFILLMENT_METHODS)[number];
  requestedDate: string | null;
  notes: string;
  status: string;
  createdAt: string;
  lines: { productId: string; name: string; kind: "product" | "service"; priceText: string; values: string[]; quantity: number; unitPriceCents: number | null }[];
  events: { summary: string }[];
}

type Line = { productId: string; values: string[]; quantity: number };

const FULFILLMENT_LABELS: Record<OrderRow["fulfillment"], string> = { pickup: "Pickup", shipping: "Shipping", delivery: "Delivery" };
const STATUS_LABELS: Record<string, string> = { new: "New", confirmed: "Confirmed", needs_review: "Needs review", fulfilled: "Fulfilled", cancelled: "Cancelled" };

// "Candle (12 oz / Lavender)"
export function lineName(name: string, values: readonly string[]): string {
  return values.length ? `${name} (${variantLabel(values)})` : name;
}

function choiceLabel(item: OrderableItem, index: number): string {
  const variant = item.options.variants[index];
  const price = variant.priceCents ?? item.priceCents;
  return [variantLabel(variant.values), price === null ? null : dollars(price), variant.quantity === null ? null : `${variant.quantity} in stock`].filter(Boolean).join(" · ");
}

function priceOf(line: OrderRow["lines"][number]): string {
  if (line.unitPriceCents === null) return line.priceText ? `Price: ${line.priceText}` : "No price set";
  return `${dollars(line.unitPriceCents)} each · ${dollars(orderTotalCents([line]) ?? 0)}`;
}

export function OrdersPanel({ items, orders }: { items: OrderableItem[]; orders: OrderRow[] }) {
  const [customerName, setCustomerName] = useState("");
  const [fulfillment, setFulfillment] = useState<OrderRow["fulfillment"]>("pickup");
  const [requestedDate, setRequestedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [productId, setProductId] = useState(items[0]?.id ?? "");
  const [choice, setChoice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const item = items.find((each) => each.id === productId);
  const nameOf = (id: string) => items.find((each) => each.id === id)?.name ?? "Item";

  function addLine() {
    if (!item) return;
    const count = Number(quantity);
    if (!/^\d+$/.test(quantity.trim()) || count < 1) { setMessage("Type how many as a whole number."); return; }
    if (item.options.variants.length && choice === "") { setMessage(`Choose which option of ${item.name} was ordered.`); return; }
    const values = item.options.variants.length ? item.options.variants[Number(choice)].values : [];
    setLines([...lines, { productId: item.id, values, quantity: count }]);
    setChoice("");
    setQuantity("1");
    setMessage("");
  }

  function save() {
    startTransition(async () => {
      try {
        const result = await recordOrderAction({ customerName, fulfillment, requestedDate, notes, lines });
        setMessage(result.message);
        if (result.ok) { setCustomerName(""); setRequestedDate(""); setNotes(""); setLines([]); }
      } catch { setMessage("The order could not be saved. Try again."); }
    });
  }

  function cancel(orderId: string) {
    startTransition(async () => {
      try { setMessage((await cancelOrderAction({ orderId })).message); } catch { setMessage("That order could not be cancelled. Try again."); }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card title="Enter an order" id="enter-order">
        {items.length ? (
          <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); save(); }}>
            <p className="text-muted">Each option is priced and counted on its own. Saving takes stock from the option ordered.</p>
            <label className="flex flex-col gap-2 font-semibold">Customer name<input className={INPUT} required maxLength={80} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
            <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3">
              <legend className="px-1 font-semibold">Add an item</legend>
              <label className="flex flex-col gap-2 font-semibold">Item<select className={INPUT} value={productId} onChange={(event) => { setProductId(event.target.value); setChoice(""); }}>{items.map((each) => <option key={each.id} value={each.id}>{each.name}</option>)}</select></label>
              {item?.options.variants.length ? (
                <label className="flex flex-col gap-2 font-semibold">Option<select className={INPUT} value={choice} onChange={(event) => setChoice(event.target.value)}><option value="">Choose an option</option>{item.options.variants.map((variant, index) => <option key={variantLabel(variant.values)} value={String(index)}>{choiceLabel(item, index)}</option>)}</select></label>
              ) : null}
              <label className="flex flex-col gap-2 font-semibold">How many<input className={INPUT} inputMode="numeric" maxLength={7} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
              <button type="button" className={SECONDARY} onClick={addLine}>Add to order</button>
            </fieldset>
            {lines.length ? (
              <ul aria-label="In this order" className="flex flex-col gap-2">
                {lines.map((line, index) => (
                  <li key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-soft p-2">
                    <span>{line.quantity} × {lineName(nameOf(line.productId), line.values)}</span>
                    <button type="button" className="text-sm font-semibold text-accent" onClick={() => setLines(lines.filter((_, at) => at !== index))}>Remove<span className="sr-only"> {lineName(nameOf(line.productId), line.values)}</span></button>
                  </li>
                ))}
              </ul>
            ) : null}
            <label className="flex flex-col gap-2 font-semibold">How it gets to them<select className={INPUT} value={fulfillment} onChange={(event) => setFulfillment(event.target.value as OrderRow["fulfillment"])}>{FULFILLMENT_METHODS.map((method) => <option key={method} value={method}>{FULFILLMENT_LABELS[method]}</option>)}</select></label>
            <label className="flex flex-col gap-2 font-semibold">Date wanted (optional)<input className={INPUT} type="date" value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} /></label>
            <label className="flex flex-col gap-2 font-semibold">Notes (optional)<textarea className={INPUT} maxLength={300} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
            <button className={PRIMARY} disabled={pending || !lines.length}>{pending ? "Saving…" : "Save order"}</button>
          </form>
        ) : <p className="text-muted">Add your products or services first, then enter orders for them here.</p>}
      </Card>
      <p role="status" aria-live="polite" className="text-sm text-accent">{message}</p>
      <Card title="Your orders" id="your-orders">
        {orders.length ? (
          <ul className="flex flex-col gap-3">
            {orders.map((order) => {
              const total = orderTotalCents(order.lines);
              return (
                <li key={order.id} aria-label={`Order for ${order.customerName}`} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{order.customerName}</span>
                    {order.isDemo ? <Chip tone="warn">DEMO</Chip> : null}
                    <Chip tone={order.status === "cancelled" ? "gray" : "done"}>{STATUS_LABELS[order.status] ?? order.status}</Chip>
                  </div>
                  <ul aria-label="Items" className="flex flex-col gap-1">
                    {order.lines.map((line) => <li key={`${line.productId}:${variantLabel(line.values)}`}>{line.quantity} × {lineName(line.name, line.values)} · {priceOf(line)}</li>)}
                  </ul>
                  <p className="text-sm text-muted">
                    {FULFILLMENT_LABELS[order.fulfillment]}{order.requestedDate ? ` · Wanted ${order.requestedDate}` : ""}{total === null ? "" : ` · Total ${dollars(total)}`}
                  </p>
                  {order.notes ? <p className="text-sm">{order.notes}</p> : null}
                  {order.events.length ? <p className="text-sm text-muted">{order.events.map((event) => event.summary).join(" · ")}</p> : null}
                  {order.status !== "cancelled" ? <button className={`${SECONDARY} w-fit`} disabled={pending} onClick={() => cancel(order.id)}>Cancel order<span className="sr-only"> for {order.customerName}</span></button> : null}
                </li>
              );
            })}
          </ul>
        ) : <p className="text-muted">No orders yet.</p>}
      </Card>
    </div>
  );
}
