"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { clearAlreadyHaveAction, setAlreadyHaveAction } from "@/app/(app)/already-have-actions";
import { connectExistingSiteAction, disconnectExistingSiteAction } from "@/app/(app)/website/site-actions";
import { Icon } from "@/components/icons";
import { PickTile } from "@/components/marketing/pieces";
import { ALERT, INPUT, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";
import { Chip } from "@/components/ui";
import { EXISTING_LABELS, hasSquareSite, siteAddress } from "@/lib/website/existing-site";
import { EXISTING_PLATFORMS, type ExistingPlatform, type ExistingSite } from "@/lib/website/types";
import { failedMessage } from "@/lib/failure";

const SMALL = `${SECONDARY} text-[15px]`;

// "I already have a website": connect it (a demo, no passwords or keys), or just record its address
export function ExistingSitePanel({ connected, marked }: { connected: ExistingSite | null; marked: { url: string | null; note: string | null } | null }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<ExistingPlatform | null>(connected?.platform ?? null);
  const [url, setUrl] = useState(connected?.url ?? marked?.url ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open]);

  async function run(work: () => Promise<{ ok: boolean; message?: string }>) {
    setPending(true);
    setError(null);
    try {
      const result = await work();
      if (!result.ok) setError(result.message ?? "Something went wrong. Try again.");
      else setOpen(false);
    } catch {
      setError(failedMessage());
    } finally {
      setPending(false);
    }
  }

  function connect() {
    if (!platform) return setError("Pick where your site is built.");
    if (!siteAddress(url)) return setError("Type your site’s address, like risebakery.com.");
    void run(() => connectExistingSiteAction({ platform, url }));
  }

  function skip() {
    const address = url.trim() ? siteAddress(url) : "";
    if (address === null) return setError("That doesn’t look like a web address. Check it, or leave it empty.");
    void run(() => setAlreadyHaveAction({ key: "website", url: address, note: platform ? `Built with ${EXISTING_LABELS[platform]}` : "" }));
  }

  const squareConnection = hasSquareSite(connected, marked) ? <Link href="/products/square" className={TEXT_LINK}>Connect Square to review and update product descriptions</Link> : null;
  const alert = error ? (
    <p role="alert" className={ALERT}>
      {error}
    </p>
  ) : null;

  if (connected && !open) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-done/25 bg-done-tint px-3.5 py-3 text-[15px] text-done">
          <Chip tone="done" icon="link">
            Website saved
          </Chip>
          <span className="text-ink">
            Your {EXISTING_LABELS[connected.platform]} site{" "}
            <a href={connected.url} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} break-all`}>
              {connected.url.replace(/^https?:\/\//, "")}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </span>
          <button type="button" data-writes disabled={pending} onClick={() => run(disconnectExistingSiteAction)} className={`ml-auto min-h-11 ${TEXT_LINK} disabled:opacity-60`}>
            Disconnect
          </button>
        </div>
        <p className="text-sm text-muted">Connect your Square account to manage supported product details here. Page design and layout are managed in your website builder.</p>
        {squareConnection}
        {alert}
      </div>
    );
  }

  if (marked && !open) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-done/25 bg-done-tint px-3.5 py-3 text-[15px] text-done">
          <Icon name="check" size="sm" strokeWidth={2.4} />
          <span className="font-semibold">You already have a website.</span>
          {marked.url ? (
            <a href={marked.url} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} break-all`}>
              {marked.url.replace(/^https?:\/\//, "")}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
          <span className="ml-auto flex gap-3">
            <button type="button" onClick={() => setOpen(true)} className={`min-h-11 ${TEXT_LINK}`}>
              Connect it
            </button>
            <button type="button" data-writes disabled={pending} onClick={() => run(() => clearAlreadyHaveAction("website"))} className={`min-h-11 ${TEXT_LINK} disabled:opacity-60`}>
              Undo
            </button>
          </span>
        </div>
        {squareConnection}
        {alert}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${SMALL} w-fit`}>
        <Icon name="check" size="sm" />I already have a website
      </button>
    );
  }

  return (
    <section aria-labelledby={`${uid}-heading`} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h2 id={`${uid}-heading`} ref={heading} tabIndex={-1} className="font-display text-[22px] leading-snug outline-none">
          Connect the website you already have
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className={`${SMALL} min-h-11 shrink-0`}
        >
          <Icon name="close" size="sm" />
          Cancel
        </button>
      </div>
      <p className="text-[15px] text-rule">
        Tell us where your site lives. For Square, you can connect your account after saving it.
      </p>
      <div className="flex flex-col gap-2">
        <p id={`${uid}-where`} className="font-semibold">
          Where is it built?
        </p>
        <div role="group" aria-labelledby={`${uid}-where`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {EXISTING_PLATFORMS.map((each) => (
            <PickTile key={each} pressed={platform === each} onClick={() => setPlatform(each)} label={EXISTING_LABELS[each]} layout="word" />
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">Your site’s address</span>
        <input
          type="url"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="risebakery.com"
          maxLength={500}
          className={INPUT}
        />
      </label>
      {alert}
      <div className="flex flex-wrap gap-2">
        <button type="button" data-writes disabled={pending} onClick={connect} className={PRIMARY}>
          <Icon name="link" size="sm" />
          {pending ? "Saving…" : `Save ${platform && platform !== "other" ? EXISTING_LABELS[platform] : "my site"} website`}
        </button>
        <button type="button" data-writes disabled={pending} onClick={skip} className={SECONDARY}>
          I don’t want to connect it
        </button>
      </div>
      <p className="text-sm text-muted">Saving your website records its platform and address. Connecting your Square account is a separate step.</p>
    </section>
  );
}
