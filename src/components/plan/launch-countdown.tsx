"use client";

import { useSyncExternalStore } from "react";
import { daysUntil } from "@/lib/rules/progress";

const subscribe = () => () => {};

// The server counts from today in UTC; the browser switches to the owner's own today
export function LaunchCountdown({ date }: { date: string }) {
  const days = useSyncExternalStore(
    subscribe,
    () => daysUntil(date, new Date()),
    () => {
      const now = new Date();
      return daysUntil(date, new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    },
  );
  if (days < 0) return <span className="font-display text-2xl font-bold sm:text-3xl">Passed</span>;
  return (
    <span className="font-display text-2xl font-bold sm:text-3xl">
      {days === 0 ? "Today" : days}
      {days > 0 ? <span className="ml-1 text-sm font-semibold text-muted">{days === 1 ? "day" : "days"}</span> : null}
    </span>
  );
}
