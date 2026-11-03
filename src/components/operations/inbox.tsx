"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  changeCustomerEmail,
  connectCustomerEmail,
  dismissCustomerMessage,
  retryCustomerMessage,
  sendCustomerReply,
  setEmailReminder,
  syncCustomerEmail,
} from "@/app/(app)/email/actions";
import { importCustomerRequest } from "@/app/(app)/orders/tracking-actions";
import { Card, Chip } from "@/components/ui";
import { INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { PracticeBanner } from "@/components/practice-banner";
import type { ExtractedRequest } from "@/lib/orders/extract";

export interface InboxMessage {
  id: string;
  subject: string;
  sender: string;
  body: string;
  source: "email" | "invoice";
  documentId: string | null;
  orderId: string | null;
  state: "pending" | "processing" | "ready" | "failed" | "dismissed";
  extraction: ExtractedRequest | null;
  simulated: boolean;
  issue: string | null;
  reply: string;
  sendState: "draft" | "sending" | "sent" | "uncertain";
  connectionId: string | null;
  createdAt: string;
}
export function RequestImport({
  onMessage,
}: {
  onMessage?: (message: string) => void;
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
      <button disabled={pending} className={`${PRIMARY} w-fit`}>
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
  connection,
  available,
  now,
  reminderDays = 2,
}: {
  messages: InboxMessage[];
  connection: {
    email: string;
    paused: boolean;
    status: string;
    reminderDays: number;
  } | null;
  available: boolean;
  now: string;
  reminderDays?: number;
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
      <Card title="Your customer email" id="email-connection">
        {connection ? (
          <>
            <p className="font-semibold">{connection.email}</p>
            <Chip
              tone={
                connection.paused || connection.status !== "connected"
                  ? "warn"
                  : "done"
              }
            >
              {connection.status !== "connected"
                ? "Reconnect needed"
                : connection.paused
                  ? "Paused"
                  : "Connected"}
            </Chip>
            <p className="text-muted">
              Press Sync now to bring in new messages. Orders and jobs are added
              for review automatically. Every reply waits for your approval.
            </p>
            <div className="flex flex-wrap gap-2">
              {!connection.paused && connection.status === "connected" ? (
                <button
                  data-writes
                  className={PRIMARY}
                  disabled={pending}
                  onClick={() => run(syncCustomerEmail)}
                >
                  {pending ? "Syncing…" : "Sync now"}
                </button>
              ) : null}
              <button
                data-writes
                className={SECONDARY}
                disabled={pending}
                onClick={() =>
                  run(() =>
                    changeCustomerEmail(connection.paused ? "resume" : "pause"),
                  )
                }
              >
                {connection.paused ? "Resume" : "Pause"}
              </button>
              <button
                data-writes
                className={SECONDARY}
                disabled={pending}
                onClick={() => run(() => changeCustomerEmail("disconnect"))}
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <p className="text-muted">
            Connect your business inbox to automatically find customer orders
            and jobs, keep conversations together and prepare replies.
          </p>
        )}
        {connection ? (
          <label className="flex flex-col gap-2 font-semibold">
            Flag unanswered messages after
            <select
              data-writes
              className={INPUT}
              disabled={pending}
              value={connection.reminderDays}
              onChange={(event) =>
                run(() => setEmailReminder(Number(event.target.value)))
              }
            >
              {[1, 2, 3, 7].map((days) => (
                <option key={days} value={days}>
                  {days} day{days === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <span className="text-sm font-normal text-muted">
              Follow-up flags appear here. No reminder email is sent
              automatically.
            </span>
          </label>
        ) : null}
        {available ? (
          <button
            data-writes
            disabled={pending}
            className={`${PRIMARY} w-fit`}
            onClick={() =>
              start(async () => {
                const result = await connectCustomerEmail();
                setMessage(result.message);
                if (result.url) window.location.assign(result.url);
              })
            }
          >
            {connection ? "Reconnect email" : "Connect business email"}
          </button>
        ) : (
          <p className="text-sm text-muted">
            Live email needs administrator setup. You can use invoice uploads,
            pasted messages and manual entry now.
          </p>
        )}
        <p role="status" className="text-sm text-accent">
          {message}
        </p>
      </Card>
      <Card title="Add a customer message or invoice" id="email-import">
        <RequestImport />
      </Card>
      <Card title="Customer messages" id="customer-messages">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(event) => setShowResolved(event.target.checked)}
          />
          Show resolved
        </label>
        {visible.length ? (
          visible.map((item) => (
            <Message
              key={`${item.id}:${item.sendState}:${item.state}`}
              item={item}
              pending={pending}
              run={run}
              overdue={
                item.sendState === "draft" &&
                item.state !== "dismissed" &&
                Date.parse(now) - Date.parse(item.createdAt) >=
                  (connection?.reminderDays ?? reminderDays) * 86_400_000
              }
            />
          ))
        ) : (
          <p className="text-muted">
            No messages waiting. Incoming orders will also appear in{" "}
            <Link href="/orders" className="font-semibold text-accent">
              Orders & jobs
            </Link>
            .
          </p>
        )}
      </Card>
    </div>
  );
}
function Message({
  item,
  pending,
  run,
  overdue,
}: {
  item: InboxMessage;
  pending: boolean;
  run: (action: () => Promise<{ ok: boolean; message: string }>) => void;
  overdue: boolean;
}) {
  const [reply, setReply] = useState(item.reply),
    [approve, setApprove] = useState(false);
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold">{item.subject}</h3>
        <Chip tone={item.state === "failed" || overdue ? "warn" : "gray"}>
          {item.state === "failed"
            ? "Needs another look"
            : item.state === "pending" || item.state === "processing"
              ? "Reading"
              : item.state === "dismissed"
                ? "Resolved"
                : overdue
                  ? "Follow up"
                  : "For review"}
        </Chip>
      </div>
      {item.sender ? (
        <p className="text-sm text-muted">From {item.sender}</p>
      ) : null}
      {item.simulated ? (
        <PracticeBanner what="These extracted details are stand-ins. They cannot confirm an order or send a reply." />
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
          href={`/orders?order=${encodeURIComponent(item.orderId)}`}
        >
          Open order or job
        </Link>
      ) : null}
      {item.issue ? <p className="text-sm text-check">{item.issue}</p> : null}
      {(item.state === "failed" || item.state === "pending") &&
      !(item.source === "email" && !item.connectionId && !item.body) ? (
        <button
          data-writes
          disabled={pending}
          className={`${SECONDARY} w-fit`}
          onClick={() => run(() => retryCustomerMessage(item.id))}
        >
          {item.state === "failed" ? "Retry reading" : "Read now"}
        </button>
      ) : null}
      {item.reply && item.state === "ready" ? (
        <>
          <label className="flex flex-col gap-2 font-semibold">
            Reply draft ·{" "}
            {item.sendState === "sent" ? "Sent" : "Review before sending"}
            <textarea
              className={INPUT}
              rows={5}
              maxLength={10_000}
              value={reply}
              disabled={item.sendState !== "draft"}
              onChange={(event) => {
                setReply(event.target.value);
                setApprove(false);
              }}
            />
          </label>
          {item.connectionId &&
          !item.simulated &&
          item.sendState === "draft" ? (
            <>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={approve}
                  onChange={(event) => setApprove(event.target.checked)}
                />
                I reviewed this reply to {item.sender} and approve sending it.
              </label>
              <button
                data-writes
                className={`${PRIMARY} w-fit`}
                disabled={pending || !approve || !reply.trim()}
                onClick={() => {
                  setApprove(false);
                  run(() => sendCustomerReply({ id: item.id, reply }));
                }}
              >
                Send approved reply
              </button>
            </>
          ) : item.sendState === "uncertain" || item.sendState === "sending" ? (
            <p className="text-sm text-check">
              Sending is unconfirmed. Check your Sent folder before replying;
              retry is blocked to prevent duplicates.
            </p>
          ) : !item.connectionId ? (
            <p className="text-sm text-muted">
              Pasted messages have no connected sender. Copy this draft into
              your email service.
            </p>
          ) : null}
        </>
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
