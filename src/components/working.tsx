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
    <p role="status" className={active ? "flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[15px] text-rule shadow-soft" : "sr-only"}>
      {active ? (
        <>
          <span aria-hidden="true" className="size-5 shrink-0 rounded-full border-2 border-accent-tint border-t-accent motion-safe:animate-spin" />
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
