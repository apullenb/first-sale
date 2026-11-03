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

const DATE_TIME = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } as const;

// Date and time in the owner's own time zone once the page is in the browser
export function LocalDateTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => new Date(iso).toLocaleString("en-US", DATE_TIME),
    () => `${new Date(iso).toLocaleString("en-US", { ...DATE_TIME, timeZone: "UTC" })} UTC`,
  );
  return <time dateTime={iso}>{text}</time>;
}
