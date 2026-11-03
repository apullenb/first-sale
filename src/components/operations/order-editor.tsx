"use client";
import {
  useState,
  useTransition,
  useId,
  cloneElement,
  type ReactElement,
} from "react";
import { saveTrackedOrder } from "@/app/(app)/orders/tracking-actions";
import { INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { dollars, type ItemOptions, variantLabel } from "@/lib/rules/products";
import { parseDollars } from "@/lib/website/site/design";
import {
  WORK_TEXT,
  WORK_TYPES,
  type TrackingInput,
  type WorkType,
  MAX_ORDER_CENTS,
} from "@/lib/rules/order-tracking";
import type { OrderRow } from "./orders";
import type { ExtractedRequest } from "@/lib/orders/extract";

export interface OrderableItem {
  id: string;
  name: string;
  kind: "product" | "service";
  priceCents: number | null;
  priceText: string;
  quantity: number | null;
  options: ItemOptions;
}
export function OrderEditor({
  items,
  workType,
  order,
  extraction,
  onDone,
}: {
  items: OrderableItem[];
  workType: WorkType;
  order?: OrderRow;
  extraction?: ExtractedRequest | null;
  onDone: () => void;
}) {
  const matchedLines =
    extraction?.items.flatMap((line) => {
      const matches = items.filter(
        (item) =>
          item.name.toLowerCase() === line.name.toLowerCase() &&
          !item.options.variants.length,
      );
      return matches.length === 1
        ? [{ productId: matches[0].id, values: [], quantity: line.quantity }]
        : [];
    }) ?? [];
  const [form, setForm] = useState<
    Omit<TrackingInput, "requestKey" | "totalCents">
  >(() => ({
    id: order?.id,
    customerName:
      order?.customerName === "Customer to confirm"
        ? ""
        : (order?.customerName ?? ""),
    customerEmail: order?.customerEmail ?? "",
    customerPhone: order?.customerPhone ?? "",
    title: order?.title ?? "",
    workType: order?.workType ?? workType,
    fulfillment: order?.fulfillment ?? "pickup",
    requestedDate: order?.requestedDate ?? "",
    jobTime: order?.jobTime ?? "",
    location: order?.location ?? "",
    notes: order?.notes ?? "",
    lines: matchedLines,
  }));
  const [total, setTotal] = useState(
    extraction?.totalCents != null
      ? (extraction.totalCents / 100).toFixed(2)
      : "",
  );
  const [catalog, setCatalog] = useState(
      matchedLines.length > 0 ||
        (!order && workType !== "services" && items.length > 0),
    ),
    [productId, setProductId] = useState(items[0]?.id ?? ""),
    [choice, setChoice] = useState(""),
    [quantity, setQuantity] = useState("1");
  const [requestKey] = useState(() => crypto.randomUUID()),
    [message, setMessage] = useState(""),
    [pending, start] = useTransition();
  const item = items.find((entry) => entry.id === productId);
  function change<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm({ ...form, [key]: value });
  }
  function addLine() {
    if (
      !item ||
      !/^\d+$/.test(quantity) ||
      Number(quantity) < 1 ||
      Number(quantity) > 1_000_000
    ) {
      setMessage("Choose an item and enter a whole quantity.");
      return;
    }
    if (
      item.options.variants.length &&
      !item.options.variants[Number(choice)]
    ) {
      setMessage("Choose an option.");
      return;
    }
    if (item.options.variants.length && choice === "") {
      setMessage("Choose an option.");
      return;
    }
    change("lines", [
      ...form.lines,
      {
        productId,
        quantity: Number(quantity),
        values: item.options.variants[Number(choice)]?.values ?? [],
      },
    ]);
    setChoice("");
    setQuantity("1");
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const totalCents = total.trim()
            ? parseDollars(total, MAX_ORDER_CENTS)
            : null;
          if (total.trim() && totalCents === null) {
            setMessage("Enter the total in dollars and cents.");
            return;
          }
          try {
            const result = await saveTrackedOrder({
              ...form,
              requestKey,
              totalCents,
              lines: catalog ? form.lines : [],
            });
            setMessage(result.message);
            if (result.ok) onDone();
          } catch {
            setMessage("Could not save. Your entered details are still here.");
          }
        });
      }}
    >
      {extraction ? (
        <>
          <p className="text-sm text-muted">
            Check these details against the original. Imported totals are
            suggestions; accepting confirms them. Record actual payments
            separately.
          </p>
          <ul className="list-disc pl-5 text-sm text-muted">
            {extraction.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name">
          <input
            required
            maxLength={80}
            className={INPUT}
            value={form.customerName}
            onChange={(event) => change("customerName", event.target.value)}
          />
        </Field>
        <Field label="Type of work">
          <select
            className={INPUT}
            value={form.workType}
            onChange={(event) =>
              change("workType", event.target.value as WorkType)
            }
          >
            {WORK_TYPES.map((type) => (
              <option key={type} value={type}>
                {WORK_TEXT[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Customer email">
          <input
            type="email"
            maxLength={254}
            className={INPUT}
            value={form.customerEmail}
            onChange={(event) => change("customerEmail", event.target.value)}
          />
        </Field>
        <Field label="Customer phone">
          <input
            type="tel"
            maxLength={40}
            className={INPUT}
            value={form.customerPhone}
            onChange={(event) => change("customerPhone", event.target.value)}
          />
        </Field>
      </div>
      <Field
        label={
          form.workType === "services"
            ? "What is the job?"
            : "Order description"
        }
      >
        <input
          required
          maxLength={160}
          className={INPUT}
          value={form.title}
          onChange={(event) => change("title", event.target.value)}
        />
      </Field>
      {items.length ? (
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={catalog}
            onChange={(event) => setCatalog(event.target.checked)}
          />
          Use saved products or services for pricing and stock
        </label>
      ) : null}
      {catalog ? (
        <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3">
          <legend>Items ordered</legend>
          <Field label="Item">
            <select
              className={INPUT}
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                setChoice("");
              }}
            >
              {items.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                  {entry.priceCents === null
                    ? ""
                    : ` · ${dollars(entry.priceCents)}`}
                </option>
              ))}
            </select>
          </Field>
          {item?.options.variants.length ? (
            <Field label="Option">
              <select
                className={INPUT}
                value={choice}
                onChange={(event) => setChoice(event.target.value)}
              >
                <option value="">Choose option</option>
                {item.options.variants.map((variant, index) => (
                  <option key={index} value={index}>
                    {variantLabel(variant.values)}
                    {variant.quantity === null
                      ? ""
                      : ` · ${variant.quantity} in stock`}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Quantity">
            <input
              className={INPUT}
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <button type="button" className={SECONDARY} onClick={addLine}>
            Add item
          </button>
          <ul className="flex flex-col gap-2">
            {form.lines.map((line, index) => (
              <li key={index}>
                {line.quantity} ×{" "}
                {items.find((entry) => entry.id === line.productId)?.name}{" "}
                {variantLabel(line.values)}{" "}
                <button
                  type="button"
                  className="font-semibold text-accent"
                  onClick={() =>
                    change(
                      "lines",
                      form.lines.filter((_, at) => at !== index),
                    )
                  }
                >
                  Remove<span className="sr-only"> item {index + 1}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Confirmation calculates the total from saved prices and takes
            counted stock once.
          </p>
        </fieldset>
      ) : (
        <>
          <Field label="Agreed total ($, optional)">
            <input
              className={INPUT}
              inputMode="decimal"
              value={total}
              onChange={(event) => setTotal(event.target.value)}
            />
          </Field>
          <p className="text-sm text-muted">
            This custom order or job does not change inventory. Use saved items
            above when stock needs to be counted.
          </p>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={form.workType === "services" ? "Job date" : "Due date"}>
          <input
            type="date"
            className={INPUT}
            value={form.requestedDate}
            onChange={(event) => change("requestedDate", event.target.value)}
          />
        </Field>
        {form.workType === "services" ? (
          <Field label="Job time (local to the business)">
            <input
              type="time"
              className={INPUT}
              value={form.jobTime}
              onChange={(event) => change("jobTime", event.target.value)}
            />
          </Field>
        ) : (
          <Field label="Fulfillment">
            <select
              className={INPUT}
              value={form.fulfillment}
              onChange={(event) =>
                change(
                  "fulfillment",
                  event.target.value as typeof form.fulfillment,
                )
              }
            >
              <option value="pickup">Pickup</option>
              <option value="delivery">Delivery</option>
              <option value="shipping">Shipping</option>
            </select>
          </Field>
        )}
      </div>
      <Field
        label={
          form.workType === "services"
            ? "Job location"
            : "Delivery or pickup details"
        }
      >
        <input
          maxLength={300}
          className={INPUT}
          value={form.location}
          onChange={(event) => change("location", event.target.value)}
        />
      </Field>
      <Field label="Notes and specifications">
        <textarea
          className={INPUT}
          rows={3}
          maxLength={3000}
          value={form.notes}
          onChange={(event) => change("notes", event.target.value)}
        />
      </Field>
      <p role="status" className="text-sm text-accent">
        {message}
      </p>
      <button
        className={PRIMARY}
        disabled={pending || (catalog && !form.lines.length)}
      >
        {pending
          ? "Saving…"
          : order
            ? "Confirm reviewed order or job"
            : "Save order or job"}
      </button>
    </form>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 font-semibold">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}
