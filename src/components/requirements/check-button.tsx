"use client";

import { useLayoutEffect, useState } from "react";
import { checkRequirementsAction, followUpAction } from "@/app/(app)/requirements/actions";
import { Icon } from "@/components/icons";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";
import { Working } from "@/components/working";

const STYLES = { primary: PRIMARY, secondary: SECONDARY };

const WORKING = {
  check: "Reading official government pages and checking each requirement. This can take a minute or two.",
  follow: "Looking deeper on each office’s own site for what those pages didn’t settle, and finding who to write to. This can take a minute or two.",
};

export function CheckRequirementsButton({ label, variant }: { label: string; variant: keyof typeof STYLES }) {
  const [phase, setPhase] = useState<keyof typeof WORKING | null>(null);
  const pending = phase !== null;
  const [error, setError] = useState<string | null>(null);

  // Clear old errors when the page is hidden: kept-mounted screens keep their state
  useLayoutEffect(() => () => setError(null), []);

  async function check() {
    setPhase("check");
    setError(null);
    try {
      const result = await checkRequirementsAction();
      if (!result.ok) return setError(result.message);
      // A failed deeper look keeps the check's results; the page offers it again
      setPhase("follow");
      const deeper = await followUpAction();
      if (!deeper.ok) setError(deeper.message);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPhase(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={check} disabled={pending} className={STYLES[variant]}>
        <Icon name={variant === "primary" ? "search" : "refresh"} size="sm" />
        {pending ? "Checking official sources…" : label}
      </button>
      <Working label={phase ? WORKING[phase] : ""} active={pending} />
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
