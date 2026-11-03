"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LocalDateTime } from "@/components/local-date";
import { cancelOrderAction, saveOrderDetailsAction, saveOrderLinesAction } from "@/app/(app)/orders/actions";
import { progressTrackedOrder, recordTrackedPayment, setTrackedTotal } from "@/app/(app)/orders/tracking-actions";
import { Icon } from "@/components/icons";
import { useLocalToday } from "@/components/operations/live";
import { PracticeBanner } from "@/components/practice-banner";
import { DANGER, INPUT, PRIMARY, PRIMARY_LINK, SECONDARY } from "@/components/styles";
import { Card, Chip, Note } from "@/components/ui";
import { FULFILLMENT_METHODS, type FulfillmentMethod } from "@/lib/domain";
import { checkDraft, draftOf, lineLabel, lineTotalCents, linesTotals, MAX_LINE_CENTS } from "@/lib/rules/order-lines";
import {
  FULFILLMENT_TEXT,
  laterSteps,
  LOCATION_TEXT,
  paymentSummary,
  statusText,
  stepAction,
  tabOf,
  WORK_TEXT,
} from "@/lib/rules/order-tracking";
import { dollars } from "@/lib/rules/products";
import { parseDollars } from "@/lib/website/site/design";
import { LineEditor } from "./line-editor";
import { DemoChip, Due, Field, nounOf, type OrderableItem, type OrderRow, sourceText, Status, StatusChip, totalOf, useRun } from "./shared";

export interface SourceMessage {
  id: string;
  subject: string;
  body: string;
  documentId: string | null;
}

