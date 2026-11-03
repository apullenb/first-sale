import { redirect } from "next/navigation";
import { Suspense } from "react";
import { filtersFrom } from "@/components/orders/filters";
import { BusinessFirst, OrdersBar, OrdersFrame } from "@/components/orders/frame";
import { rowOf, serverToday } from "@/components/orders/load";
import { OrderList } from "@/components/orders/order-list";
import { getMyBusiness, listMyOrders, listMyProducts } from "@/lib/data/my-business";
import { workDefault } from "@/lib/rules/order-tracking";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/orders");
// Reading a pasted email or invoice can take a minute
export const maxDuration = 120;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <OrdersFrame>
      <Suspense fallback={<p className="text-muted">Loading your orders…</p>}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </OrdersFrame>
  );
}

async function Orders({ searchParams }: { searchParams: SearchParams }) {
  const [params, business, orders, items] = await Promise.all([searchParams, getMyBusiness(), listMyOrders(), listMyProducts()]);
  // Older links opened an order with ?order=
  if (typeof params.order === "string" && /^[\w-]{1,60}$/.test(params.order)) redirect(`/orders/${params.order}`);
  if (!business) return <BusinessFirst />;
  return (
    <>
      <OrdersBar at="orders" noun={workDefault(business.profile, items) === "services" ? "job" : "order"} />
      <OrderList orders={orders.map(rowOf)} today={serverToday()} initial={filtersFrom(params)} />
    </>
  );
}
