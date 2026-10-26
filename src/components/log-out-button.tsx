"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";

export function LogOutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  // Asks the auth route for the session once per page load, which also renews the cookie
  useEffect(() => {
    authClient.getSession().catch(() => {});
  }, []);

  async function logOut() {
    setPending(true);
    setFailed(false);
    try {
      const { error } = await authClient.signOut();
      if (!error) {
        // Full page load clears every screen kept in memory, including signed-in content
        window.location.replace("/login");
        return;
      }
    } catch {
      // Falls through to the error message
    }
    setFailed(true);
    setPending(false);
  }

  return (
    <div className="flex items-center gap-2">
      {failed ? (
        <span role="alert" className="text-sm text-danger">
          Couldn’t log out. Try again.
        </span>
      ) : null}
      <button
        type="button"
        onClick={logOut}
        disabled={pending}
        className="min-h-11 rounded-lg px-3 text-sm font-semibold text-rule underline underline-offset-4 hover:bg-rule-tint disabled:opacity-60"
      >
        {pending ? "Logging out…" : "Log out"}
      </button>
    </div>
  );
}
