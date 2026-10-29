"use client";

import { useLayoutEffect, useState } from "react";
import { checkRequirementsAction } from "@/app/(app)/requirements/actions";
import { Icon } from "@/components/icons";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";

const STYLES = { primary: PRIMARY, secondary: SECONDARY };

export function CheckRequirementsButton({ label, variant }: { label: string; variant: keyof typeof STYLES }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear old errors when the page is hidden: kept-mounted screens keep their state
  useLayoutEffect(() => () => setError(null), []);

  async function check() {
    setPending(true);
    setError(null);
    try {
      const result = await checkRequirementsAction();
      if (!result.ok) setError(result.message);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={check} disabled={pending} className={STYLES[variant]}>
        <Icon name={variant === "primary" ? "search" : "refresh"} size="sm" />
        {pending ? "Checking official sources…" : label}
      </button>
      {/* Always rendered, so screen readers announce the change */}
      <p role="status" className={pending ? "text-sm text-muted" : "sr-only"}>
        {pending ? "Reading official government pages and checking each requirement. This can take a minute or two." : ""}
      </p>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
