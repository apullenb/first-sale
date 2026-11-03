"use client";

import { useEffect, useId, useRef, useState } from "react";
import { clearAlreadyHaveAction, setAlreadyHaveAction } from "@/app/(app)/already-have-actions";
import { Icon } from "@/components/icons";
import { ALERT, INPUT, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";

interface Props {
  // "social:instagram"
  markKey: string;
  platformName: string;
  done: { url: string | null; note: string | null } | null;
  // In the marketing answers as an account the owner already has, so it counts as set up already
  had: boolean;
  noun?: "account" | "list";
}

const SMALL = `${SECONDARY} text-[15px]`;

// "Mark as set up" and "I already have this account": both save the account's mark, with its profile link
export function AccountMark({ markKey, platformName, done, had, noun = "account" }: Props) {
  const uid = useId();
  const [open, setOpen] = useState<"setup" | "have" | "link" | null>(null);
  const [url, setUrl] = useState(done?.url ?? "");
  const [note, setNote] = useState(done?.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  // Opening or closing swaps the content, so focus moves with it
  useEffect(() => {
    if (!moved.current) return;
    (open ? heading : button).current?.focus();
  }, [open]);
  const toggle = (next: typeof open) => {
    moved.current = true;
    setError(null);
    setOpen(next);
  };

  async function run(work: () => Promise<{ ok: boolean; message?: string }>) {
    setPending(true);
    setError(null);
    try {
      const result = await work();
      if (!result.ok) setError(result.message ?? "Something went wrong. Try again.");
      else setOpen(null);
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const haveLabel = noun === "list" ? "I already have an email list" : "I already have this account";
  const alert = error ? (
    <p role="alert" className={ALERT}>
      {error}
    </p>
  ) : null;

  if (open) {
    const title = open === "setup" ? "Mark as set up" : open === "have" ? haveLabel : "Add your profile link";
    return (
      <section aria-labelledby={`${uid}-heading`} className="flex flex-col gap-3 rounded-xl border border-line bg-soft p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 id={`${uid}-heading`} ref={heading} tabIndex={-1} className="font-bold outline-none">
            {title}
          </h4>
          <button type="button" onClick={() => toggle(null)} className={`${SMALL} min-h-11`}>
            <Icon name="close" size="sm" />
            Cancel
          </button>
        </div>
        <p className="text-[15px] text-muted">
          {noun === "list" ? "Add a link to your sign-up form, if you have one." : `Add your ${platformName} link so it’s here when you need it, such as for your website and other profiles.`}
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">
            {noun === "list" ? "Sign-up form link" : `Your ${platformName} link`} <span className="font-normal text-muted">(optional)</span>
          </span>
          <input type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" maxLength={500} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">
            Note for your records <span className="font-normal text-muted">(optional)</span>
          </span>
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className={INPUT} />
        </label>
        {alert}
        <button type="button" disabled={pending} onClick={() => run(() => setAlreadyHaveAction({ key: markKey, url, note }))} className={`${PRIMARY} w-fit`}>
          <Icon name="check" size="sm" />
          {pending ? "Saving…" : open === "link" ? "Save link" : "Mark as set up"}
        </button>
      </section>
    );
  }

  if (done || had) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-done/25 bg-done-tint px-3.5 py-3 text-[15px] text-done">
          <Icon name="check" size="sm" strokeWidth={2.4} />
          <span className="font-semibold">{done ? "Set up." : `You already have this ${noun}.`}</span>
          {done?.url ? (
            <a href={done.url} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} break-all`}>
              {done.url}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
          {done?.note ? <span className="text-ink">{done.note}</span> : null}
          <span className="ml-auto flex gap-3">
            <button ref={button} type="button" onClick={() => toggle(done ? "setup" : "link")} className={`min-h-11 ${TEXT_LINK}`}>
              {done ? "Change" : "Add your profile link"}
              <span className="sr-only"> for {platformName}</span>
            </button>
            {done ? (
              <button type="button" disabled={pending} onClick={() => run(() => clearAlreadyHaveAction(markKey))} className={`min-h-11 ${TEXT_LINK} disabled:opacity-60`}>
                {had ? "Remove link" : "Undo"}
                <span className="sr-only"> for {platformName}</span>
              </button>
            ) : null}
          </span>
        </div>
        {alert}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button ref={button} type="button" onClick={() => toggle("setup")} className={PRIMARY}>
        <Icon name="check" size="sm" />
        Mark as set up
      </button>
      <button type="button" onClick={() => toggle("have")} className={SMALL}>
        {haveLabel}
      </button>
    </div>
  );
}
