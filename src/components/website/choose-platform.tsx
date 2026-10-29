"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { choosePlatformAction } from "@/app/(app)/website/actions";
import { Icon } from "@/components/icons";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";
import type { PlatformId } from "@/lib/website/types";

// payment: the First Sale site opens a demo payment screen first; no card details are ever asked for
export function ChoosePlatformButton({
  platform,
  name,
  chosen,
  payment,
}: {
  platform: PlatformId;
  name: string;
  chosen: boolean;
  payment?: { price: string; plan: string };
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  useLayoutEffect(() => () => setError(null), []);

  async function choose() {
    setPending(true);
    setError(null);
    try {
      const result = await choosePlatformAction(chosen ? null : platform);
      if (!result.ok) setError(result.message);
      else dialog.current?.close();
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function start() {
    if (payment && !chosen) {
      setError(null);
      dialog.current?.showModal();
      setOpen(true);
    } else void choose();
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" disabled={pending} onClick={start} className={chosen ? SECONDARY : PRIMARY}>
        {chosen ? <Icon name="back" size="sm" /> : <Icon name="check" size="sm" />}
        {pending && !open ? "Saving…" : chosen ? "Undo my choice" : `Choose ${name}`}
      </button>
      {error && !open ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
      {payment ? (
        <dialog
          ref={dialog}
          onClose={() => setOpen(false)}
          aria-labelledby={`${uid}-title`}
          className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40"
        >
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 id={`${uid}-title`} className="font-display text-[22px] leading-snug">
                Start your {payment.plan}
              </h2>
              <button type="button" onClick={() => dialog.current?.close()} className={`${SECONDARY} size-11 shrink-0 px-0`} aria-label="Close">
                <Icon name="close" size="sm" />
              </button>
            </div>
            <p className="flex items-start gap-2.5 rounded-xl border border-check-ring bg-check-tint px-3.5 py-3 font-semibold text-check">
              <Icon name="info" className="mt-0.5" />
              For demo purposes only. No payment is taken.
            </p>
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-3">
              <span className="font-semibold">{payment.plan}</span>
              <span className="text-right">
                <strong>{payment.price}</strong> <span className="text-sm text-muted">(demo price)</span>
              </span>
            </div>
            <div className="flex flex-col gap-1.5" aria-hidden="true">
              <span className="text-sm font-semibold text-muted">Card</span>
              <div className="flex min-h-12 items-center gap-2.5 rounded-[10px] border border-dashed border-line-strong bg-wash px-3 text-[15px] text-muted">
                <Icon name="card" size="sm" />
                Not collected in this demo
              </div>
            </div>
            <p className="text-sm text-muted">In the demo, continuing just picks this package so you can build your site. You can undo it any time.</p>
            {error ? (
              <p role="alert" className={ALERT}>
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={choose} className={PRIMARY}>
                <Icon name="arrow" size="sm" />
                {pending ? "Saving…" : "Continue (demo)"}
              </button>
              <button type="button" onClick={() => dialog.current?.close()} className={SECONDARY}>
                Close
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
