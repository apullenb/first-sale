"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import type { ActionResult } from "@/app/(app)/business/actions";
import { PRIMARY, SECONDARY } from "@/components/styles";

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
  useLayoutEffect(() => () => setError(null), []);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const result = await action({ stepId, formKey, requestKey: (requestKey.current ??= crypto.randomUUID()) });
      if (!result.ok) setError(result.message);
      else router.push(`/documents/${encodeURIComponent(result.value)}`);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={run} disabled={pending} className={primary ? PRIMARY : SECONDARY}>
        {pending ? pendingLabel : label}
      </button>
      <p role="status" className={pending && pendingStatus ? "text-sm text-muted" : "sr-only"}>
        {pending ? (pendingStatus ?? pendingLabel) : ""}
      </p>
      {error ? (
        <p role="alert" className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
          {error}
        </p>
      ) : null}
    </div>
  );
}
