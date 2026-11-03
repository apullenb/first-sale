"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";

// Leaves the demo first, so sign-up starts signed out
export function StartOwnButton() {
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    await authClient.signOut().catch(() => {});
    // Full page load clears every screen kept in memory from the demo
    window.location.replace("/signup");
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={pending}
      className="inline-flex min-h-11 items-center font-semibold text-accent underline decoration-[1.5px] underline-offset-[3px] hover:text-accent-ink disabled:opacity-60"
    >
      Start your own business →
    </button>
  );
}
