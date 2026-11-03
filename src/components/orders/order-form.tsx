"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createOrderAction } from "@/app/(app)/orders/actions";
import { Card, Note } from "@/components/ui";
import { INPUT, PRIMARY, SECONDARY_LINK } from "@/components/styles";
import { FULFILLMENT_METHODS, type FulfillmentMethod } from "@/lib/domain";
import { type Customer, matchCustomers } from "@/lib/rules/customers";
import { checkDraft, type DraftLine, MAX_LINE_CENTS } from "@/lib/rules/order-lines";
import { FULFILLMENT_TEXT, LOCATION_TEXT, WORK_TEXT, WORK_TYPES, type WorkType } from "@/lib/rules/order-tracking";
import { dollars } from "@/lib/rules/products";
import { parseDollars } from "@/lib/website/site/design";
import { LineEditor } from "./line-editor";
import { Field, nounOf, type OrderableItem, Status, useRun } from "./shared";

export interface OrderDraft {
  id?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  workType: WorkType;
  title: string;
  fulfillment: FulfillmentMethod;
  requestedDate: string;
  jobTime: string;
  location: string;
  notes: string;
  lines: DraftLine[];
}

export function OrderForm({
  items,
  customers,
  initial,
  review,
  today,
}: {
  items: OrderableItem[];
  customers: Customer[];
  initial: OrderDraft;
  // Imported details to check before confirming
  review?: { warnings: string[] } | null;
  today: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [suggest, setSuggest] = useState(false);
  const [deposit, setDeposit] = useState({ on: false, amount: "", paidOn: today, note: "" });
  const { pending, message, run } = useRun();
  const checked = useMemo(() => checkDraft(form.lines, items), [form.lines, items]);
  const matches = suggest ? matchCustomers(customers, form.customerName) : [];
  const noun = nounOf(form.workType);
  const set = <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => setForm((prior) => ({ ...prior, [key]: value }));

  function save() {
    const depositCents = deposit.on ? parseDollars(deposit.amount, MAX_LINE_CENTS) : null;
    run(
      async () => {
        if (checked.error) return { ok: false, message: checked.error };
        if (deposit.on && !depositCents) return { ok: false, message: "Type the deposit in dollars and cents, or untick it." };
        return createOrderAction({
          ...form,
          requestKey,
          lines: checked.lines,
          deposit: deposit.on && depositCents ? { amountCents: depositCents, paidOn: deposit.paidOn, note: deposit.note } : null,
        });
      },
      (result) => {
        if (result.ok && result.id) router.push(`/orders/${result.id}`);
      },
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {review ? (
        <Note>
          Check these details against the customer’s message, then confirm. Imported items and dates are suggestions; payments and stock
          don’t change until you confirm.
          {review.warnings.length ? (
            <ul className="mt-2 list-disc pl-5">
              {review.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </Note>
      ) : null}
      <Card title="Customer" id="order-customer">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="relative">
            <Field label="Name">
              <input
                required
                maxLength={80}
                autoComplete="off"
                className={INPUT}
                value={form.customerName}
                onFocus={() => setSuggest(true)}
                onBlur={() => setTimeout(() => setSuggest(false), 150)}
                onChange={(event) => {
                  set("customerName", event.target.value);
                  setSuggest(true);
                }}
              />
            </Field>
            {matches.length ? (
              <ul aria-label="Past customers" className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-[10px] border border-line bg-surface shadow-lift">
                {matches.map((customer) => (
                  <li key={customer.key}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-accent-tint"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setForm((prior) => ({ ...prior, customerName: customer.name, customerEmail: customer.email, customerPhone: customer.phone }));
                        setSuggest(false);
                      }}
                    >
                      <span className="font-semibold">{customer.name}</span>
                      <span className="text-sm text-muted">
                        {[customer.email, customer.phone].filter(Boolean).join(" · ") || `${customer.orders} past orders`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Field label="Email (optional)">
            <input type="email" maxLength={254} className={INPUT} value={form.customerEmail} onChange={(event) => set("customerEmail", event.target.value)} />
          </Field>
          <Field label="Phone (optional)">
            <input type="tel" maxLength={40} className={INPUT} value={form.customerPhone} onChange={(event) => set("customerPhone", event.target.value)} />
          </Field>
        </div>
      </Card>
      <Card title="Items" id="order-items">
        {!items.length ? (
          <p className="text-sm text-muted">
            Add custom lines here, or{" "}
            <Link href="/products" className="font-semibold text-accent">
              save your products and services
            </Link>{" "}
            to pick them with their prices and stock.
          </p>
        ) : null}
        <LineEditor items={items} lines={form.lines} checked={checked} onChange={(lines) => set("lines", lines)} />
        <p className="text-sm text-muted">Saved items use their saved price. Counted stock is taken once, when you save.</p>
      </Card>
      <Card title="When and where" id="order-when">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due date">
            <input type="date" className={INPUT} value={form.requestedDate} onChange={(event) => set("requestedDate", event.target.value)} />
          </Field>
          <Field label="Time (optional)">
            <input type="time" className={INPUT} value={form.jobTime} onChange={(event) => set("jobTime", event.target.value)} />
          </Field>
          <Field label="How it’s handed over">
            <select className={INPUT} value={form.fulfillment} onChange={(event) => set("fulfillment", event.target.value as FulfillmentMethod)}>
              {FULFILLMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {FULFILLMENT_TEXT[method]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={LOCATION_TEXT[form.fulfillment]}>
            <input maxLength={300} className={INPUT} value={form.location} onChange={(event) => set("location", event.target.value)} />
          </Field>
          <Field label="Kind of work" hint="Sets the steps it moves through.">
            <select className={INPUT} value={form.workType} onChange={(event) => set("workType", event.target.value as WorkType)}>
              {WORK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {WORK_TEXT[type]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>
      <Card title="Notes and payment" id="order-notes">
        <Field label="Notes (optional)">
          <textarea rows={3} maxLength={3000} className={INPUT} value={form.notes} onChange={(event) => set("notes", event.target.value)} />
        </Field>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" className="size-5" checked={deposit.on} onChange={(event) => setDeposit({ ...deposit, on: event.target.checked })} />
          Record a deposit already received
        </label>
        {deposit.on ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Deposit ($)" hint={checked.totalCents === null ? "Needs a total, so give every line a price." : `Up to ${dollars(checked.totalCents)}`}>
              <input inputMode="decimal" className={INPUT} value={deposit.amount} onChange={(event) => setDeposit({ ...deposit, amount: event.target.value })} />
            </Field>
            <Field label="Received on">
              <input type="date" className={INPUT} value={deposit.paidOn} onChange={(event) => setDeposit({ ...deposit, paidOn: event.target.value })} />
            </Field>
            <Field label="Method (optional)">
              <input maxLength={300} placeholder="Cash, Venmo…" className={INPUT} value={deposit.note} onChange={(event) => setDeposit({ ...deposit, note: event.target.value })} />
            </Field>
            <p className="text-sm text-muted sm:col-span-3">Records money you already have. Nothing is charged.</p>
          </div>
        ) : null}
      </Card>
      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-ground/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Status message={message} />
        <div className="flex flex-wrap items-center gap-3">
          <button className={PRIMARY} disabled={pending}>
            {pending ? "Saving…" : review ? `Confirm ${noun}` : `Save ${noun}`}
          </button>
          <span className="font-semibold">
            Total: {checked.totalCents === null ? "No total yet" : dollars(checked.totalCents)}
          </span>
          <Link href="/orders" className={`${SECONDARY_LINK} ml-auto`}>
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
