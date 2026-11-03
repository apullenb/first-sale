import Link from "next/link";
import { Suspense } from "react";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, Chip, PageHead } from "@/components/ui";
import { listMyOrders } from "@/lib/data/my-business";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/run");
export default function RunPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHead
          kicker="Your daily workspace"
          title="Run your business"
          lead="Stay on top of customer messages, orders, jobs and payments."
        />
        <ComingSoonStamp />
      </div>
      <Suspense fallback={<p className="text-muted">Loading your work…</p>}>
        <Workflows />
      </Suspense>
      <Card title="You stay in charge" id="in-charge">
        <p>
          Orders and requests come to you for review. You
          confirm stock changes, record payments and send every reply yourself,
          from your own email.
        </p>
      </Card>
    </div>
  );
}
// A rubber stamp by the title; real text, still when motion is reduced
function ComingSoonStamp() {
  return (
    <p className="mx-auto shrink-0 animate-stamp-in sm:mx-0 sm:mt-6 sm:mr-4">
      <span className="flex -rotate-6 flex-col items-center rounded-xl border-[3px] border-pick bg-surface/90 px-5 pb-2 pt-1.5 text-pick shadow-lift ring-[1.5px] ring-pick/50 ring-offset-[3px] ring-offset-surface">
        <span className="text-[13px] font-bold uppercase tracking-[0.18em]">Additional features</span>{" "}
        <span className="text-[26px] font-extrabold uppercase leading-tight tracking-[0.12em]">coming soon!</span>
      </span>
    </p>
  );
}

async function Workflows() {
  const orders = await listMyOrders();
  const review = orders.filter(
    (order) => order.status === "needs_review" || order.status === "new",
  ).length;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card title="Customer email" icon="file" id="workflow-email">
        <Chip tone="pick" icon="clock">
          Coming soon · try the demo
        </Chip>
        <p className="text-muted">
          Soon you’ll forward customer emails to your own SnapStart address,
          and SnapStart will turn them into orders or requests for you to
          check, with replies you send from your own email. Try it now with
          sample emails.
        </p>
        <Link href="/email/demo" className={PRIMARY_LINK}>
          Try the email demo
        </Link>
      </Card>
      <Card title="Orders & jobs" icon="receipt" id="workflow-requests">
        <Chip tone={review ? "warn" : "gray"}>
          {review
            ? `${review} need review`
            : `${orders.filter((order) => !["fulfilled", "cancelled"].includes(order.status)).length} active`}
        </Chip>
        <p className="text-muted">
          Track work, due dates, payments and balances. Add work yourself,
          upload invoices or create it from forwarded email.
        </p>
        <Link href="/orders" className={PRIMARY_LINK}>
          Open orders & jobs
        </Link>
      </Card>
    </div>
  );
}
