"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import type { ActionResult } from "@/app/(app)/business/actions";
import { RUNNING_ELSEWHERE, useJobWatch } from "./job-watch";
import { AI_BUTTON, DANGER, PRIMARY, SECONDARY } from "./styles";
import { Working } from "./working";

const STYLES = { primary: PRIMARY, secondary: SECONDARY, ai: AI_BUTTON, danger: DANGER };

interface Props {
  action: () => Promise<ActionResult<unknown>>;
  label: string;
  pendingLabel: string;
  // Read to screen readers while it runs, such as how long it takes
  pendingStatus?: string;
  variant?: keyof typeof STYLES;
  // Opens the document the action returns
  openDocument?: boolean;
  // Asked first, for actions that can't be undone
  confirm?: string;
  doneHref?: string;
  // Shows the AI progress indicator while it runs; on for the AI style
  ai?: boolean;
}

// A button that runs one server action, with a pending state and a readable error
export function ActionButton({ action, label, pendingLabel, pendingStatus, variant = "secondary", openDocument, confirm, doneHref, ai = variant === "ai" }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = useJobWatch();

  // Clear old errors when the page is hidden: kept-mounted screens keep their state
  useLayoutEffect(() => () => setError(null), []);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        if (result.busy) job.watch([result.busy]);
        else setError(result.message);
        return;
      }
      if (openDocument && typeof result.value === "string") router.push(`/documents/${result.value}`);
      else if (doneHref) router.push(doneHref);
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={run} disabled={pending || job.watching} className={STYLES[variant]}>
        {pending || job.watching ? pendingLabel : label}
      </button>
      {job.watching ? (
        <Working label={RUNNING_ELSEWHERE} active />
      ) : ai ? (
        <Working label={pendingStatus ?? pendingLabel} active={pending} />
      ) : (
        // Always rendered, so screen readers announce the change
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
