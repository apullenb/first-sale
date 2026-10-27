"use client";

import { useSyncExternalStore } from "react";

const DATE = { month: "short", day: "numeric", year: "numeric" } as const;
const subscribe = () => () => {};

// The server renders the UTC date; the browser switches to the owner's own time zone
export function LocalDate({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => new Date(iso).toLocaleDateString("en-US", DATE),
    () => new Date(iso).toLocaleDateString("en-US", { ...DATE, timeZone: "UTC" }),
  );
  return <time dateTime={iso}>{text}</time>;
}
