"use client";
import { useSyncExternalStore } from "react";

function subscribeToday(notify: () => void) {
  const timer = setInterval(notify, 60_000);
  return () => clearInterval(timer);
}
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function useLocalToday(serverToday: string) {
  return useSyncExternalStore(subscribeToday, localToday, () => serverToday);
}
