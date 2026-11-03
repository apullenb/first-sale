"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { checkRequirementsAction, followUpAction, replanAction } from "@/app/(app)/requirements/actions";
import { Icon } from "@/components/icons";
import { RUNNING_ELSEWHERE, useJobWatch } from "@/components/job-watch";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";
import { Working } from "@/components/working";
import type { JobRef } from "@/lib/workflows";
import { failedMessage } from "@/lib/failure";

const STYLES = { primary: PRIMARY, secondary: SECONDARY };

const WORKING = {
  check: "Reading official government pages and checking each requirement. This can take a minute or two.",
  follow: "Looking deeper on each office’s own site and deciding what your business needs. This can take a minute or two.",
  replan: "Updating your steps for your new choices.",
};

type Phase = keyof typeof WORKING;

// The check, then the deeper look, as one job. `auto` starts it as soon as the page opens; `from` skips straight to a later part.
// A copy already running elsewhere, such as in another tab, is followed until it ends.
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
  const [error, setError] = useState<string | null>(null);
  const job = useJobWatch();
  const pending = phase !== null || job.watching;
  const started = useRef(false);

  // Clear old errors when the page is hidden: kept-mounted screens keep their state
  useLayoutEffect(() => () => setError(null), []);

  async function run(start: Phase) {
    setError(null);
    // A job running elsewhere is followed, never shown as a failure
    const failed = (result: { message: string; busy?: JobRef }) => (result.busy ? job.watch([result.busy]) : setError(result.message));
    try {
      if (start === "replan") {
        setPhase("replan");
        const result = await replanAction();
        if (!result.ok) failed(result);
        return;
      }
      if (start === "check") {
        setPhase("check");
        const result = await checkRequirementsAction();
        if (!result.ok) return failed(result);
      }
      setPhase("follow");
      const deeper = await followUpAction();
      if (!deeper.ok) failed(deeper);
    } catch {
      setError(failedMessage());
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
        <button type="button" data-writes onClick={() => run(from)} disabled={pending} className={STYLES[variant]}>
          <Icon name={variant === "primary" ? "search" : "refresh"} size="sm" />
          {pending ? "Checking official sources…" : error && auto ? "Try again" : label}
        </button>
      )}
      <Working label={job.watching ? RUNNING_ELSEWHERE : phase ? WORKING[phase] : ""} active={pending} />
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
