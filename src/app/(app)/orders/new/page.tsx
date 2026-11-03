import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { BusinessFirst } from "@/components/orders/frame";
import { customersOf, orderableOf, rowOf, serverToday } from "@/components/orders/load";
import { type OrderDraft, OrderForm } from "@/components/orders/order-form";
import { PageHead } from "@/components/ui";
import { getMyBusiness, getMyEmailState, listMyOrders, listMyProducts } from "@/lib/data/my-business";
import { PLACEHOLDER_NAME } from "@/lib/rules/customers";
import { draftOf, importedDraft } from "@/lib/rules/order-lines";
import { workDefault } from "@/lib/rules/order-tracking";

export const metadata = { title: "New order" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function NewOrderPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Link href="/orders" className="-mb-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-accent">
        <Icon name="back" size="sm" />
        All orders
      </Link>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <NewOrder searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const text = (value: unknown) => (typeof value === "string" ? value.slice(0, 300) : "");

async function NewOrder({ searchParams }: { searchParams: SearchParams }) {
  const [params, business, orders, products] = await Promise.all([searchParams, getMyBusiness(), listMyOrders(), listMyProducts()]);
  if (!business) return <BusinessFirst />;
  const items = orderableOf(products);
  const rows = orders.map(rowOf);
  const customers = customersOf(rows);
  const workType = workDefault(business.profile, products);
  let draft: OrderDraft = {
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    workType,
    title: "",
    fulfillment: workType === "services" ? "at_customer" : "pickup",
    requestedDate: "",
    jobTime: "",
    location: "",
    notes: "",
    lines: [],
  };
  let review: { warnings: string[] } | null = null;
  const customer = customers.find((each) => each.key === text(params.customer));
  if (customer) draft = { ...draft, customerName: customer.name, customerEmail: customer.email, customerPhone: customer.phone };
  // Duplicate: same customer, items and handover; new dates and payments
  const copy = rows.find((order) => order.id === text(params.copy) && !order.isDemo);
  if (copy)
    draft = {
      ...draft,
      customerName: copy.customerName,
      customerEmail: copy.customerEmail,
      customerPhone: copy.customerPhone,
      workType: copy.workType,
      title: copy.title,
      fulfillment: copy.fulfillment,
      location: copy.location,
      notes: copy.notes,
      lines: draftOf(copy.lines.filter((line) => !line.productId || items.some((item) => item.id === line.productId))),
    };
  const pending = rows.find((order) => order.id === text(params.review) && !order.isDemo && ["new", "needs_review"].includes(order.status));
  if (pending) {
    const extraction = (await getMyEmailState()).messages.find((message) => message.orderId === pending.id && message.extraction)?.extraction;
    review = { warnings: extraction?.warnings ?? [] };
    draft = {
      id: pending.id,
      customerName: pending.customerName === PLACEHOLDER_NAME ? "" : pending.customerName,
      customerEmail: pending.customerEmail,
      customerPhone: pending.customerPhone,
      workType: pending.workType,
      title: pending.title,
      fulfillment: pending.fulfillment,
      requestedDate: pending.requestedDate ?? "",
      jobTime: pending.jobTime,
      location: pending.location,
      notes: pending.notes,
      lines: pending.lines.length ? draftOf(pending.lines) : importedDraft(extraction?.items ?? [], items),
    };
  }
  const noun = draft.workType === "services" ? "job" : "order";
  return (
    <>
      <PageHead
        kicker="Orders & jobs"
        title={pending ? `Review ${noun}` : copy ? `Copy of ${noun} for ${copy.customerName}` : `New ${noun}`}
        lead={pending ? "Check what was read from the customer’s message, fix anything off, then confirm." : "Who it’s for, what they want, and when."}
      />
      <OrderForm key={`${pending?.id ?? ""}:${copy?.id ?? ""}:${customer?.key ?? ""}`} items={items} customers={customers} initial={draft} review={review} today={serverToday()} />
    </>
  );
}
