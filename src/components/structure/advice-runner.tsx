"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { adviseAction } from "@/app/(app)/structure/actions";
import { ALERT, SECONDARY } from "@/components/styles";
import { Working } from "@/components/working";

// Starts the recommendation as soon as the page opens; the page shows it once it's saved
export function AdviceRunner() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  // Clear old errors when the page is hidden: kept-mounted screens keep their state
  useLayoutEffect(() => () => setError(null), []);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const result = await adviseAction();
      if (!result.ok) setError(result.message);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, []);

  return (
    <div className="flex flex-col items-start gap-2">
      <Working label="Weighing everything you told First Sale to recommend a structure, a name plan and a tax plan." active={pending} />
      {error ? (
        <>
          <p role="alert" className={ALERT}>
            {error}
          </p>
          <button type="button" onClick={run} className={SECONDARY}>
            Try again
          </button>
        </>
      ) : null}
    </div>
  );
}
