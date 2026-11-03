"use client";

import { useRouter } from "next/navigation";
import { type RefObject, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { setStepStatusAction } from "@/app/(app)/checklist/actions";
import { uploadRecordAction } from "@/app/(app)/documents/form-actions";
import { celebrate } from "@/components/celebrate";
import { Icon } from "@/components/icons";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";
import { RecordUpload } from "./record-upload";

const SMALL = `${SECONDARY} text-[15px]`;
const PANEL = "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card";

type Panel = "done" | "upload" | null;

// The two buttons at the top of a step: mark it done if it was finished elsewhere, or save a document to it
export function AlreadyDone({ stepId, title, accept, markDone }: { stepId: string; title: string; accept: string; markDone: boolean }) {
  const uid = useId();
  const [open, setOpen] = useState<Panel>(null);
  // Opening or cancelling swaps the content, so focus moves with it
  const doneButton = useRef<HTMLButtonElement>(null);
  const uploadButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const last = useRef<Panel>(null);
  useEffect(() => {
    if (open) heading.current?.focus();
    else if (last.current) (last.current === "done" ? doneButton : uploadButton).current?.focus();
  }, [open]);
  const toggle = (next: Panel) => {
    if (next) last.current = next;
    setOpen(next);
  };

  if (open === "done") return <MarkDone uid={uid} stepId={stepId} title={title} accept={accept} heading={heading} onCancel={() => toggle(null)} />;
  if (open === "upload") {
    return (
      <section aria-labelledby={`${uid}-upload`} className={`basis-full ${PANEL}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 id={`${uid}-upload`} ref={heading} tabIndex={-1} className="font-display text-[22px] leading-snug focus:outline-none">
            Upload a document
          </h2>
          <button type="button" onClick={() => toggle(null)} className={`${SMALL} min-h-11`}>
            <Icon name="close" size="sm" />
            Close
          </button>
        </div>
        <p className="text-[15px] text-muted">A receipt, approval or anything else for this step. It’s saved to this step in your library, as uploaded.</p>
        <RecordUpload stepId={stepId} accept={accept} />
      </section>
    );
  }
  return (
    <div id="already-done" className="flex scroll-mt-4 flex-wrap gap-2">
      {markDone ? (
        <button ref={doneButton} type="button" onClick={() => toggle("done")} className={SMALL}>
          <Icon name="check" size="sm" />
          I’ve already done this
        </button>
      ) : null}
      <button ref={uploadButton} type="button" onClick={() => toggle("upload")} className={SMALL}>
        <Icon name="upload" size="sm" />
        Upload a document
      </button>
    </div>
  );
}

function MarkDone({
  uid,
  stepId,
  title,
  accept,
  heading,
  onCancel,
}: {
  uid: string;
  stepId: string;
  title: string;
  accept: string;
  heading: RefObject<HTMLHeadingElement | null>;
  onCancel: () => void;
}) {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  // One per file chosen, kept for retries, so a lost connection can't save it twice
  const requestKey = useRef<string | null>(null);
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
      const result = await setStepStatusAction({ stepId, status: "done", note: "Done before or outside SnapStart", confirmed });
      if (!result.ok) setError(result.message);
      else {
        celebrate(title);
        router.refresh();
      }
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="already-done" aria-labelledby={`${uid}-heading`} className={`basis-full ${PANEL}`}>
      <h2 id={`${uid}-heading`} ref={heading} tabIndex={-1} className="font-display text-[22px] leading-snug focus:outline-none">
        Already done
      </h2>
      <label htmlFor={`${uid}-file`} className="font-semibold">
        Add the paperwork <span className="font-normal text-muted">(optional: approval, certificate or receipt; PDF or photo, up to 4 MB)</span>
      </label>
      <input
        ref={file}
        id={`${uid}-file`}
        type="file"
        accept={accept}
        onChange={() => (requestKey.current = null)}
        className="min-h-11 max-w-full rounded-[10px] border border-line-strong bg-soft p-2 text-sm file:mr-3 file:min-h-9 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:font-semibold"
      />
      <p className="text-sm text-muted">It’s saved to this step in your library.</p>
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>I finished this step myself, before or outside SnapStart.</span>
      </label>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" data-writes disabled={pending || !confirmed} onClick={save} className={PRIMARY}>
          <Icon name="check" size="sm" />
          {pending ? "Saving…" : "Mark it done"}
        </button>
        <button type="button" disabled={pending} onClick={onCancel} className={SECONDARY}>
          Cancel
        </button>
      </div>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
