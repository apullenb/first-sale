"use client";
import { useLocalToday } from "./live";
import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelOrderAction } from "@/app/(app)/orders/actions";
import {
  progressTrackedOrder,
  recordTrackedPayment,
  scheduleTrackedOrder,
  setTrackedTotal,
} from "@/app/(app)/orders/tracking-actions";
import { Card, Chip } from "@/components/ui";
import { INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { PracticeBanner } from "@/components/practice-banner";
import { dollars, variantLabel } from "@/lib/rules/products";
import { parseDollars } from "@/lib/website/site/design";
import { orderTotalCents } from "@/lib/rules/inventory";
import {
  orderAttention,
  paymentSummary,
  statusText,
  statusesFor,
  type TrackingStatus,
  type WorkType,
  MAX_ORDER_CENTS,
} from "@/lib/rules/order-tracking";
import type { OrderView } from "@/lib/data/orders";
import { Field, OrderEditor, type OrderableItem } from "./order-editor";
import { RequestImport, type InboxMessage } from "./inbox";

export type { OrderableItem } from "./order-editor";
export type OrderRow = Omit<OrderView, "createdAt" | "events"> & {
  createdAt: string;
  events: { summary: string; createdAt: string }[];
};
export function lineName(name: string, values: readonly string[]) {
  return values.length ? `${name} (${variantLabel(values)})` : name;
}
export function OrdersPanel({
  items,
  orders,
  workType,
  messages,
  today: serverToday,
  initialOrder,
}: {
  items: OrderableItem[];
  orders: OrderRow[];
  workType: WorkType;
  messages: InboxMessage[];
  today: string;
  initialOrder?: string;
}) {
  const today = useLocalToday(serverToday);
  const [adding, setAdding] = useState<"manual" | "import" | null>(null),
    [filter, setFilter] = useState("active"),
    [query, setQuery] = useState(""),
    [view, setView] = useState("list"),
    [selectedId, setSelectedId] = useState<string | null>(initialOrder ?? null);
  const [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  const selected = orders.find((order) => order.id === selectedId);
  const totalOf = (order: OrderRow) =>
    order.totalCents ??
    (order.lines.length ? orderTotalCents(order.lines) : null);
  const visible = orders
    .filter((order) => {
      const attention = orderAttention(order, today),
        summary = paymentSummary(totalOf(order), order.payments);
      return (
        `${order.customerName} ${order.title} ${order.customerEmail}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (filter === "all" ||
          (filter === "active" && attention !== "closed") ||
          filter === attention ||
          (filter === "balance" &&
            order.status !== "cancelled" &&
            (summary.balance ?? 0) > 0))
      );
    })
    .sort((a, b) =>
      (a.requestedDate ?? "9999").localeCompare(b.requestedDate ?? "9999"),
    );
  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    start(async () => {
      try {
        setMessage((await action()).message);
      } catch {
        setMessage("Could not save this change. Try again.");
      }
    });
  }
  const balance = orders
    .filter(
      (order) =>
        order.status !== "cancelled" &&
        !["new", "needs_review"].includes(order.status),
    )
    .reduce(
      (sum, order) =>
        sum + (paymentSummary(totalOf(order), order.payments).balance ?? 0),
      0,
    );
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [
            "Needs review",
            orders.filter((order) => orderAttention(order, today) === "review")
              .length,
            "review",
          ],
          [
            "Due today",
            orders.filter((order) => orderAttention(order, today) === "today")
              .length,
            "today",
          ],
          [
            "Overdue",
            orders.filter((order) => orderAttention(order, today) === "overdue")
              .length,
            "overdue",
          ],
          ["Balance owed", dollars(balance), "balance"],
        ].map(([label, value, key]) => (
          <button
            key={key}
            className="rounded-xl border border-line bg-surface p-4 text-left hover:border-accent"
            onClick={() => setFilter(String(key))}
          >
            <span className="block text-sm text-muted">{label}</span>
            <strong className="mt-1 block text-2xl">{value}</strong>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          className={PRIMARY}
          onClick={() => setAdding(adding === "manual" ? null : "manual")}
        >
          Add {workType === "services" ? "job" : "order"}
        </button>
        <button
          className={SECONDARY}
          onClick={() => setAdding(adding === "import" ? null : "import")}
        >
          Upload invoice or email
        </button>
        <Link className={SECONDARY} href="/email">
          Customer email
        </Link>
      </div>
      {adding ? (
        <Card
          title={
            adding === "manual"
              ? workType === "services"
                ? "New service job"
                : "New order"
              : "Import a customer request"
          }
          id="add-work"
          action={
            <button
              className="font-semibold text-accent"
              onClick={() => setAdding(null)}
            >
              Close
            </button>
          }
        >
          {adding === "manual" ? (
            <OrderEditor
              items={items}
              workType={workType}
              onDone={() => {
                setAdding(null);
                setMessage(
                  "Saved. Open the record below to record payment or update progress.",
                );
              }}
            />
          ) : (
            <RequestImport />
          )}
        </Card>
      ) : null}
      <p role="status" aria-live="polite" className="text-sm text-accent">
        {message}
      </p>
      {selected ? (
        <Card
          title={selected.title || `Order for ${selected.customerName}`}
          id="selected-order"
          action={
            <button
              className="font-semibold text-accent"
              onClick={() => setSelectedId(null)}
            >
              Close
            </button>
          }
        >
          <OrderDetails
            key={`${selected.id}:${selected.status}`}
            order={selected}
            items={items}
            messages={messages.filter((entry) => entry.orderId === selected.id)}
            today={today}
            pending={pending}
            run={run}
          />
        </Card>
      ) : null}
      <Card
        title={workType === "services" ? "Your jobs" : "Orders & jobs"}
        id="your-orders"
      >
        <div className="flex flex-wrap gap-3">
          <Field label="Search customers or work">
            <input
              type="search"
              className={INPUT}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
          <Field label="Show">
            <select
              className={INPUT}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              {[
                ["active", "Active"],
                ["review", "Needs review"],
                ["today", "Due today"],
                ["overdue", "Overdue"],
                ["upcoming", "Upcoming"],
                ["balance", "Balance owed"],
                ["closed", "Completed / cancelled"],
                ["all", "All"],
              ].map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="View">
            <select
              className={INPUT}
              value={view}
              onChange={(event) => setView(event.target.value)}
            >
              <option value="list">List</option>
              <option value="board">Board</option>
              <option value="calendar">Schedule</option>
            </select>
          </Field>
        </div>
        {visible.length ? (
          view === "board" ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[
                "needs_review",
                "confirmed",
                "in_progress",
                "ready",
                "shipped",
                "fulfilled",
                "cancelled",
              ]
                .filter((status) =>
                  visible.some(
                    (order) =>
                      (order.status === "new"
                        ? "needs_review"
                        : order.status) === status,
                  ),
                )
                .map((status) => (
                  <section key={status} className="min-w-60 flex-1">
                    <h3 className="mb-3 font-bold">
                      {statusText(status as TrackingStatus, workType)}
                    </h3>
                    <div className="flex flex-col gap-3">
                      {visible
                        .filter(
                          (order) =>
                            (order.status === "new"
                              ? "needs_review"
                              : order.status) === status,
                        )
                        .map(renderOrder)}
                    </div>
                  </section>
                ))}
            </div>
          ) : view === "calendar" ? (
            <div className="flex flex-col gap-5">
              {[
                ...new Set(
                  visible.map((order) => order.requestedDate ?? "Unscheduled"),
                ),
              ].map((date) => (
                <section key={date}>
                  <h3 className="mb-3 font-bold">{date}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {visible
                      .filter(
                        (order) =>
                          (order.requestedDate ?? "Unscheduled") === date,
                      )
                      .map(renderOrder)}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {visible.map(renderOrder)}
            </div>
          )
        ) : (
          <p className="py-5 text-muted">
            {orders.length
              ? "No records match this view."
              : "Your orders and jobs will appear here. Add one, upload an invoice, or connect your customer email."}
          </p>
        )}
      </Card>
    </div>
  );
  function renderOrder(order: OrderRow) {
    const summary = paymentSummary(totalOf(order), order.payments),
      attention = orderAttention(order, today);
    return (
      <button
        key={order.id}
        className={`flex flex-col gap-2 rounded-xl border p-4 text-left hover:border-accent ${selectedId === order.id ? "border-accent bg-accent-tint" : "border-line bg-surface"}`}
        onClick={() => setSelectedId(order.id)}
      >
        <div className="flex flex-wrap items-center gap-2">
          <strong>{order.customerName}</strong>
          {order.isDemo ? <Chip tone="warn">DEMO</Chip> : null}
          <Chip
            tone={
              attention === "review" || attention === "overdue"
                ? "warn"
                : "gray"
            }
          >
            {statusText(order.status, order.workType)}
          </Chip>
        </div>
        <span>
          {order.title ||
            order.lines
              .map((line) => lineName(line.name, line.values))
              .join(", ")}
        </span>
        <span className="text-sm text-muted">
          {order.requestedDate
            ? `${attention === "overdue" ? "Overdue · " : ""}${order.requestedDate}${order.jobTime ? ` at ${order.jobTime}` : ""}`
            : "Date to confirm"}
        </span>
        <span className="text-sm">
          {summary.status} ·{" "}
          {summary.balance === null
            ? "Total to confirm"
            : `${dollars(summary.paid)} paid · ${dollars(summary.balance)} owed`}
        </span>
        <span className="text-xs text-muted">
          {order.source === "manual"
            ? "Entered manually"
            : order.source === "invoice"
              ? "From invoice"
              : "From email"}
        </span>
      </button>
    );
  }
}
function OrderDetails({
  order,
  items,
  messages,
  today,
  pending,
  run,
}: {
  order: OrderRow;
  items: OrderableItem[];
  messages: InboxMessage[];
  today: string;
  pending: boolean;
  run: (action: () => Promise<{ ok: boolean; message: string }>) => void;
}) {
  const [agreed, setAgreed] = useState(
    order.totalCents === null ? "" : (order.totalCents / 100).toFixed(2),
  );
  const [payment, setPayment] = useState(""),
    [kind, setKind] = useState<"payment" | "refund">("payment"),
    [paidOn, setPaidOn] = useState(today),
    [note, setNote] = useState(""),
    [paymentKey, setPaymentKey] = useState(() => crypto.randomUUID());
  const [date, setDate] = useState(order.requestedDate ?? ""),
    [time, setTime] = useState(order.jobTime),
    [location, setLocation] = useState(order.location);
  const total =
      order.totalCents ??
      (order.lines.length ? orderTotalCents(order.lines) : null),
    summary = paymentSummary(total, order.payments);
  const review = order.status === "needs_review" || order.status === "new";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Chip>{statusText(order.status, order.workType)}</Chip>
        <Chip tone="gray">{summary.status}</Chip>
      </div>
      <p>
        {order.customerName}
        {order.customerEmail ? ` · ${order.customerEmail}` : ""}
        {order.customerPhone ? ` · ${order.customerPhone}` : ""}
      </p>
      {order.isDemo ? (
        <PracticeBanner what="This sample record cannot change real stock or payments." />
      ) : null}
      {review && !order.isDemo ? (
        <OrderEditor
          items={items}
          workType={order.workType}
          order={order}
          extraction={messages.find((entry) => entry.extraction)?.extraction}
          onDone={() => {}}
        />
      ) : (
        <>
          {order.lines.length ? (
            <ul className="list-disc pl-5">
              {order.lines.map((line, index) => (
                <li key={index}>
                  {line.quantity} × {lineName(line.name, line.values)}
                  {line.unitPriceCents === null
                    ? ""
                    : ` · ${dollars(line.unitPriceCents)} each`}
                </li>
              ))}
            </ul>
          ) : null}
          {order.notes ? (
            <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
          ) : null}
          <dl className="grid grid-cols-3 gap-3 rounded-xl bg-wash p-4">
            {[
              ["Total", total === null ? "To confirm" : dollars(total)],
              ["Paid", dollars(summary.paid)],
              [
                "Balance owed",
                summary.balance === null
                  ? "To confirm"
                  : dollars(summary.balance),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          {summary.refunded ? (
            <p className="text-sm text-muted">
              Refunded: {dollars(summary.refunded)}
            </p>
          ) : null}
          {!order.isDemo ? (
            <>
              <div className="flex flex-wrap gap-2">
                {statusesFor(order.workType, order.fulfillment)
                  .slice(
                    statusesFor(order.workType, order.fulfillment).indexOf(
                      order.status,
                    ) + 1,
                  )
                  .filter(() => order.status !== "cancelled")
                  .map((status) => (
                    <button
                      data-writes
                      key={status}
                      disabled={pending}
                      className={SECONDARY}
                      onClick={() =>
                        run(() =>
                          progressTrackedOrder({ id: order.id, status }),
                        )
                      }
                    >
                      Mark {statusText(status, order.workType).toLowerCase()}
                    </button>
                  ))}
              </div>
              {(!order.lines.length || order.totalCents === null) &&
              order.status !== "cancelled" ? (
                <details>
                  <summary className="cursor-pointer font-semibold text-accent">
                    Set or change agreed total
                  </summary>
                  <form
                    className="mt-3 flex flex-col gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      run(() =>
                        setTrackedTotal({
                          id: order.id,
                          totalCents: parseDollars(agreed, MAX_ORDER_CENTS),
                        }),
                      );
                    }}
                  >
                    <Field label="Agreed total ($)">
                      <input
                        className={INPUT}
                        inputMode="decimal"
                        required
                        value={agreed}
                        onChange={(event) => setAgreed(event.target.value)}
                      />
                    </Field>
                    <button className={`${SECONDARY} w-fit`} disabled={pending}>
                      Save agreed total
                    </button>
                  </form>
                </details>
              ) : null}
              <details>
                <summary className="cursor-pointer font-semibold text-accent">
                  Record payment or refund
                </summary>
                <form
                  className="mt-3 grid gap-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const amountCents = parseDollars(payment, MAX_ORDER_CENTS);
                    run(async () => {
                      const result = await recordTrackedPayment({
                        orderId: order.id,
                        requestKey: paymentKey,
                        amountCents,
                        kind,
                        paidOn,
                        note,
                      });
                      if (result.ok) {
                        setPayment("");
                        setNote("");
                        setPaymentKey(crypto.randomUUID());
                      }
                      return result;
                    });
                  }}
                >
                  <Field label="Type">
                    <select
                      className={INPUT}
                      value={kind}
                      onChange={(event) =>
                        setKind(event.target.value as typeof kind)
                      }
                    >
                      <option value="payment">Payment received</option>
                      <option value="refund">Refund given</option>
                    </select>
                  </Field>
                  <Field label="Amount ($)">
                    <input
                      required
                      inputMode="decimal"
                      className={INPUT}
                      value={payment}
                      onChange={(event) => {
                        setPayment(event.target.value);
                        setPaymentKey(crypto.randomUUID());
                      }}
                    />
                  </Field>
                  <Field label="Date received or refunded">
                    <input
                      required
                      type="date"
                      className={INPUT}
                      value={paidOn}
                      onChange={(event) => setPaidOn(event.target.value)}
                    />
                  </Field>
                  <Field label="Method / reference (optional)">
                    <input
                      maxLength={300}
                      className={INPUT}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </Field>
                  <p className="text-sm text-muted sm:col-span-2">
                    Records money already received or refunded. This does not
                    charge a card or move money.
                  </p>
                  <button
                    className={PRIMARY}
                    disabled={pending || !payment.trim()}
                  >
                    Save payment record
                  </button>
                </form>
              </details>
              {!["fulfilled", "cancelled"].includes(order.status) ? (
                <details>
                  <summary className="cursor-pointer font-semibold text-accent">
                    Change schedule
                  </summary>
                  <form
                    className="mt-3 grid gap-3 sm:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      run(() =>
                        scheduleTrackedOrder({
                          id: order.id,
                          requestedDate: date,
                          jobTime: time,
                          location,
                        }),
                      );
                    }}
                  >
                    <Field
                      label={
                        order.workType === "services" ? "Job date" : "Due date"
                      }
                    >
                      <input
                        type="date"
                        className={INPUT}
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                      />
                    </Field>
                    <Field label="Time (local to the business)">
                      <input
                        type="time"
                        className={INPUT}
                        value={time}
                        onChange={(event) => setTime(event.target.value)}
                      />
                    </Field>
                    <Field label="Location">
                      <input
                        maxLength={300}
                        className={INPUT}
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                      />
                    </Field>
                    <button className={SECONDARY} disabled={pending}>
                      Save schedule
                    </button>
                  </form>
                </details>
              ) : null}
            </>
          ) : null}
        </>
      )}
      {messages.map((entry) => (
        <details key={entry.id}>
          <summary className="cursor-pointer font-semibold text-accent">
            {entry.subject} ·{" "}
            {entry.state === "ready"
              ? "Source & extracted details"
              : entry.state}
          </summary>
          <p className="my-2 whitespace-pre-wrap break-words text-sm">
            {entry.body}
          </p>
          {entry.documentId ? (
            <Link
              href={`/documents/${entry.documentId}/file`}
              className="font-semibold text-accent"
            >
              Download original
            </Link>
          ) : null}
          {entry.extraction ? (
            <>
              <ul className="list-disc pl-5 text-sm text-muted">
                {entry.extraction.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                {Object.entries(entry.extraction.evidence).map(
                  ([field, excerpt]) => (
                    <div key={field}>
                      <dt className="font-semibold">{field}</dt>
                      <dd className="text-muted">“{excerpt}”</dd>
                    </div>
                  ),
                )}
              </dl>
            </>
          ) : null}
        </details>
      ))}
      <details>
        <summary className="cursor-pointer font-semibold text-accent">
          History
        </summary>
        <ol className="mt-2 flex flex-col gap-2 text-sm text-muted">
          {order.events.map((event, index) => (
            <li key={index}>
              <time dateTime={event.createdAt}>
                {event.createdAt.slice(0, 16).replace("T", " ")} UTC
              </time>{" "}
              · {event.summary}
            </li>
          ))}
        </ol>
      </details>
      {!order.isDemo &&
      !["cancelled", "fulfilled", "shipped"].includes(order.status) ? (
        <details>
          <summary className="cursor-pointer font-semibold text-check">
            Cancel this {order.workType === "services" ? "job" : "order"}
          </summary>
          <p className="my-2 text-sm text-muted">
            Restores counted stock once. Payments are kept; record any refund
            separately.
          </p>
          <button
            data-writes
            className={SECONDARY}
            disabled={pending}
            onClick={() => run(() => cancelOrderAction({ orderId: order.id }))}
          >
            Confirm cancellation
          </button>
        </details>
      ) : null}
    </div>
  );
}
