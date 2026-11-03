import Link from "next/link";
import { Suspense } from "react";
import { CustomerInbox } from "@/components/operations/inbox";
import { inboundAddress, inboundAvailable } from "@/lib/email/inbound";
import { Icon } from "@/components/icons";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { getMyBusiness, getMyEmailState, lastMyRun } from "@/lib/data/my-business";
import { OPERATIONS, type OperationKind } from "@/lib/operations/catalog";

// Orders & jobs has its own pages under /orders
export function OperationPage({ kind }: { kind: Exclude<OperationKind, "requests"> }) {
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
        <Setup />
      </Suspense>
    </div>
  );
}

async function Setup() {
  const [business, importRun, email] = await Promise.all([
    getMyBusiness(),
    lastMyRun("email_import", null),
    getMyEmailState(),
  ]);
  if (!business)
    return (
      <Card title="Tell us about your business first" id="business-first">
        <p>Then choose how you want help with your daily work.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
        </Link>
      </Card>
    );
  const messages = email.messages.map(
    ({
      id,
      subject,
      sender,
      senderName,
      forwardedBy,
      body,
      source,
      documentId,
      attachmentIds,
      orderId,
      state,
      extraction,
      simulated,
      issue,
      reply,
      sendState,
      createdAt,
    }) => ({
      id,
      subject,
      sender,
      senderName,
      forwardedBy,
      body,
      source,
      documentId,
      attachmentIds,
      orderId,
      state,
      extraction,
      simulated,
      issue,
      reply,
      sendState,
      createdAt: createdAt.toISOString(),
    }),
  );
  return (
    <CustomerInbox
      messages={messages}
      forwarding={{
        available: inboundAvailable(),
        address: email.inbox ? inboundAddress(email.inbox.token) : null,
        confirmation: email.inbox?.confirmation ?? null,
        firstFrom: email.inbox?.firstFrom ?? null,
        firstAt: email.inbox?.firstAt?.toISOString() ?? null,
        waiting: email.waiting,
        reading: importRun?.status === "running",
      }}
    />
  );
}
