"use client";

import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { uploadRecordAction } from "@/app/(app)/documents/form-actions";
import { Icon } from "@/components/icons";
import { ALERT, INPUT, SECONDARY } from "@/components/styles";

const ROLES = [
  ["receipt", "A receipt or filing confirmation"],
  ["approval", "An approval, license or registration"],
  ["supporting", "Something else for this step"],
] as const;

// Saves a receipt or approval to the step, as uploaded; it isn't sent to the AI service
export function RecordUpload({ stepId, accept }: { stepId: string; accept: string }) {
  const uid = useId();
  const router = useRouter();
  // One per file chosen, made on first send and kept for retries, so a lost connection can't save it twice
  const requestKey = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useLayoutEffect(() => () => setError(null), []);

  async function submit(form: FormData) {
    form.set("requestKey", (requestKey.current ??= crypto.randomUUID()));
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const result = await uploadRecordAction(form);
      if (!result.ok) setError(result.message);
      else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-2.5">
      <input type="hidden" name="stepId" value={stepId} />
      <label htmlFor={`${uid}-role`} className="font-semibold">
        What is it?
      </label>
      <select id={`${uid}-role`} name="role" defaultValue="receipt" className={`${INPUT} max-w-md`}>
        {ROLES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <label htmlFor={`${uid}-file`} className="font-semibold">
        File <span className="font-normal text-muted">(PDF or photo, up to 4 MB)</span>
      </label>
      <input
        id={`${uid}-file`}
        name="file"
        type="file"
        required
        accept={accept}
        onChange={() => (requestKey.current = null)}
        className="min-h-11 max-w-full rounded-[10px] border border-line-strong bg-soft p-2 text-sm file:mr-3 file:min-h-9 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:font-semibold"
      />
      <button type="submit" disabled={pending} className={`${SECONDARY} w-fit`}>
        <Icon name="upload" size="sm" />
        {pending ? "Saving…" : "Save to this step"}
      </button>
      <p role="status" className={saved ? "flex items-center gap-1.5 text-sm font-semibold text-done" : "sr-only"}>
        {saved ? (
          <>
            <Icon name="check" size="sm" />
            Saved to your documents.
          </>
        ) : (
          ""
        )}
      </p>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
