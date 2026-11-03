"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  dismissCustomerMessage,
  markCustomerReplySent,
  retryCustomerMessage,
} from "@/app/(app)/email/actions";
import { importCustomerRequest } from "@/app/(app)/orders/tracking-actions";
import { Card, Chip } from "@/components/ui";
import { Icon } from "@/components/icons";
import { INPUT, OUTSIDE_LINK, PRIMARY, SECONDARY } from "@/components/styles";
import { PracticeBanner } from "@/components/practice-banner";
import { replyLink } from "@/lib/email/mailto";
import type { ExtractedRequest } from "@/lib/orders/extract";
import { ForwardingSetup, type ForwardingState } from "./forwarding";

export interface InboxMessage {
  id: string;
  subject: string;
  sender: string;
  senderName: string;
  forwardedBy: string | null;
  body: string;
  source: "email" | "invoice";
  documentId: string | null;
  attachmentIds: string[];
  orderId: string | null;
  state: "pending" | "processing" | "ready" | "failed" | "dismissed";
  extraction: ExtractedRequest | null;
  simulated: boolean;
  issue: string | null;
  reply: string;
  sendState: "draft" | "sent";
  createdAt: string;
}
export function RequestImport({
  onMessage,
  quiet = false,
}: {
  onMessage?: (message: string) => void;
  // A secondary button, when another primary is on the page
  quiet?: boolean;
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      action={(form) =>
        start(async () => {
          try {
            const result = await importCustomerRequest(form);
            setMessage(result.message);
            onMessage?.(result.message);
          } catch {
            setMessage("Could not import this request. Try again.");
          }
        })
      }
    >
      <p className="text-muted">
        Upload a customer invoice or paste an email. Details appear for review;
        no payment or stock change is made.
      </p>
      <label className="flex flex-col gap-2 font-semibold">
        Invoice PDF or image (up to 4 MB)
        <input
          name="file"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className={INPUT}
        />
      </label>
      <label className="flex flex-col gap-2 font-semibold">
        Or paste a customer email or invoice
        <textarea name="text" rows={5} maxLength={30_000} className={INPUT} />
      </label>
      <button disabled={pending} className={`${quiet ? SECONDARY : PRIMARY} w-fit`}>
        {pending ? "Reading request…" : "Read & add for review"}
      </button>
      <p role="status" className="text-sm text-accent">
        {message}
      </p>
    </form>
  );
}
export function CustomerInbox({
  messages,
  forwarding,
}: {
  messages: InboxMessage[];
  forwarding: ForwardingState;
}) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    [showResolved, setShowResolved] = useState(false);
  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    start(async () => {
      try {
        setMessage((await action()).message);
      } catch {
        setMessage("Could not complete that action. Try again.");
      }
    });
  }
  const visible = messages.filter(
    (item) => showResolved || item.state !== "dismissed",
  );
  return (
    <div className="flex flex-col gap-5">
      <ForwardingSetup state={forwarding} />
      <Card title="Customer messages" id="customer-messages">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(event) => setShowResolved(event.target.checked)}
          />
          Show resolved
        </label>
        <p role="status" className="text-sm text-accent">
          {message}
        </p>
        {visible.length ? (
          visible.map((item) => (
            <Message
              key={`${item.id}:${item.sendState}:${item.state}`}
              item={item}
              pending={pending}
              run={run}
            />
          ))
        ) : (
          <p className="text-muted">
            No messages yet. Orders and requests from email also appear in{" "}
            <Link href="/orders" className="font-semibold text-accent">
              Orders & jobs
            </Link>
            .
          </p>
        )}
      </Card>
      <Card title="Add a customer message or invoice" id="email-import">
        <RequestImport />
      </Card>
    </div>
  );
}
function Reply({
  item,
  pending,
  run,
}: {
  item: InboxMessage;
  pending: boolean;
  run: (action: () => Promise<{ ok: boolean; message: string }>) => void;
}) {
  const [reply, setReply] = useState(item.reply),
    [copied, setCopied] = useState("");
  const to = item.sender || item.extraction?.customerEmail || "";
  const link = to ? replyLink(to, item.subject, reply) : null;
  const sent = item.sendState === "sent";
  async function copy() {
    try {
      await navigator.clipboard.writeText(reply);
      setCopied("Copied. Paste it into your reply.");
    } catch {
      setCopied("Couldn’t copy. Select the text and copy it instead.");
    }
  }
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-wash p-4">
      <label className="flex flex-col gap-2 font-semibold">
        {sent ? "Your reply · Sent from your email" : "Your reply · edit it before sending"}
        <textarea
          className={INPUT}
          rows={6}
          maxLength={10_000}
          value={reply}
          disabled={sent}
          onChange={(event) => setReply(event.target.value)}
        />
      </label>
      {sent ? (
        <Chip tone="done" icon="check">Sent from your email</Chip>
      ) : (
        <>
          {item.simulated ? (
            <p className="text-sm text-check">
              Practice mode: this reply uses stand-in details. Check every word before you send it.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {link?.full ? (
              <a href={link.full} className={OUTSIDE_LINK}>
                <Icon name="send" size="sm" />
                Reply in your email
              </a>
            ) : null}
            <button type="button" className={SECONDARY} onClick={copy} disabled={!reply.trim()}>
              <Icon name="copy" size="sm" />
              Copy reply
            </button>
            {link && !link.full ? (
              <a href={link.short} className={OUTSIDE_LINK}>
                <Icon name="mail" size="sm" />
                Open email
              </a>
            ) : null}
          </div>
          {link && !link.full ? (
            <p className="text-sm text-muted">
              This reply is long, so copy it first, then open your email and paste it in.
            </p>
          ) : !to ? (
            <p className="text-sm text-muted">
              No customer email address was found. Copy the reply and send it from your email.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Opens a reply to {to} in your own email app. SnapStart doesn’t send it.
            </p>
          )}
          <p role="status" className="text-sm text-accent">{copied}</p>
          <button
            data-writes
            type="button"
            className={`${SECONDARY} w-fit`}
            disabled={pending || !reply.trim()}
            onClick={() => run(() => markCustomerReplySent({ id: item.id, reply }))}
          >
            <Icon name="check" size="sm" />
            I sent it
          </button>
        </>
      )}
    </div>
  );
}
function Message({
  item,
  pending,
  run,
}: {
  item: InboxMessage;
  pending: boolean;
  run: (action: () => Promise<{ ok: boolean; message: string }>) => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">{item.subject}</h3>
        <Chip tone={item.state === "failed" ? "warn" : "gray"}>
          {item.state === "failed"
            ? "Needs another look"
            : item.state === "pending"
              ? "New · waiting to be read"
              : item.state === "processing"
                ? "Reading"
                : item.state === "dismissed"
                  ? "Resolved"
                  : item.sendState === "sent"
                    ? "Replied"
                    : "For review"}
        </Chip>
      </div>
      {item.sender ? (
        <p className="text-sm text-muted">
          From {item.senderName ? `${item.senderName} (${item.sender})` : item.sender}
          {item.forwardedBy ? ` · forwarded by ${item.forwardedBy}` : ""}
        </p>
      ) : null}
      {item.simulated ? (
        <PracticeBanner what="These extracted details are stand-ins. They cannot confirm an order." />
      ) : null}
      {item.body ? (
        <details>
          <summary className="cursor-pointer font-semibold text-accent">
            Original message
          </summary>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">
            {item.body}
          </p>
        </details>
      ) : null}
      {item.documentId ? (
        <Link
          href={`/documents/${item.documentId}/file`}
          className="font-semibold text-accent"
        >
          Download original invoice
        </Link>
      ) : null}
      {item.attachmentIds.map((id, index) => (
        <Link key={id} href={`/documents/${id}/file`} className="font-semibold text-accent">
          Download attachment {item.attachmentIds.length > 1 ? index + 1 : ""}
        </Link>
      ))}
      {item.extraction?.warnings.length ? (
        <ul className="list-disc pl-5 text-sm text-muted">
          {item.extraction.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {item.orderId ? (
        <Link
          className={`${SECONDARY} w-fit`}
          href={`/orders/${encodeURIComponent(item.orderId)}`}
        >
          Open order or job
        </Link>
      ) : null}
      {item.issue ? <p className="text-sm text-check">{item.issue}</p> : null}
      {item.state === "failed" && !(item.source === "email" && !item.body) ? (
        <button
          data-writes
          disabled={pending}
          className={`${SECONDARY} w-fit`}
          onClick={() => run(() => retryCustomerMessage(item.id))}
        >
          Retry reading
        </button>
      ) : null}
      {item.reply && item.state === "ready" ? (
        <Reply item={item} pending={pending} run={run} />
      ) : null}
      {item.state === "ready" ? (
        <button
          data-writes
          disabled={pending}
          className={`${SECONDARY} w-fit`}
          onClick={() => run(() => dismissCustomerMessage(item.id))}
        >
          Mark resolved
        </button>
      ) : null}
    </article>
  );
}
