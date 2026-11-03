"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { clearAlreadyHaveAction, setAlreadyHaveAction } from "@/app/(app)/already-have-actions";
import { Icon } from "@/components/icons";
import { ALERT, INPUT, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";

export interface AlreadyHaveProps {
  // A mark key such as "logo", or "social:instagram"
  markKey: string;
  // "I already have a logo"
  label: string;
  // What the panel asks for, in a sentence
  help: string;
  done: { url: string | null; note: string | null } | null;
  // Shown when the step takes a link, like "Your website’s address"
  linkLabel?: string;
  // Extra things to add from the panel, such as an upload
  children?: ReactNode;
}

const SMALL = `${SECONDARY} text-[15px]`;

// For owners who did a step before SnapStart: mark it done, with a link or note, and undo it any time
export function AlreadyHave({ markKey, label, help, done, linkLabel, children }: AlreadyHaveProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(done?.url ?? "");
  const [note, setNote] = useState(done?.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  // Opening, closing, saving or undoing swaps the content, so focus moves with it
  const marked = Boolean(done);
  useEffect(() => {
    if (!moved.current) return;
    (open ? heading : button).current?.focus();
  }, [open, marked]);
  const toggle = (next: boolean) => {
    moved.current = true;
    setError(null);
    setOpen(next);
  };

  async function run(work: () => Promise<{ ok: boolean; message?: string }>) {
    moved.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await work();
      if (!result.ok) setError(result.message ?? "Something went wrong. Try again.");
      else setOpen(false);
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const alert = error ? (
    <p role="alert" className={ALERT}>
      {error}
    </p>
  ) : null;

  if (done && !open) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-done/25 bg-done-tint px-3.5 py-3 text-[15px] text-done">
          <Icon name="check" size="sm" strokeWidth={2.4} />
          <span className="font-semibold">You already have this.</span>
          {done.url ? (
            <a href={done.url} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} break-all`}>
              {done.url}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
          {done.note ? <span className="text-ink">{done.note}</span> : null}
          <span className="ml-auto flex gap-3">
            <button ref={button} type="button" onClick={() => toggle(true)} className={`min-h-11 ${TEXT_LINK}`}>
              Change
            </button>
            <button type="button" disabled={pending} onClick={() => run(() => clearAlreadyHaveAction(markKey))} className={`min-h-11 ${TEXT_LINK} disabled:opacity-60`}>
              Undo
            </button>
          </span>
        </div>
        {alert}
      </div>
    );
  }

  if (!open) {
    return (
      <button ref={button} type="button" onClick={() => toggle(true)} className={`${SMALL} w-fit`}>
        <Icon name="check" size="sm" />
        {label}
      </button>
    );
  }

  return (
    <section aria-labelledby={`${uid}-heading`} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${uid}-heading`} ref={heading} tabIndex={-1} className="font-display text-[22px] leading-snug outline-none">
          {label}
        </h2>
        <button type="button" onClick={() => toggle(false)} className={`${SMALL} min-h-11`}>
          <Icon name="close" size="sm" />
          Cancel
        </button>
      </div>
      <p className="text-[15px] text-muted">{help}</p>
      {children}
      {linkLabel ? (
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">
            {linkLabel} <span className="font-normal text-muted">(optional)</span>
          </span>
          <input type="url" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" maxLength={500} className={INPUT} />
        </label>
      ) : null}
      <label className="flex flex-col gap-1.5">
        <span className="font-semibold">
          Note for your records <span className="font-normal text-muted">(optional)</span>
        </span>
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} className={INPUT} />
      </label>
      {alert}
      <button type="button" disabled={pending} onClick={() => run(() => setAlreadyHaveAction({ key: markKey, url: linkLabel ? url : "", note }))} className={`${PRIMARY} w-fit`}>
        <Icon name="check" size="sm" />
        {pending ? "Saving…" : "Mark as done"}
      </button>
    </section>
  );
}
