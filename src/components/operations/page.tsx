import Link from "next/link";
import { Suspense } from "react";
import { OrdersPanel } from "@/components/operations/orders";
import { CustomerInbox } from "@/components/operations/inbox";
import { emailAvailable } from "@/lib/email/client";
import { workDefault } from "@/lib/rules/order-tracking";
import { Icon } from "@/components/icons";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import {
  getMyBusiness,
  getMyEmailState,
  lastMyRun,
  listMyOrders,
  listMyProducts,
} from "@/lib/data/my-business";
import { OPERATIONS, type OperationKind } from "@/lib/operations/catalog";

export function OperationPage({
  kind,
  selectedOrder,
}: {
  kind: OperationKind;
  selectedOrder?: Promise<{ order?: string }>;
}) {
  const definition = OPERATIONS[kind];
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <Link
        href="/run"
        className="-mb-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-accent"
      >
        <Icon name="back" size="sm" />
        Run your business
      </Link>
      <PageHead
        kicker="Run your business"
        title={definition.title}
        lead={definition.description}
      />
      <Suspense fallback={<p className="text-muted">Loading your setup…</p>}>
        <Setup kind={kind} selectedOrder={selectedOrder} />
      </Suspense>
    </div>
  );
}

async function Setup({
  kind,
  selectedOrder,
}: {
  kind: OperationKind;
  selectedOrder?: Promise<{ order?: string }>;
}) {
  const [business, importRun, items, orders, email, selection] = await Promise.all(
    [
      getMyBusiness(),
      kind === "email" ? lastMyRun("email_import", null) : null,
      kind === "requests" ? listMyProducts() : [],
      kind === "requests" ? listMyOrders() : [],
      getMyEmailState(),
      selectedOrder ?? Promise.resolve({ order: undefined }),
    ],
  );
  if (!business)
    return (
      <Card title="Tell us about your business first" id="business-first">
        <p>Then choose how you want help with your daily work.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
        </Link>
      </Card>
    );
  const now = new Date();
  const messages = email.messages.map(
    ({
      id,
      subject,
      sender,
      body,
      source,
      documentId,
      orderId,
      state,
      extraction,
      simulated,
      issue,
      reply,
      sendState,
      connectionId,
      createdAt,
    }) => ({
      id,
      subject,
      sender,
      body,
      source,
      documentId,
      orderId,
      state,
      extraction,
      simulated,
      issue,
      reply,
      sendState,
      connectionId,
      createdAt: createdAt.toISOString(),
    }),
  );
  const orderable = items.map(
    ({
      id,
      name,
      kind: itemKind,
      priceCents,
      priceText,
      quantity,
      options,
    }) => ({
      id,
      name,
      kind: itemKind,
      priceCents,
      priceText,
      quantity,
      options,
    }),
  );
  return (
    <>
      {kind === "requests" ? (
        <OrdersPanel
          key={`${business.id}:${selection.order ?? ""}`}
          items={orderable}
          orders={orders.map((order) => ({
            ...order,
            createdAt: order.createdAt.toISOString(),
            events: order.events.map((event) => ({
              ...event,
              createdAt: event.createdAt.toISOString(),
            })),
          }))}
          workType={workDefault(business.profile, items)}
          messages={messages}
          today={now.toISOString().slice(0, 10)}
          initialOrder={selection.order}
        />
      ) : (
        <CustomerInbox
          messages={messages}
          connection={email.connection}
          available={emailAvailable()}
          importing={importRun?.status === "running"}
        />
      )}
    </>
  );
}
