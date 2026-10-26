"use client";

import { useEffect, useRef } from "react";

// Moves focus here after a switch or a new business is saved, so screen readers announce it
export function BusinessHeading({
  businessId,
  focusOnMount = false,
  children,
}: {
  businessId: string;
  focusOnMount?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const changed = shown.current !== null && shown.current !== businessId;
    if (changed || (shown.current === null && focusOnMount)) ref.current?.focus();
    shown.current = businessId;
  }, [businessId, focusOnMount]);

  return (
    <h1 ref={ref} tabIndex={-1} className="font-display text-4xl font-bold leading-tight tracking-tight">
      {children}
    </h1>
  );
}
