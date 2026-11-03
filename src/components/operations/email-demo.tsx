"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { INPUT, OUTSIDE_LINK, PRIMARY, SECONDARY } from "@/components/styles";
import { Card, Chip } from "@/components/ui";
import { Working } from "@/components/working";
import { DEMO_EMAILS, DEMO_OWNER_EMAIL, type DemoEmail } from "@/data/email-demo";
import { replySubject } from "@/lib/email/mailto";

// Client-side only: nothing here is saved, sent or read by AI; a reload starts over
export function EmailDemo() {
  const [round, setRound] = useState(0);
  return (
    <div className="flex flex-col gap-5">
      <Card title="Coming soon" id="email-coming-soon" icon="clock" tone="pick">
        <p className="text-lg">
          Connecting your email is coming soon. Here’s how it will work once your inbox is connected — try it with sample emails.
        </p>
      </Card>
      <DemoBody key={round} onReset={() => setRound((value) => value + 1)} />
    </div>
  );
}

const Sample = () => <Chip tone="pick">Sample</Chip>;
const Demo = () => <Chip tone="warn">DEMO</Chip>;

function DemoBody({ onReset }: { onReset: () => void }) {
  const [reading, setReading] = useState<number | null>(null),
    [read, setRead] = useState(false),
    [confirmed, setConfirmed] = useState<string[]>([]);

  // Reads the samples one by one, so it feels like the real thing
  useEffect(() => {
    if (reading === null) return;
    const timer = window.setTimeout(() => {
      if (reading + 1 < DEMO_EMAILS.length) setReading(reading + 1);
      else {
        setReading(null);
        setRead(true);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [reading]);

  const orders = DEMO_EMAILS.filter((email) => confirmed.includes(email.id) && GOES_TO_ORDERS.has(email.result.kind));

  return (
    <>
      <Card title="Your connected inbox" id="email-connected" icon="mail" action={<Sample />}>
        <p className="flex flex-wrap items-center gap-2 text-lg">
          <Chip tone="done" icon="check">Connected</Chip>
          <span className="break-all font-semibold">{DEMO_OWNER_EMAIL}</span>
        </p>
        <p className="text-[15px] text-muted">New customer emails show up below. SnapStart reads them when you tap Read new emails.</p>
      </Card>

      <Card title="Customer inbox" id="demo-inbox" icon="mail" action={<Sample />}>
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-wash p-4">
          <Chip tone={read ? "done" : "accent"} icon={read ? "check" : "mail"}>
            {read ? `Read ${DEMO_EMAILS.length} sample emails` : `${DEMO_EMAILS.length} new sample emails waiting`}
          </Chip>
          {read ? null : (
            <button type="button" className={`${PRIMARY} w-fit`} disabled={reading !== null} onClick={() => setReading(0)}>
              {reading !== null ? "Reading…" : "Read new emails"}
            </button>
          )}
          <Working label={reading !== null ? `Reading email ${reading + 1} of ${DEMO_EMAILS.length}…` : ""} active={reading !== null} />
          <p className="text-sm text-muted">Orders and quote requests go to Orders &amp; jobs for your review. Questions and shipping updates get a reply ready to send. Nothing is sent to customers.</p>
        </div>
        {DEMO_EMAILS.map((email, index) =>
          read ? (
            <ResultCard
              key={email.id}
              email={email}
              confirmed={confirmed.includes(email.id)}
              onConfirm={() => setConfirmed((list) => [...list, email.id])}
            />
          ) : (
            <EmailRow key={email.id} email={email} active={reading === index} />
          ),
        )}
      </Card>

      <Card title="Orders & jobs" id="demo-orders" icon="receipt" action={<Demo />}>
        {orders.length ? (
          <ul className="flex flex-col gap-2">
            {orders.map((email) => (
              <li key={email.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
                <span className="min-w-0 flex-1">
                  <b className="block">DEMO · {email.result.title}</b>
                  <span className="text-sm text-muted">
                    {email.fromName} · {email.result.when}
                  </span>
                </span>
                <Chip tone={email.result.kind === "order" ? "done" : "accent"} icon={email.result.kind === "order" ? "check" : "question"}>
                  {email.result.kind === "order" ? "Confirmed" : "Quote to send"}
                </Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Confirm an order or quote request above and it shows up here.</p>
        )}
        <p className="text-sm text-muted">Demo only: nothing here is saved, and it doesn’t change your real orders.</p>
      </Card>

      <button type="button" className={`${SECONDARY} w-fit`} onClick={onReset}>
        <Icon name="refresh" size="sm" />
        Start the demo over
      </button>
    </>
  );
}

// Orders and quotes land in Orders & jobs; updates and questions only need a reply
const GOES_TO_ORDERS = new Set<DemoEmail["result"]["kind"]>(["order", "quote"]);
const KIND: Record<DemoEmail["result"]["kind"], { label: string; icon: "receipt" | "question" | "box" | "mail"; tone: "accent" | "pick" | "gray" }> = {
  order: { label: "Order", icon: "receipt", tone: "accent" },
  quote: { label: "Quote request", icon: "question", tone: "pick" },
  update: { label: "Shipping update", icon: "box", tone: "gray" },
  question: { label: "Question", icon: "mail", tone: "gray" },
};

function From({ email }: { email: DemoEmail }) {
  return (
    <p className="text-sm text-muted">
      From {email.fromName} ({email.from})
      {email.forwardedBy ? ` · forwarded by ${email.forwardedBy}` : ""}
    </p>
  );
}

function EmailRow({ email, active }: { email: DemoEmail; active: boolean }) {
  return (
    <article aria-labelledby={`demo-${email.id}`} className={`flex flex-col gap-2 rounded-xl border p-4 transition ${active ? "border-accent bg-accent-tint" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`demo-${email.id}`} className="min-w-0 flex-1 font-bold">
          {email.subject}
        </h3>
        <span className="text-sm text-muted">{email.received}</span>
      </div>
      <From email={email} />
      <div className="flex flex-wrap gap-2">
        <Sample />
        {email.via ? <Chip tone="gray" icon="forward">{email.via}</Chip> : null}
        {email.attachment ? (
          <Chip tone="gray" icon="paperclip">
            {email.attachment.name} · {email.attachment.size}
          </Chip>
        ) : null}
      </div>
      <p className="line-clamp-2 whitespace-pre-line text-[15px] text-rule">{email.body.split("\n\n").slice(1, 2).join("") || email.body}</p>
    </article>
  );
}

function ResultCard({ email, confirmed, onConfirm }: { email: DemoEmail; confirmed: boolean; onConfirm: () => void }) {
  const { result } = email;
  return (
    <article aria-labelledby={`demo-${email.id}`} className="flex flex-col gap-3 rounded-xl border border-line p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={KIND[result.kind].tone} icon={KIND[result.kind].icon}>
          {KIND[result.kind].label}
        </Chip>
        <Demo />
        {!GOES_TO_ORDERS.has(result.kind) ? null : confirmed ? <Chip tone="done" icon="check">Added to Orders & jobs</Chip> : <Chip tone="gray">For review</Chip>}
      </div>
      <h3 id={`demo-${email.id}`} className="font-display text-xl">
        {result.title}
      </h3>
      <dl className="grid gap-x-4 gap-y-1.5 text-[15px] sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold text-muted">Customer</dt>
        <dd>
          {email.fromName} ({email.from})
        </dd>
        <dt className="font-semibold text-muted">{result.kind === "order" || result.kind === "quote" ? "Items" : result.kind === "update" ? "Order" : "Asking about"}</dt>
        <dd>
          <ul>
            {result.items.map((item) => (
              <li key={item.name}>
                {result.kind === "question" ? item.name : `${item.quantity} × ${item.name}`}
              </li>
            ))}
          </ul>
        </dd>
        {result.kind === "question" ? null : (
          <>
            <dt className="font-semibold text-muted">{result.kind === "update" ? "Status" : "When"}</dt>
            <dd>{result.when}</dd>
          </>
        )}
        {result.notes ? (
          <>
            <dt className="font-semibold text-muted">Notes</dt>
            <dd>{result.notes}</dd>
          </>
        ) : null}
      </dl>
      <details>
        <summary className="cursor-pointer font-semibold text-accent">Original email: {email.subject}</summary>
        <div className="mt-2 flex flex-col gap-2">
          <From email={email} />
          {email.attachment ? (
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Icon name="file" size="sm" className="text-danger" />
              {email.attachment.name} (sample, not a real file)
            </p>
          ) : null}
          <p className="whitespace-pre-wrap break-words text-sm">{email.body}</p>
        </div>
      </details>
      {confirmed || !GOES_TO_ORDERS.has(result.kind) ? null : (
        <button type="button" className={`${SECONDARY} w-fit`} onClick={onConfirm}>
          <Icon name="check" size="sm" />
          Review and confirm
        </button>
      )}
      <Reply email={email} />
    </article>
  );
}

function Reply({ email }: { email: DemoEmail }) {
  const [reply, setReply] = useState(email.result.reply),
    [preview, setPreview] = useState(false),
    [sent, setSent] = useState(false),
    [copied, setCopied] = useState("");
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
        <textarea className={INPUT} rows={6} maxLength={10_000} value={reply} disabled={sent} onChange={(event) => setReply(event.target.value)} />
      </label>
      {sent ? (
        <Chip tone="done" icon="check">Sent from your email (demo)</Chip>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={OUTSIDE_LINK} aria-expanded={preview} onClick={() => setPreview(!preview)} disabled={!reply.trim()}>
              <Icon name="send" size="sm" />
              Reply in your email
            </button>
            <button type="button" className={SECONDARY} onClick={copy} disabled={!reply.trim()}>
              <Icon name="copy" size="sm" />
              Copy reply
            </button>
          </div>
          {preview ? (
            <section aria-label="Email preview" className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 shadow-soft">
              <p className="text-sm text-muted">In the real app this opens your own email app with this reply ready. SnapStart doesn’t send it.</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-line pb-2 text-[15px]">
                <dt className="font-semibold text-muted">To</dt>
                <dd className="break-all">{email.from}</dd>
                <dt className="font-semibold text-muted">Subject</dt>
                <dd>{replySubject(email.subject)}</dd>
              </dl>
              <p aria-label="Body" className="whitespace-pre-wrap break-words text-[15px]">
                {reply}
              </p>
            </section>
          ) : (
            <p className="text-sm text-muted">Shows the reply to {email.from} as it would open in your own email app.</p>
          )}
          <p role="status" className="text-sm text-accent">
            {copied}
          </p>
          <button type="button" className={`${SECONDARY} w-fit`} disabled={!reply.trim()} onClick={() => setSent(true)}>
            <Icon name="check" size="sm" />
            I sent it
          </button>
        </>
      )}
    </div>
  );
}

