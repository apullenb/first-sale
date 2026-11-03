"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { INPUT, OUTSIDE_LINK, PRIMARY, SECONDARY } from "@/components/styles";
import { Card, Chip } from "@/components/ui";
import { Working } from "@/components/working";
import { DEMO_ADDRESS, DEMO_BUSINESS, DEMO_CODE, DEMO_EMAILS, DEMO_OWNER_EMAIL, type DemoEmail } from "@/data/email-demo";
import { replySubject } from "@/lib/email/mailto";
import { Numbered, SetupGuide, type SetupTab, useCopy } from "./forwarding";

// Client-side only: nothing here is saved, sent or read by AI; a reload starts over
export function EmailDemo() {
  const [round, setRound] = useState(0);
  return (
    <div className="flex flex-col gap-5">
      <Card title="Coming soon" id="email-coming-soon" icon="clock" tone="pick">
        <p className="text-lg">
          Forwarding customer emails to SnapStart is coming soon. Here’s how it will work — try it with sample emails.
        </p>
      </Card>
      <DemoBody key={round} onReset={() => setRound((value) => value + 1)} />
    </div>
  );
}

const Sample = () => <Chip tone="pick">Sample</Chip>;
const Demo = () => <Chip tone="warn">DEMO</Chip>;

function DemoBody({ onReset }: { onReset: () => void }) {
  const { copied, copy } = useCopy();
  const [tab, setTab] = useState<SetupTab>("one"),
    [tested, setTested] = useState(false),
    [reading, setReading] = useState<number | null>(null),
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

  const copyAddress = (key: string, className: string) => (
    <button type="button" className={className} onClick={() => copy(key, DEMO_ADDRESS)}>
      <Icon name={copied === key ? "check" : "copy"} size="sm" />
      {copied === key ? "Copied!" : "Copy address"}
    </button>
  );
  const orders = DEMO_EMAILS.filter((email) => confirmed.includes(email.id));

  return (
    <>
      <Card title="Your SnapStart email address" id="email-address" icon="mail" action={<Sample />}>
        <p className="text-lg">Send customer emails to this address and SnapStart turns them into orders.</p>
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-accent bg-accent-tint p-4 sm:p-5">
          <p className="text-sm font-semibold text-accent-ink">Sample address for {DEMO_BUSINESS}. Yours will be private to your business.</p>
          <p aria-label="Sample SnapStart address" className="break-all font-mono text-lg font-bold text-accent-ink sm:text-xl">
            {DEMO_ADDRESS}
          </p>
          {copyAddress("address", `${SECONDARY} min-h-14 w-full text-lg sm:w-fit`)}
          {copied === "address:failed" ? <p className="text-sm text-check">Couldn’t copy. Press and hold the address to copy it.</p> : null}
        </div>
        <p className="flex items-start gap-2 text-[15px] text-muted">
          <Icon name="lock" size="sm" className="mt-0.5 shrink-0" />
          Only emails you send or forward to this address reach SnapStart. SnapStart can’t see anything else in your inbox.
        </p>
      </Card>

      <SetupGuide
        tab={tab}
        onTab={setTab}
        copyAddress={copyAddress}
        test={
          <div role="tabpanel" className="flex flex-col gap-4">
            <Numbered
              steps={[
                <span key="copy" className="flex flex-col gap-2">Copy your SnapStart address. {copyAddress("test", `${SECONDARY} w-fit`)}</span>,
                "From any email, send a short message to that address. For example: “Testing SnapStart.”",
                "Wait a minute. This page checks for it on its own.",
                "When it says “It works!”, tap Read new emails.",
              ]}
            />
            {tested ? (
              <p className="flex items-center gap-2 rounded-xl border border-done/25 bg-done-tint p-4 text-lg font-bold text-done">
                <Icon name="check" />
                It works! We got your email from {DEMO_OWNER_EMAIL}.
              </p>
            ) : (
              <button type="button" className={`${SECONDARY} w-fit`} onClick={() => setTested(true)}>
                <Icon name="send" size="sm" />
                Pretend a test email arrived
              </button>
            )}
          </div>
        }
      />

      <Card title="Example: a Gmail confirmation code" id="email-confirmation" icon="badge" action={<Sample />}>
        <p className="text-muted">When you turn on automatic forwarding, Gmail and some others email your SnapStart address to confirm it. It shows up here, at the top of the page:</p>
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-check-ring bg-check-tint p-4 text-check">
          <p className="text-lg font-bold">Gmail sent a confirmation code: {DEMO_CODE}</p>
          <p className="text-ink">Copy it, then paste it back in Gmail where it asks for the code and click Verify.</p>
          <button type="button" className={`${SECONDARY} w-fit`} onClick={() => copy("code", DEMO_CODE)}>
            <Icon name={copied === "code" ? "check" : "copy"} size="sm" />
            {copied === "code" ? "Copied!" : "Copy code"}
          </button>
        </div>
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
          <p className="text-sm text-muted">Orders and requests are added for your review. Nothing is sent to customers.</p>
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
          <p className="text-muted">Confirm an order or request above and it shows up here.</p>
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
        <Chip tone={result.kind === "order" ? "accent" : "pick"} icon={result.kind === "order" ? "receipt" : "question"}>
          {result.kind === "order" ? "Order" : "Request"}
        </Chip>
        <Demo />
        {confirmed ? <Chip tone="done" icon="check">Added to Orders & jobs</Chip> : <Chip tone="gray">For review</Chip>}
      </div>
      <h3 id={`demo-${email.id}`} className="font-display text-xl">
        {result.title}
      </h3>
      <dl className="grid gap-x-4 gap-y-1.5 text-[15px] sm:grid-cols-[auto_1fr]">
        <dt className="font-semibold text-muted">Customer</dt>
        <dd>
          {email.fromName} ({email.from})
        </dd>
        <dt className="font-semibold text-muted">{result.kind === "order" ? "Items" : "Asking about"}</dt>
        <dd>
          <ul>
            {result.items.map((item) => (
              <li key={item.name}>
                {item.quantity} × {item.name}
              </li>
            ))}
          </ul>
        </dd>
        <dt className="font-semibold text-muted">When</dt>
        <dd>{result.when}</dd>
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
      {confirmed ? null : (
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

