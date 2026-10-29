"use client";

import { useLayoutEffect, useState } from "react";
import { choosePlatformAction } from "@/app/(app)/website/actions";
import { Icon } from "@/components/icons";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";
import type { PlatformId } from "@/lib/website/types";

export function ChoosePlatformButton({ platform, name, chosen }: { platform: PlatformId; name: string; chosen: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function choose() {
    setPending(true);
    setError(null);
    try {
      const result = await choosePlatformAction(chosen ? null : platform);
      if (!result.ok) setError(result.message);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" disabled={pending} onClick={choose} className={chosen ? SECONDARY : PRIMARY}>
        {chosen ? <Icon name="back" size="sm" /> : <Icon name="check" size="sm" />}
        {pending ? "Saving…" : chosen ? "Undo my choice" : `Build it with ${name}`}
      </button>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
