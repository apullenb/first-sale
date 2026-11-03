import { Suspense } from "react";
import { CustomerList } from "@/components/orders/customers";
import { BusinessFirst, OrdersBar, OrdersFrame } from "@/components/orders/frame";
import { customersOf, rowOf, serverToday } from "@/components/orders/load";
import { getMyBusiness, listMyOrders, listMyProducts } from "@/lib/data/my-business";
import { workDefault } from "@/lib/rules/order-tracking";

export const metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <OrdersFrame>
      <Suspense fallback={<p className="text-muted">Loading your customers…</p>}>
        <Customers />
      </Suspense>
    </OrdersFrame>
  );
}

async function Customers() {
  const [business, orders, items] = await Promise.all([getMyBusiness(), listMyOrders(), listMyProducts()]);
  if (!business) return <BusinessFirst />;
  const rows = orders.map(rowOf);
  return (
    <>
      <OrdersBar at="customers" noun={workDefault(business.profile, items) === "services" ? "job" : "order"} />
      <section aria-label="Customers" className="rounded-[14px] border border-line bg-surface p-4 shadow-card sm:p-5">
        <CustomerList customers={customersOf(rows)} orders={rows} today={serverToday()} />
      </section>
    </>
  );
}
