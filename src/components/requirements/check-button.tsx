"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { checkRequirementsAction, followUpAction, replanAction } from "@/app/(app)/requirements/actions";
import { Icon } from "@/components/icons";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";
import { Working } from "@/components/working";

const STYLES = { primary: PRIMARY, secondary: SECONDARY };

const WORKING = {
  check: "Reading official government pages and checking each requirement. This can take a minute or two.",
  follow: "Looking deeper on each office’s own site and deciding what your business needs. This can take a minute or two.",
  replan: "Updating your steps for your new choices.",
};

type Phase = keyof typeof WORKING;

// The check, then the deeper look, as one job. `auto` starts it as soon as the page opens; `from` skips straight to a later part.
export function CheckRequirementsButton({
  label,
  variant,
  auto = false,
  from = "check",
}: {
  label: string;
  variant: keyof typeof STYLES;
  auto?: boolean;
  from?: Phase;
}) {
  const [phase, setPhase] = useState<Phase | null>(null);
  const pending = phase !== null;
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Clear old errors when the page is hidden: kept-mounted screens keep their state
  useLayoutEffect(() => () => setError(null), []);

  async function run(start: Phase) {
    setError(null);
    try {
      if (start === "replan") {
        setPhase("replan");
        const result = await replanAction();
        if (!result.ok) setError(result.message);
        return;
      }
      if (start === "check") {
        setPhase("check");
        const result = await checkRequirementsAction();
        if (!result.ok) return setError(result.message);
      }
      setPhase("follow");
      const deeper = await followUpAction();
      if (!deeper.ok) setError(deeper.message);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPhase(null);
    }
  }

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    void run(from);
    // Once per page open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <div className="flex flex-col items-start gap-2">
      {auto && !error ? null : (
        <button type="button" onClick={() => run(from)} disabled={pending} className={STYLES[variant]}>
          <Icon name={variant === "primary" ? "search" : "refresh"} size="sm" />
          {pending ? "Checking official sources…" : error && auto ? "Try again" : label}
        </button>
      )}
      <Working label={phase ? WORKING[phase] : ""} active={pending} />
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
