import Link from "next/link";
import { Suspense } from "react";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, Chip, PageHead } from "@/components/ui";
import { getMyEmailState, listMyOrders } from "@/lib/data/my-business";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/run");
export default function RunPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHead
        kicker="Your daily workspace"
        title="Run your business"
        lead="Stay on top of customer messages, orders, jobs and payments."
      />
      <Suspense fallback={<p className="text-muted">Loading your work…</p>}>
        <Workflows />
      </Suspense>
      <Card title="You stay in charge" id="in-charge">
        <p>
          Incoming orders are added for review automatically. You confirm stock
          changes, record payments and approve every reply before sending.
        </p>
      </Card>
    </div>
  );
}
async function Workflows() {
  const [email, orders] = await Promise.all([
    getMyEmailState(),
    listMyOrders(),
  ]);
  const review = orders.filter(
    (order) => order.status === "needs_review" || order.status === "new",
  ).length;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card title="Customer email" icon="file" id="workflow-email">
        <Chip
          tone={email.connection && !email.connection.paused ? "done" : "gray"}
        >
          {email.connection
            ? email.connection.paused
              ? "Paused"
              : email.connection.status === "connected"
                ? "Connected"
                : "Reconnect needed"
            : "Connect your inbox"}
        </Chip>
        <p className="text-muted">
          Keep conversations together, find incoming orders and jobs, and review
          replies.
        </p>
        <Link href="/email" className={PRIMARY_LINK}>
          Open customer email
        </Link>
      </Card>
      <Card title="Orders & jobs" icon="receipt" id="workflow-requests">
        <Chip tone={review ? "warn" : "gray"}>
          {review
            ? `${review} need review`
            : `${orders.filter((order) => !["fulfilled", "cancelled"].includes(order.status)).length} active`}
        </Chip>
        <p className="text-muted">
          Track work, due dates, payments and balances. Add work manually,
          upload invoices or receive it from email.
        </p>
        <Link href="/orders" className={PRIMARY_LINK}>
          Open orders & jobs
        </Link>
      </Card>
    </div>
  );
}
