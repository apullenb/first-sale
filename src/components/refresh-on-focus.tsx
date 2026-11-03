"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { focusRefresher } from "./focus-refresher";

// Re-reads the page's data when the owner comes back to this tab, so counts changed in another tab show
export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const onReturn = focusRefresher(() => router.refresh());
    const handler = () => onReturn(document.visibilityState === "visible");
    window.addEventListener("focus", handler);
    document.addEventListener("visibilitychange", handler);
    return () => {
      window.removeEventListener("focus", handler);
      document.removeEventListener("visibilitychange", handler);
    };
  }, [router]);
  return null;
}
