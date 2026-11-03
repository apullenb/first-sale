"use client";

import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { replaceDocumentAction } from "@/app/(app)/documents/form-actions";
import { Icon } from "@/components/icons";
import { ALERT, SECONDARY } from "@/components/styles";
import { Working } from "@/components/working";
import { SubFold } from "./parts";

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
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <SubFold summary="Replace with a newer file">
      <form action={submit} className="flex flex-col gap-2.5">
        <input type="hidden" name="documentId" value={documentId} />
        <label htmlFor={`${uid}-file`} className="text-[15.5px] font-semibold">
          New file <span className="font-normal text-muted">(PDF or photo, up to 4 MB)</span>
        </label>
        <input
          id={`${uid}-file`}
          name="file"
          type="file"
          required
          accept={accept}
          onChange={() => (requestKey.current = null)}
          className="min-h-12 w-full rounded-[10px] border border-dashed border-line-strong bg-soft px-3 py-2.5 text-[15px] file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:font-semibold file:text-ink"
        />
        <button type="submit" disabled={pending} className={`${SECONDARY} w-fit`}>
          <Icon name="upload" size="sm" />
          {pending ? "Uploading…" : "Upload as a new version"}
        </button>
        <Working label="Saving the new version and reading it. This can take a minute." active={pending} />
        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
      </form>
    </SubFold>
  );
}
