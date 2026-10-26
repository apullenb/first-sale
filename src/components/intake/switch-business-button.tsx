"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { switchBusinessAction } from "@/app/(app)/business/actions";

export function SwitchBusinessButton({ businessId, name }: { businessId: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function switchTo() {
    setPending(true);
    setError(null);
    try {
      const result = await switchBusinessAction(businessId);
      if (!result.ok) setError(result.message);
      // Drops any ?welcome=, which belongs to another business
      else router.replace("/business");
    } catch {
      setError("Couldn’t switch. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={switchTo}
        disabled={pending}
        className="min-h-11 rounded-lg border border-field bg-surface px-3.5 text-sm font-semibold hover:border-muted disabled:opacity-60"
      >
        {pending ? "Switching…" : "Work on this"}
        <span className="sr-only">: {name}</span>
      </button>
    </div>
  );
}
