"use client";

import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { replaceDocumentAction } from "@/app/(app)/documents/form-actions";
import { SECONDARY } from "@/components/styles";

// Uploads a newer file as the next version; the one shown now stays in the history
export function ReplaceFile({ documentId, accept }: { documentId: string; accept: string }) {
  const uid = useId();
  const router = useRouter();
  // One per file chosen, made on first send and kept for retries, so a lost connection can't save it twice
  const requestKey = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function submit(form: FormData) {
    form.set("requestKey", (requestKey.current ??= crypto.randomUUID()));
    setPending(true);
    setError(null);
    try {
      const result = await replaceDocumentAction(form);
      if (!result.ok) setError(result.message);
      else router.push(`/documents/${encodeURIComponent(result.value)}`);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <details className="group">
      <summary className="flex min-h-11 w-fit cursor-pointer items-center font-semibold text-accent-ink underline underline-offset-4">Replace with a newer file</summary>
      <form action={submit} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="documentId" value={documentId} />
        <label htmlFor={`${uid}-file`} className="font-semibold">
          New file <span className="font-normal text-muted">(PDF or photo, up to 4 MB)</span>
        </label>
        <input
          id={`${uid}-file`}
          name="file"
          type="file"
          required
          accept={accept}
          onChange={() => (requestKey.current = null)}
          className="min-h-11 max-w-full text-sm"
        />
        <button type="submit" disabled={pending} className={`${SECONDARY} w-fit`}>
          {pending ? "Uploading…" : "Upload as a new version"}
        </button>
        {error ? (
          <p role="alert" className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
            {error}
          </p>
        ) : null}
      </form>
    </details>
  );
}
