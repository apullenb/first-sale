"use client";

import { useEffect, useRef, useState } from "react";

// One key per intended request, kept across retries, so repeating it can't pay for a second edit.
// Clear it after success or when the owner changes what they're asking for.
export function useRequestKey() {
  const key = useRef<string | null>(null);
  return {
    get: () => (key.current ??= crypto.randomUUID()),
    clear: () => {
      key.current = null;
    },
  };
}

// Progress for a long job. Always rendered, so screen readers announce it; the timer isn't read out.
export function Working({ label, active }: { label: string; active: boolean }) {
  return (
    <p role="status" className={active ? "flex items-center gap-2.5 rounded-xl bg-ai-tint px-4 py-3 text-[15px] text-ai-ink" : "sr-only"}>
      {active ? (
        <>
          <span aria-hidden="true" className="size-3 shrink-0 animate-pulse rounded-full bg-ai" />
          <span>
            {label} <Elapsed />
          </span>
        </>
      ) : null}
    </p>
  );
}

export function Elapsed() {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.floor((now - started) / 1000);
  return (
    <span aria-hidden="true" className="tabular-nums">
      ({Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")})
    </span>
  );
}
