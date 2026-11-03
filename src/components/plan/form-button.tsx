"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import type { ActionResult } from "@/app/(app)/business/actions";
import { RUNNING_ELSEWHERE, useJobWatch } from "@/components/job-watch";
import { PRIMARY, SECONDARY } from "@/components/styles";
import { Working } from "@/components/working";
import { failedMessage } from "@/lib/failure";

interface Props {
  action: (input: { stepId: string; formKey: string; requestKey: string }) => Promise<ActionResult<string>>;
  stepId: string;
  formKey: string;
  label: string;
  pendingLabel: string;
  pendingStatus?: string;
  primary?: boolean;
}

// One request key, made on the first click and kept for retries, so a lost connection opens the document already made
export function FormButton({ action, stepId, formKey, label, pendingLabel, pendingStatus, primary }: Props) {
  const router = useRouter();
  const requestKey = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = useJobWatch();
  useLayoutEffect(() => () => setError(null), []);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const result = await action({ stepId, formKey, requestKey: (requestKey.current ??= crypto.randomUUID()) });
      if (!result.ok && result.busy) job.watch([result.busy]);
      else if (!result.ok) setError(result.message);
      else router.push(`/documents/${encodeURIComponent(result.value)}`);
    } catch {
      setError(failedMessage());
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button data-writes type="button" onClick={run} disabled={pending || job.watching} className={primary ? PRIMARY : SECONDARY}>
        {pending || job.watching ? pendingLabel : label}
      </button>
      {job.watching ? (
        <Working label={RUNNING_ELSEWHERE} active />
      ) : (
        <p role="status" className={pending && pendingStatus ? "text-sm text-muted" : "sr-only"}>
          {pending ? (pendingStatus ?? pendingLabel) : ""}
        </p>
      )}
      {error ? (
        <p role="alert" className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
          {error}
        </p>
      ) : null}
    </div>
  );
}
