"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

export function LiveOperations({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15_000);
    return () => clearInterval(timer);
  }, [enabled, router]);
  return null;
}
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
