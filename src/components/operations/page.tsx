import Link from "next/link";
import { Suspense } from "react";
import { OrdersPanel } from "@/components/operations/orders";
import { OperationSetupPanel } from "@/components/operations/setup";
import { Icon } from "@/components/icons";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { getMyBusiness, listMyOperationSetups, listMyOrders, listMyProducts } from "@/lib/data/my-business";
import { OPERATIONS, type OperationKind } from "@/lib/operations/catalog";
import { sampleRequestItem } from "@/lib/rules/operations";

export function OperationPage({ kind }: { kind: OperationKind }) {
  const definition = OPERATIONS[kind];
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/run" className="-mb-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-accent">
        <Icon name="back" size="sm" />
        Run your business
      </Link>
      <PageHead kicker="Run your business" title={definition.title} lead={definition.description} />
      <Suspense fallback={<p className="text-muted">Loading your setup…</p>}>
        <Setup kind={kind} />
      </Suspense>
    </div>
  );
}

async function Setup({ kind }: { kind: OperationKind }) {
  const [business, setups, items, orders] = await Promise.all([
    getMyBusiness(),
    listMyOperationSetups(),
    kind === "requests" ? listMyProducts() : [],
    kind === "requests" ? listMyOrders() : [],
  ]);
  if (!business) return <Card title="Tell us about your business first" id="business-first"><p>Then choose how you want help with your daily work.</p><Link href="/business/new" className={PRIMARY_LINK}>Tell us about your business</Link></Card>;
  const saved = setups.find((setup) => setup.kind === kind) ?? null;
  const orderable = items.map(({ id, name, kind: itemKind, priceCents, priceText, quantity, options }) => ({ id, name, kind: itemKind, priceCents, priceText, quantity, options }));
  return (
    <>
      <OperationSetupPanel key={`${business.id}:${kind}`} kind={kind} initial={saved ? { config: saved.config, paused: saved.paused } : null} sampleItem={kind === "requests" ? sampleRequestItem(items) : null} />
      {kind === "requests" ? <OrdersPanel items={orderable} orders={orders.map((order) => ({ ...order, createdAt: order.createdAt.toISOString() }))} /> : null}
    </>
  );
}
