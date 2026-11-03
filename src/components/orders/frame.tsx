import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { ImportPanel } from "./import-panel";

// The Orders & jobs header: back to Run your business, title, Orders | Customers, and ways to add

export function OrdersFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <Link href="/run" className="-mb-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-accent">
        <Icon name="back" size="sm" />
        Run your business
      </Link>
      <PageHead kicker="Run your business" title="Orders & jobs" lead="Track customer work, due dates, progress and payments in one place." />
      {children}
    </div>
  );
}

export function OrdersBar({ at, noun }: { at: "orders" | "customers"; noun: "order" | "job" }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Orders and customers" className="flex rounded-[10px] border border-line-strong bg-surface p-0.5">
          {(
            [
              ["orders", "/orders", noun === "job" ? "Jobs" : "Orders"],
              ["customers", "/orders/customers", "Customers"],
            ] as const
          ).map(([key, href, label]) => (
            <Link
              key={key}
              href={href}
              aria-current={at === key ? "page" : undefined}
              className={`inline-flex min-h-10 items-center rounded-lg px-4 font-semibold ${at === key ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <ImportPanel />
          <Link href="/orders/new" className={PRIMARY_LINK}>
            <Icon name="plus" size="sm" />
            New {noun}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function BusinessFirst() {
  return (
    <Card title="Tell us about your business first" id="business-first">
      <p>Then you can track orders and jobs here.</p>
      <Link href="/business/new" className={PRIMARY_LINK}>
        Tell us about your business
      </Link>
    </Card>
  );
}
