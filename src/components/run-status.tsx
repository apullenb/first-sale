"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// A job started earlier, perhaps before a reload: shows that it's still going and refreshes until it ends
export function RunStatus({ status, message, what }: { status: "running" | "failed"; message: string | null; what: string }) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => router.refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [status, router]);

  if (status === "running") {
    return (
      <p role="status" className="rounded-xl bg-ai-tint px-4 py-3 text-[15px] text-ai-ink">
        {what} is still running. This page will update when it finishes.
      </p>
    );
  }
  return (
    <p role="alert" className="rounded-xl bg-check-tint px-4 py-3 text-[15px] text-check">
      {what} didn’t finish last time. {message ?? "Try again."}
    </p>
  );
}
