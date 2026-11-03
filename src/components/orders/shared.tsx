"use client";
import { cloneElement, type ReactElement, type ReactNode, useId, useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Chip } from "@/components/ui";
import type { OrderView } from "@/lib/data/orders";
import { itemsSummary, linesTotals } from "@/lib/rules/order-lines";
import { dueText, paymentSummary, statusText, tabOf, type TrackingStatus, type WorkType } from "@/lib/rules/order-tracking";
import type { ItemOptions } from "@/lib/rules/products";

export type OrderRow = Omit<OrderView, "createdAt" | "events"> & {
  createdAt: string;
  events: { actor: "rule" | "ai" | "owner"; summary: string; createdAt: string }[];
};

export interface OrderableItem {
  id: string;
  name: string;
  kind: "product" | "service";
  priceCents: number | null;
  priceText: string;
  quantity: number | null;
  options: ItemOptions;
}

export type Outcome = { ok: boolean; message: string; id?: string };

export const nounOf = (type: WorkType) => (type === "services" ? "job" : "order");

// Older rows may hold priced lines without a saved total
export const totalOf = (order: Pick<OrderRow, "totalCents" | "lines">) =>
  order.totalCents ?? (order.lines.length ? linesTotals(order.lines).totalCents : null);

export const balanceOf = (order: Pick<OrderRow, "totalCents" | "lines" | "payments" | "status">) =>
  ["new", "needs_review", "cancelled"].includes(order.status) ? null : paymentSummary(totalOf(order), order.payments).balance;

export const whatOf =(order: Pick<OrderRow, "lines" | "title">) => itemsSummary(order.lines, order.title || "No items yet");

// Runs a server action, keeping its message for a status line
export function useRun() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  function run(action: () => Promise<Outcome>, after?: (result: Outcome) => void) {
    start(async () => {
      try {
        const result = await action();
        setMessage({ text: result.message, ok: result.ok });
        after?.(result);
      } catch {
        setMessage({ text: "Could not save this change. Try again.", ok: false });
      }
    });
  }
  return { pending, message, run, clear: () => setMessage(null) };
}

export function Status({ message }: { message: { text: string; ok: boolean } | null }) {
  return (
    <p role="status" aria-live="polite" className={`text-sm font-semibold ${message?.ok === false ? "text-danger" : "text-accent"}`}>
      {message?.text ?? ""}
    </p>
  );
}

const TONE: Record<ReturnType<typeof tabOf>, "warn" | "gray" | "accent" | "done" | "pick" | "plain"> = {
  review: "warn",
  todo: "plain",
  in_progress: "accent",
  ready: "pick",
  done: "done",
  cancelled: "gray",
};
export function StatusChip({ status, workType }: { status: TrackingStatus; workType: WorkType }) {
  return <Chip tone={TONE[tabOf(status)]}>{statusText(status, workType)}</Chip>;
}

export const DemoChip = () => <Chip tone="warn">DEMO</Chip>;

const SOURCE: Record<OrderRow["source"], { icon: IconName; text: string }> = {
  manual: { icon: "pencil", text: "Entered by you" },
  email: { icon: "mail", text: "From email" },
  invoice: { icon: "file", text: "From invoice" },
};
export function SourceIcon({ source }: { source: OrderRow["source"] }) {
  const { icon, text } = SOURCE[source];
  return (
    <span title={text} className="inline-flex items-center gap-1.5 text-muted">
      <Icon name={icon} size="sm" />
      <span className="sr-only">{text}</span>
    </span>
  );
}
export const sourceText = (source: OrderRow["source"]) => SOURCE[source].text;

export function Due({ order, today, stacked = true }: { order: Pick<OrderRow, "status" | "requestedDate" | "jobTime">; today: string; stacked?: boolean }) {
  const due = dueText(order, today);
  if (!order.requestedDate) return <span className="text-muted">No due date</span>;
  return (
    <span className={`${stacked ? "flex flex-col" : "inline-flex flex-wrap gap-x-1.5"} ${due.overdue ? "text-danger" : ""}`}>
      <span className="font-semibold">{due.date}</span>
      <span className={`text-sm ${due.overdue ? "font-semibold" : due.today ? "font-semibold text-accent" : "text-muted"}`}>
        {due.overdue ? `Overdue · ${due.relative}` : due.relative}
      </span>
    </span>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {cloneElement(children, { id })}
      {hint ? <span className="text-sm text-muted">{hint}</span> : null}
    </div>
  );
}
