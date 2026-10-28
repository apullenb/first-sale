"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { setStepStatusAction } from "@/app/(app)/checklist/actions";
import { uploadRecordAction } from "@/app/(app)/documents/form-actions";
import { PRIMARY, SECONDARY } from "@/components/styles";

// For a step the owner finished before or outside First Sale: marks it done, with the paperwork if they have it
export function AlreadyDone({ stepId, accept }: { stepId: string; accept: string }) {
  const uid = useId();
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  // One per file chosen, kept for retries, so a lost connection can't save it twice
  const requestKey = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  // Opening or cancelling swaps the content, so focus moves with it
  const opener = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    (open ? heading.current : opener.current)?.focus();
  }, [open]);
  const toggle = (next: boolean) => {
    moved.current = true;
    setOpen(next);
  };
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const chosen = file.current?.files?.[0];
      if (chosen) {
        const form = new FormData();
        form.set("stepId", stepId);
        form.set("role", "approval");
        form.set("file", chosen);
        form.set("requestKey", (requestKey.current ??= crypto.randomUUID()));
        const uploaded = await uploadRecordAction(form);
        if (!uploaded.ok) {
          setError(uploaded.message);
          return;
        }
      }
      const result = await setStepStatusAction({ stepId, status: "done", note: "Done before or outside First Sale", confirmed });
      if (!result.ok) setError(result.message);
      else router.refresh();
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div id="already-done" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button ref={opener} type="button" onClick={() => toggle(true)} className={SECONDARY}>
          I’ve already done this
        </button>
        <p className="text-sm text-muted">Did it on your own? Mark it done and add the paperwork.</p>
      </div>
    );
  }

  return (
    <section id="already-done" aria-labelledby={`${uid}-heading`} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-ink/5">
      <h2 id={`${uid}-heading`} ref={heading} tabIndex={-1} className="font-display text-xl font-bold">
        Already done
      </h2>
      <label htmlFor={`${uid}-file`} className="font-semibold">
        Add the paperwork <span className="font-normal text-muted">(optional: approval, certificate or receipt; PDF or photo, up to 4 MB)</span>
      </label>
      <input ref={file} id={`${uid}-file`} type="file" accept={accept} onChange={() => (requestKey.current = null)} className="min-h-11 max-w-full text-sm" />
      <p className="text-sm text-muted">It’s saved to this step in your library.</p>
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 accent-accent" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>I finished this step myself, before or outside First Sale.</span>
      </label>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" disabled={pending || !confirmed} onClick={save} className={PRIMARY}>
          {pending ? "Saving…" : "Mark it done"}
        </button>
        <button type="button" disabled={pending} onClick={() => toggle(false)} className={SECONDARY}>
          Cancel
        </button>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
          {error}
        </p>
      ) : null}
    </section>
  );
}
