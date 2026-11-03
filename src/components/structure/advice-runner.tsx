"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { adviseAction } from "@/app/(app)/structure/actions";
import { RUNNING_ELSEWHERE, useJobWatch } from "@/components/job-watch";
import { ALERT, SECONDARY } from "@/components/styles";
import { Working } from "@/components/working";

// Starts the recommendation as soon as the page opens; the page shows it once it's saved
export function AdviceRunner() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const job = useJobWatch();
  // Clear old errors when the page is hidden: kept-mounted screens keep their state
  useLayoutEffect(() => () => setError(null), []);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const result = await adviseAction();
      if (!result.ok && result.busy) job.watch([result.busy]);
      else if (!result.ok) setError(result.message);
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
    // Runs once, when the page opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-start gap-2">
      <Working
        label={job.watching ? RUNNING_ELSEWHERE : "Weighing everything you told SnapStart to recommend a structure, a name plan and a tax plan."}
        active={pending || job.watching}
      />
      {error ? (
        <>
          <p role="alert" className={ALERT}>
            {error}
          </p>
          <button type="button" data-writes onClick={run} className={SECONDARY}>
            Try again
          </button>
        </>
      ) : null}
    </div>
  );
}
