import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { backQuery } from "@/components/orders/filters";
import { rowOf, orderableOf, serverToday } from "@/components/orders/load";
import { OrderDetail } from "@/components/orders/order-detail";
import { PRIMARY_LINK } from "@/components/styles";
import { PageHead } from "@/components/ui";
import { getMyEmailState, getMyOrder, listMyProducts } from "@/lib/data/my-business";

export const metadata = { title: "Order" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <Suspense fallback={<p className="text-muted">Loading the order…</p>}>
        <Order params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Order({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const order = id.length <= 60 ? await getMyOrder(id) : null;
  if (!order)
    return (
      <>
        <PageHead kicker="Orders & jobs" title="That order wasn’t found" lead="It may have been removed, like a sample from the email demo." />
        <Link href="/orders" className={PRIMARY_LINK}>
          <Icon name="back" size="sm" />
          All orders
        </Link>
      </>
    );
  const [items, email] = await Promise.all([listMyProducts(), getMyEmailState()]);
  const messages = email.messages
    .filter((message) => message.orderId === order.id)
    .map(({ id: messageId, subject, body, documentId }) => ({ id: messageId, subject, body, documentId }));
  return <OrderDetail order={rowOf(order)} items={orderableOf(items)} messages={messages} today={serverToday()} back={backQuery(query.back)} />;
}
