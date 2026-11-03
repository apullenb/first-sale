"use client";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useState, useTransition } from "react";
import {
  getForwardingAddress,
  hideForwardingConfirmation,
  newForwardingAddress,
  readNewCustomerEmail,
} from "@/app/(app)/email/actions";
import { Icon, type IconName } from "@/components/icons";
import { JobWatch, RUNNING_ELSEWHERE, useJobWatch } from "@/components/job-watch";
import { ALERT, OUTSIDE_LINK, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";
import { Card, Chip } from "@/components/ui";
import { Working } from "@/components/working";
import {
  FORWARD_AUTO,
  FORWARD_ONE,
  type ForwardSource,
  type StepIcon,
} from "@/data/email-forwarding";
import type { ForwardingConfirmation } from "@/lib/email/confirmation";

export interface ForwardingState {
  available: boolean;
  address: string | null;
  confirmation: ForwardingConfirmation | null;
  firstFrom: string | null;
  firstAt: string | null;
  waiting: number;
  reading: boolean;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setCopied(`${key}:failed`);
    }
    window.setTimeout(() => setCopied(null), 3000);
  }
  return { copied, copy };
}

// Accessible tabs: arrow keys move between them
function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  small = false,
}: {
  label: string;
  tabs: { id: T; label: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  small?: boolean;
}) {
  const base = useId();
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`${base}-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          tabIndex={tab.id === value ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
            if (!step) return;
            const next = tabs[(index + step + tabs.length) % tabs.length];
            onChange(next.id);
            document.getElementById(`${base}-${next.id}`)?.focus();
          }}
          className={`inline-flex items-center gap-2 rounded-[10px] border px-3.5 font-semibold transition ${small ? "min-h-10 text-[15px]" : "min-h-12"} ${
            tab.id === value
              ? "border-accent bg-accent-tint text-accent-ink"
              : "border-line bg-surface text-rule hover:border-muted"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

const STEP_ICONS: Record<StepIcon, IconName> = {
  open: "mail",
  forward: "forward",
  paste: "copy",
  send: "send",
  back: "refresh",
};

function Sources({ sources, unstated }: { sources: ForwardSource[]; unstated?: string }) {
  if (!sources.length && !unstated) return null;
  return (
    <div className="flex flex-col gap-1 text-sm text-muted">
      {sources.map((source) => (
        <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent">
          From {source.title}, checked {source.checked}
        </a>
      ))}
      {unstated ? <p>{unstated}</p> : null}
    </div>
  );
}

function Numbered({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((step, index) => (
        <li key={index} className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">
            {index + 1}
          </span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export function ForwardingSetup({ state }: { state: ForwardingState }) {
  const [pending, start] = useTransition(),
    [message, setMessage] = useState(""),
    [tab, setTab] = useState<"one" | "auto" | "test">("one"),
    [one, setOne] = useState<(typeof FORWARD_ONE)[number]["id"]>("gmail-app"),
    [auto, setAuto] = useState<(typeof FORWARD_AUTO)[number]["id"]>("gmail");
  const router = useRouter();
  const job = useJobWatch();
  const { copied, copy } = useCopy();

  // Checks for a test email or a confirmation code while the owner waits on this page
  const watching =
    !!state.address &&
    ((tab === "test" && !state.firstAt) || (tab === "auto" && !state.confirmation));
  useEffect(() => {
    if (!watching) return;
    let rounds = 0;
    const timer = window.setInterval(() => {
      if (++rounds > 40 || document.hidden) return;
      router.refresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [watching, router]);

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    start(async () => {
      try {
        setMessage((await action()).message);
      } catch {
        setMessage("Could not complete that. Try again.");
      }
    });
  }
  function readNew() {
    start(async () => {
      try {
        const result = await readNewCustomerEmail();
        if (result.busy) {
          setMessage("");
          job.watch([result.busy]);
        } else setMessage(result.message);
      } catch {
        setMessage("Could not read your emails. Try again.");
      }
    });
  }

  if (!state.available)
    return (
      <Card title="Your SnapStart email address" id="email-address" icon="mail">
        <p className="text-muted">The forwarding address isn’t set up on this site yet. You can still paste emails or upload invoices below.</p>
      </Card>
    );
  if (!state.address)
    return (
      <Card title="Your SnapStart email address" id="email-address" icon="mail">
        <p className="text-lg">Send customer emails to your own SnapStart address and SnapStart turns them into orders.</p>
        <button data-writes type="button" className={`${PRIMARY} w-fit text-lg`} disabled={pending} onClick={() => run(getForwardingAddress)}>
          {pending ? "Making your address…" : "Get my SnapStart address"}
        </button>
        <p role="status" className="text-sm text-accent">{message}</p>
      </Card>
    );

  const address = state.address;
  const confirmation = state.confirmation;
  const reading = pending || job.watching;
  const copyAddress = (key: string, className = PRIMARY) => (
    <button type="button" className={className} onClick={() => copy(key, address)}>
      <Icon name={copied === key ? "check" : "copy"} size="sm" />
      {copied === key ? "Copied!" : "Copy address"}
    </button>
  );
  const oneGuide = FORWARD_ONE.find((item) => item.id === one)!;
  const autoGuide = FORWARD_AUTO.find((item) => item.id === auto)!;

  return (
    <>
      <Card title="Your SnapStart email address" id="email-address" icon="mail">
        <p className="text-lg">Send customer emails to this address and SnapStart turns them into orders.</p>
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-accent bg-accent-tint p-4 sm:p-5">
          <p aria-label="Your SnapStart address" className="break-all font-mono text-lg font-bold text-accent-ink sm:text-xl">
            {address}
          </p>
          {copyAddress("address", `${PRIMARY} min-h-14 w-full text-lg sm:w-fit`)}
          {copied === "address:failed" ? <p className="text-sm text-check">Couldn’t copy. Press and hold the address to copy it.</p> : null}
        </div>

        {confirmation ? (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border-2 border-check-ring bg-check-tint p-4 text-check">
            <p className="text-lg font-bold">
              {confirmation.code
                ? `${confirmation.provider} sent a confirmation code: ${confirmation.code}`
                : `${confirmation.provider} sent a confirmation link`}
            </p>
            <p className="text-ink">
              {confirmation.code
                ? `Copy it, then paste it back in ${confirmation.provider} where it asks for the code and click Verify.`
                : `Open the link to confirm your SnapStart address in ${confirmation.provider}, then go back to ${confirmation.provider}’s forwarding settings.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {confirmation.code ? (
                <button type="button" className={PRIMARY} onClick={() => copy("code", confirmation.code!)}>
                  <Icon name={copied === "code" ? "check" : "copy"} size="sm" />
                  {copied === "code" ? "Copied!" : "Copy code"}
                </button>
              ) : null}
              {confirmation.link ? (
                <a href={confirmation.link} target="_blank" rel="noopener noreferrer nofollow" className={OUTSIDE_LINK}>
                  <Icon name="external" size="sm" />
                  Open {confirmation.provider}’s confirmation link ({new URL(confirmation.link).hostname})
                </a>
              ) : null}
              <button data-writes type="button" className={SECONDARY} disabled={pending} onClick={() => run(hideForwardingConfirmation)}>
                Done, hide this
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 rounded-xl border border-line bg-wash p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={state.waiting ? "accent" : "gray"} icon="mail">
              {state.waiting
                ? `${state.waiting} new email${state.waiting === 1 ? "" : "s"} waiting`
                : "No new emails waiting"}
            </Chip>
          </div>
          <button data-writes type="button" className={`${PRIMARY} w-fit`} disabled={reading} onClick={readNew}>
            {reading ? "Reading…" : "Read new emails"}
          </button>
          {job.watching ? (
            <Working label={RUNNING_ELSEWHERE} active />
          ) : state.reading && !pending ? (
            <JobWatch jobs={[{ workflow: "email_import", subjectId: null }]} what="Reading your emails" />
          ) : null}
          <p className="text-sm text-muted">Orders and requests are added for your review. Nothing is sent to customers.</p>
        </div>

        {state.firstAt && state.firstFrom ? (
          <p className="flex items-center gap-2 font-semibold text-done">
            <Icon name="check" size="sm" />
            It works! We got your email from {state.firstFrom}.
          </p>
        ) : null}
        <p className="flex items-start gap-2 text-[15px] text-muted">
          <Icon name="lock" size="sm" className="mt-0.5 shrink-0" />
          Only emails you send or forward to this address reach SnapStart. SnapStart can’t see anything else in your inbox.
        </p>
        <p role="status" className="text-sm text-accent">{message}</p>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-muted">Get a new address</summary>
          <div className="mt-2 flex flex-col gap-2">
            <p className="text-muted">Your current address stops working right away. Anything you set up to forward there needs the new one.</p>
            <button data-writes type="button" className={`${SECONDARY} w-fit`} disabled={pending} onClick={() => run(newForwardingAddress)}>
              Get a new address
            </button>
          </div>
        </details>
      </Card>

      <Card title="Set it up" id="email-setup" icon="checklist">
        <Tabs
          label="How to send emails to SnapStart"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "one", label: <>Forward one email <span className="text-sm font-normal">· 30 seconds</span></> },
            { id: "auto", label: "Forward automatically" },
            { id: "test", label: "Test it" },
          ]}
        />

        {tab === "one" ? (
          <div role="tabpanel" className="flex flex-col gap-4">
            <p>Works on your phone. Do this whenever a customer emails you about an order.</p>
            <Tabs label="Your email app" small value={one} onChange={setOne} tabs={FORWARD_ONE.map((guide) => ({ id: guide.id, label: guide.label }))} />
            <ol className="flex flex-col gap-3">
              {oneGuide.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3 rounded-xl border border-line p-3">
                  <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-accent-ring bg-accent-tint text-accent">
                    <Icon name={STEP_ICONS[step.icon]} />
                  </span>
                  <span className="flex flex-col gap-2 pt-1">
                    {step.text}
                    {step.icon === "paste" ? copyAddress("step", `${SECONDARY} w-fit`) : null}
                  </span>
                </li>
              ))}
            </ol>
            <Sources sources={[oneGuide.source]} unstated={oneGuide.unstated} />
          </div>
        ) : tab === "auto" ? (
          <div role="tabpanel" className="flex flex-col gap-4">
            <p>Set it once and new emails come to SnapStart on their own. Pick your email:</p>
            <Tabs label="Your email service" small value={auto} onChange={setAuto} tabs={FORWARD_AUTO.map((guide) => ({ id: guide.id, label: guide.label }))} />
            {autoGuide.where ? <p className={ALERT}>{autoGuide.where}</p> : null}
            {autoGuide.needsPlan ? <p className={ALERT}>{autoGuide.needsPlan}</p> : null}
            {autoGuide.filter ? (
              <p className="rounded-xl border border-accent-ring bg-accent-tint px-3.5 py-3 text-[15px] text-accent-ink">
                <strong>Tip:</strong> to keep personal email private, forward only emails about orders. The steps are below.
              </p>
            ) : null}
            <Numbered steps={autoGuide.steps} />
            {autoGuide.confirms ? <p className="font-semibold">{autoGuide.confirms}</p> : null}
            {autoGuide.filter ? (
              <details className="rounded-xl border border-line p-4">
                <summary className="cursor-pointer font-semibold text-accent">
                  Recommended: {autoGuide.filter.title.toLowerCase()}
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  <p>Only emails with words like order, quote or booking go to SnapStart. Everything else stays private.</p>
                  <Numbered steps={autoGuide.filter.steps} />
                  <Sources sources={[autoGuide.filter.source]} unstated={autoGuide.filter.unstated} />
                </div>
              </details>
            ) : null}
            <Sources sources={autoGuide.sources} unstated={autoGuide.unstated} />
          </div>
        ) : (
          <div role="tabpanel" className="flex flex-col gap-4">
            {state.firstAt && state.firstFrom ? (
              <p className="flex items-center gap-2 rounded-xl border border-done/25 bg-done-tint p-4 text-lg font-bold text-done">
                <Icon name="check" />
                It works! We got your email from {state.firstFrom}.
              </p>
            ) : (
              <>
                <Numbered
                  steps={[
                    <span key="copy" className="flex flex-col gap-2">Copy your SnapStart address. {copyAddress("test", `${SECONDARY} w-fit`)}</span>,
                    "From any email, send a short message to that address. For example: “Testing SnapStart.”",
                    "Wait a minute. This page checks for it on its own.",
                    "When it says “It works!”, tap Read new emails.",
                  ]}
                />
                <p className="flex items-center gap-2 text-muted">
                  <Icon name="clock" size="sm" />
                  Waiting for your first email…
                </p>
                <button type="button" className={`${SECONDARY} w-fit`} onClick={() => router.refresh()}>
                  Check now
                </button>
              </>
            )}
            <p className="text-sm text-muted">
              Didn’t arrive after a few minutes? Check that the address matches exactly, or{" "}
              <a href="#email-import" className={TEXT_LINK}>paste the email instead</a>.
            </p>
          </div>
        )}
      </Card>
    </>
  );
}