export function OrderDetail({
  order,
  items,
  messages,
  today: serverToday,
  back,
}: {
  order: OrderRow;
  items: OrderableItem[];
  messages: SourceMessage[];
  today: string;
  back: string;
}) {
  const today = useLocalToday(serverToday);
  const { pending, message, run } = useRun();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const noun = nounOf(order.workType);
  const review = tabOf(order.status) === "review";
  const editable = !order.isDemo;
  const open = !["cancelled", "fulfilled"].includes(order.status);
  const steps = order.isDemo && !order.emailSample ? [] : review && !order.isDemo ? [] : laterSteps(order, order.emailSample);
  const [next, ...others] = steps;
  const total = totalOf(order);
  const summary = paymentSummary(total, order.payments);
  const canCancel = editable && !["cancelled", "fulfilled", "shipped"].includes(order.status);
  const move = (status: OrderRow["status"]) => run(() => progressTrackedOrder({ id: order.id, status }));

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/orders${back ? `?${back}` : ""}`} className="-mb-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-accent">
        <Icon name="back" size="sm" />
        All orders
      </Link>
      <header data-testid="order-head" className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">
            {noun === "job" ? "Job" : "Order"} · {sourceText(order.source)}
          </p>
          <h1 className="font-display text-[30px] leading-tight sm:text-[36px]">{order.customerName}</h1>
          {order.title ? <p className="text-lg text-muted">{order.title}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={order.status} workType={order.workType} />
            {!review ? <Chip tone={summary.status === "Paid" ? "done" : "gray"}>{total === null && !order.payments.length ? "No total yet" : summary.status}</Chip> : null}
            {order.isDemo ? <DemoChip /> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {review && !order.isDemo ? (
            <Link href={`/orders/new?review=${order.id}`} className={PRIMARY_LINK}>
              Review and confirm
            </Link>
          ) : next ? (
            <button type="button" data-writes disabled={pending} className={PRIMARY} onClick={() => move(next)}>
              {stepAction(next, order.workType)}
            </button>
          ) : null}
          {others.length || editable ? (
            <details className="relative">
              <summary className={`${SECONDARY} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                More
                <Icon name="chevron" size="xs" className="rotate-90" />
              </summary>
              <div className="absolute right-0 z-20 mt-1 flex w-60 flex-col overflow-hidden rounded-[10px] border border-line bg-surface py-1 shadow-lift">
                {others.map((status) => (
                  <button key={status} type="button" data-writes disabled={pending} className="px-4 py-2.5 text-left font-semibold hover:bg-wash" onClick={() => move(status)}>
                    Move to {statusText(status, order.workType)}
                  </button>
                ))}
                {editable ? (
                  <Link href={`/orders/new?copy=${order.id}`} className="px-4 py-2.5 font-semibold hover:bg-wash">
                    Duplicate {noun}
                  </Link>
                ) : null}
                {canCancel ? (
                  <button type="button" className="px-4 py-2.5 text-left font-semibold text-danger hover:bg-wash" onClick={() => setConfirmCancel(true)}>
                    Cancel {noun}…
                  </button>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      </header>
      <Status message={message} />
      {confirmCancel ? (
        <Note>
          <p>Cancel this {noun}? Counted stock it took goes back once. Payments stay recorded; record any refund separately.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" data-writes className={DANGER} disabled={pending} onClick={() => run(() => cancelOrderAction({ orderId: order.id }), () => setConfirmCancel(false))}>
              Confirm cancellation
            </button>
            <button type="button" className={SECONDARY} onClick={() => setConfirmCancel(false)}>
              Keep it
            </button>
          </div>
        </Note>
      ) : null}
      {order.emailSample ? (
        <Note icon="info">DEMO sample from the email demo. You can move it through its steps; items, payments and stock can’t change.</Note>
      ) : order.isDemo ? (
        <PracticeBanner what="This sample record cannot change real stock or payments." />
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Items order={order} items={items} editable={editable && ["confirmed", "in_progress", "ready"].includes(order.status)} />
          <Notes order={order} editable={editable} />
          {messages.length ? (
            <Card title="From the customer" id="order-source">
              {messages.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-1.5">
                  <strong>{entry.subject}</strong>
                  <p className="whitespace-pre-wrap break-words text-sm text-muted">{entry.body}</p>
                  {entry.documentId ? (
                    <Link href={`/documents/${entry.documentId}/file`} className="w-fit font-semibold text-accent">
                      Download original
                    </Link>
                  ) : null}
                </div>
              ))}
            </Card>
          ) : null}
          <Card title="History" id="order-history">
            <ol className="flex flex-col">
              {[...order.events].reverse().map((event, index) => (
                <li key={index} className="relative flex gap-3 pb-3 pl-5 before:absolute before:top-2 before:left-1 before:size-2 before:rounded-full before:bg-accent-ring last:pb-0">
                  <span className="min-w-0 flex-1">{event.summary}</span>
                  <time dateTime={event.createdAt} className="shrink-0 text-sm text-muted">
                    <LocalDateTime iso={new Date(event.createdAt).toISOString()} />
                  </time>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="flex flex-col gap-5">
          <Customer order={order} editable={editable} />
          <When order={order} today={today} editable={editable && open} />
          <Payments order={order} today={today} editable={editable && !review} />
          <p className="text-sm text-muted">Kind of work: {WORK_TEXT[order.workType]}</p>
        </div>
      </div>
    </div>
  );
}

function Items({ order, items, editable }: { order: OrderRow; items: OrderableItem[]; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftOf(order.lines));
  const usable = useMemo(() => {
    const ids = new Set(items.map((item) => item.id));
    return order.lines.every((line) => !line.productId || ids.has(line.productId));
  }, [items, order.lines]);
  const checked = useMemo(() => checkDraft(draft, items), [draft, items]);
  const { pending, message, run } = useRun();
  const totals = linesTotals(order.lines);
  const total = totalOf(order);
  return (
    <Card
      title="Items"
      id="order-items"
      action={
        editable && !editing && usable ? (
          <button type="button" className="font-semibold text-accent" onClick={() => setEditing(true)}>
            Edit items
          </button>
        ) : null
      }
    >
      {editing ? (
        <>
          <LineEditor items={items} lines={draft} checked={checked} onChange={setDraft} />
          <Status message={message} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-writes
              className={SECONDARY}
              disabled={pending}
              onClick={() =>
                run(
                  async () => (checked.error ? { ok: false, message: checked.error } : saveOrderLinesAction({ id: order.id, lines: checked.lines })),
                  (result) => result.ok && setEditing(false),
                )
              }
            >
              Save items
            </button>
            <button
              type="button"
              className="px-3 font-semibold text-muted"
              onClick={() => {
                setDraft(draftOf(order.lines));
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : order.lines.length ? (
        <>
          <Status message={message} />
          <table className="w-full text-left">
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th className="py-2 pr-3 font-semibold">Item</th>
                <th className="py-2 pr-3 text-right font-semibold">Qty</th>
                <th className="hidden py-2 pr-3 text-right font-semibold sm:table-cell">Unit price</th>
                <th className="py-2 text-right font-semibold">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id} className="border-b border-line align-top last:border-b-0">
                  <td className="py-2.5 pr-3">
                    {lineLabel(line.name, line.values)}
                    {!line.productId ? <span className="block text-sm text-muted">Custom line</span> : null}
                    <span className="block text-sm text-muted sm:hidden">{line.unitPriceCents === null ? "No price" : `${dollars(line.unitPriceCents)} each`}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-right">{line.quantity}</td>
                  <td className="hidden py-2.5 pr-3 text-right sm:table-cell">{line.unitPriceCents === null ? <span className="text-muted">No price</span> : dollars(line.unitPriceCents)}</td>
                  <td className="py-2.5 text-right font-semibold">
                    {line.unitPriceCents === null ? <span className="font-normal text-muted">—</span> : dollars(lineTotalCents(line.quantity, line.unitPriceCents)!)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-line pt-3">
            <dt className="text-muted">Subtotal</dt>
            <dd className="text-right">{dollars(totals.subtotalCents)}</dd>
            <dt className="font-bold">Total</dt>
            <dd className="text-right font-bold">{total === null ? "No total yet" : dollars(total)}</dd>
            {totals.unpriced && total !== null ? <dd className="col-span-2 text-sm text-muted">Agreed total, since some lines have no price.</dd> : null}
          </dl>
        </>
      ) : (
        <p className="text-muted">
          {order.title ? `${order.title}. ` : ""}No items listed{editable ? ". Add them so the total works itself out." : "."}
        </p>
      )}
      {editable && !usable && !editing ? <p className="text-sm text-muted">An item on this order is no longer saved, so its lines can’t be edited.</p> : null}
    </Card>
  );
}

function Notes({ order, editable }: { order: OrderRow; editable: boolean }) {
  const [notes, setNotes] = useState(order.notes);
  const { pending, message, run } = useRun();
  return (
    <Card title="Notes" id="order-notes">
      {editable ? (
        <>
          <textarea aria-label="Notes" rows={4} maxLength={3000} className={INPUT} placeholder="Allergies, colors, gate code…" value={notes} onChange={(event) => setNotes(event.target.value)} />
          {notes !== order.notes ? (
            <button type="button" data-writes disabled={pending} className={`${SECONDARY} w-fit`} onClick={() => run(() => saveOrderDetailsAction({ id: order.id, notes }))}>
              Save notes
            </button>
          ) : null}
          <Status message={message} />
        </>
      ) : (
        <p className="whitespace-pre-wrap">{order.notes || <span className="text-muted">No notes.</span>}</p>
      )}
    </Card>
  );
}

function Customer({ order, editable }: { order: OrderRow; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ customerName: order.customerName, customerEmail: order.customerEmail, customerPhone: order.customerPhone });
  const { pending, message, run } = useRun();
  return (
    <Card
      title="Customer"
      id="order-customer"
      action={
        editable && !editing ? (
          <button type="button" className="font-semibold text-accent" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null
      }
    >
      {editing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => saveOrderDetailsAction({ id: order.id, ...form }), (result) => result.ok && setEditing(false));
          }}
        >
          <Field label="Name">
            <input required maxLength={80} className={INPUT} value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" maxLength={254} className={INPUT} value={form.customerEmail} onChange={(event) => setForm({ ...form, customerEmail: event.target.value })} />
          </Field>
          <Field label="Phone">
            <input type="tel" maxLength={40} className={INPUT} value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} />
          </Field>
          <button className={`${SECONDARY} w-fit`} disabled={pending}>
            Save customer
          </button>
        </form>
      ) : (
        <>
          <strong>{order.customerName}</strong>
          {order.customerEmail || order.customerPhone ? (
            <div className="flex flex-col gap-2">
              {order.customerEmail ? (
                <a href={`mailto:${order.customerEmail}`} className="inline-flex min-h-11 items-center gap-2 break-all font-semibold text-accent">
                  <Icon name="mail" size="sm" />
                  {order.customerEmail}
                </a>
              ) : null}
              {order.customerPhone ? (
                <a href={`tel:${order.customerPhone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent">
                  <Icon name="phone" size="sm" />
                  {order.customerPhone}
                </a>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">No email or phone saved.</p>
          )}
        </>
      )}
      <Status message={message} />
    </Card>
  );
}

function When({ order, today, editable }: { order: OrderRow; today: string; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ requestedDate: order.requestedDate ?? "", jobTime: order.jobTime, fulfillment: order.fulfillment, location: order.location });
  const { pending, message, run } = useRun();
  return (
    <Card
      title="When and where"
      id="order-when"
      action={
        editable && !editing ? (
          <button type="button" className="font-semibold text-accent" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null
      }
    >
      {editing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => saveOrderDetailsAction({ id: order.id, ...form }), (result) => result.ok && setEditing(false));
          }}
        >
          <Field label="Due date">
            <input type="date" className={INPUT} value={form.requestedDate} onChange={(event) => setForm({ ...form, requestedDate: event.target.value })} />
          </Field>
          <Field label="Time (optional)">
            <input type="time" className={INPUT} value={form.jobTime} onChange={(event) => setForm({ ...form, jobTime: event.target.value })} />
          </Field>
          <Field label="How it’s handed over">
            <select className={INPUT} value={form.fulfillment} onChange={(event) => setForm({ ...form, fulfillment: event.target.value as FulfillmentMethod })}>
              {FULFILLMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {FULFILLMENT_TEXT[method]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={LOCATION_TEXT[form.fulfillment]}>
            <input maxLength={300} className={INPUT} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
          </Field>
          <button className={`${SECONDARY} w-fit`} disabled={pending}>
            Save
          </button>
        </form>
      ) : (
        <dl className="flex flex-col gap-2.5">
          <div>
            <dt className="text-sm text-muted">Due</dt>
            <dd>
              <Due order={order} today={today} />
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Handed over by</dt>
            <dd className="font-semibold">{FULFILLMENT_TEXT[order.fulfillment]}</dd>
          </div>
          {order.location ? (
            <div>
              <dt className="text-sm text-muted">{order.fulfillment === "pickup" ? "Pickup place" : order.fulfillment === "at_business" ? "Where" : "Address"}</dt>
              <dd className="whitespace-pre-wrap">{order.location}</dd>
            </div>
          ) : null}
        </dl>
      )}
      <Status message={message} />
    </Card>
  );
}

function Payments({ order, today, editable }: { order: OrderRow; today: string; editable: boolean }) {
  const total = totalOf(order);
  const summary = paymentSummary(total, order.payments);
  const [form, setForm] = useState({ kind: "payment" as "payment" | "refund", amount: "", paidOn: today, note: "" });
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [agreed, setAgreed] = useState("");
  const { pending, message, run } = useRun();
  const canSetTotal = editable && order.status !== "cancelled" && (!order.lines.length || order.totalCents === null);
  return (
    <Card title="Payments" id="order-payments">
      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-wash p-3">
        <div>
          <dt className="text-sm text-muted">Total</dt>
          <dd className="font-bold">{total === null ? "No total yet" : dollars(total)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Paid</dt>
          <dd className="font-bold">{dollars(summary.paid)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Balance</dt>
          <dd className={`font-bold ${(summary.balance ?? 0) > 0 ? "text-check" : ""}`} data-testid="order-balance">
            {summary.balance === null ? "—" : dollars(summary.balance)}
          </dd>
        </div>
      </dl>
      {summary.refunded ? <p className="text-sm text-muted">Refunded: {dollars(summary.refunded)}</p> : null}
      {order.payments.length ? (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {order.payments.map((payment) => (
            <li key={payment.id} className="flex justify-between gap-2 py-2">
              <span>
                {payment.kind === "refund" ? "Refund" : "Payment"} · {new Date(`${payment.paidOn}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                {payment.note ? <span className="block text-muted">{payment.note}</span> : null}
              </span>
              <strong>{payment.kind === "refund" ? "−" : ""}{dollars(payment.amountCents)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {canSetTotal ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const cents = parseDollars(agreed, MAX_LINE_CENTS);
            run(async () => (cents === null ? { ok: false, message: "Type the total in dollars and cents." } : setTrackedTotal({ id: order.id, totalCents: cents })));
          }}
        >
          <Field label={total === null ? "Agreed total ($)" : "Change agreed total ($)"}>
            <input inputMode="decimal" className={INPUT} value={agreed} onChange={(event) => setAgreed(event.target.value)} />
          </Field>
          <button className={SECONDARY} disabled={pending || !agreed.trim()}>
            Set
          </button>
        </form>
      ) : null}
      {editable ? (
        <form
          className="flex flex-col gap-3 border-t border-line pt-3"
          aria-label="Record a payment or refund"
          onSubmit={(event) => {
            event.preventDefault();
            const amountCents = parseDollars(form.amount, MAX_LINE_CENTS);
            run(
              async () =>
                amountCents
                  ? recordTrackedPayment({ orderId: order.id, requestKey: key, amountCents, kind: form.kind, paidOn: form.paidOn, note: form.note })
                  : { ok: false, message: "Type the amount in dollars and cents." },
              (result) => {
                if (!result.ok) return;
                setForm({ ...form, amount: "", note: "" });
                setKey(crypto.randomUUID());
              },
            );
          }}
        >
          <strong>Record a payment or refund</strong>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={INPUT} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as "payment" | "refund" })}>
                <option value="payment">Payment</option>
                <option value="refund">Refund</option>
              </select>
            </Field>
            <Field label="Amount ($)">
              <input
                inputMode="decimal"
                className={INPUT}
                value={form.amount}
                placeholder={summary.balance ? (summary.balance / 100).toFixed(2) : ""}
                onChange={(event) => {
                  setForm({ ...form, amount: event.target.value });
                  setKey(crypto.randomUUID());
                }}
              />
            </Field>
            <Field label="Date">
              <input type="date" className={INPUT} value={form.paidOn} onChange={(event) => setForm({ ...form, paidOn: event.target.value })} />
            </Field>
            <Field label="Method (optional)">
              <input maxLength={300} className={INPUT} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </Field>
          </div>
          <button className={`${SECONDARY} w-fit`} data-writes disabled={pending || !form.amount.trim()}>
            {form.kind === "refund" ? "Record refund" : "Record payment"}
          </button>
          <p className="text-sm text-muted">Records money already received or refunded. Nothing is charged.</p>
        </form>
      ) : null}
      <Status message={message} />
    </Card>
  );
}
