"use client";

import { useEffect, useRef } from "react";

// Moves focus here once a new business is saved, so screen readers announce it
export function BusinessHeading({ focusOnMount = false, children }: { focusOnMount?: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  // Only the first time: a kept-mounted screen re-runs effects when shown again
  const focused = useRef(false);

  useEffect(() => {
    if (!focusOnMount || focused.current) return;
    focused.current = true;
    ref.current?.focus();
  }, [focusOnMount]);

  return (
    <h1 ref={ref} tabIndex={-1} className="font-display text-[32px] leading-[1.15] tracking-[-0.01em] sm:text-[38px]">
      {children}
    </h1>
  );
}
