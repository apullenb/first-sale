"use client";

import { useLayoutEffect, useState } from "react";
import { choosePlatformAction } from "@/app/(app)/website/actions";
import { Icon } from "@/components/icons";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";
import type { PlatformId } from "@/lib/website/types";
import { failedMessage } from "@/lib/failure";

// The cards move once a package is chosen, so focus goes to the next heading as soon as it's on the page
function focusWhenShown(id: string, tries = 100) {
  const heading = document.getElementById(id);
  if (heading) {
    heading.focus();
    heading.scrollIntoView({ block: "start" });
  } else if (tries > 0) window.setTimeout(() => focusWhenShown(id, tries - 1), 50);
}

export function ChoosePlatformButton({ platform, name, chosen, primary = true }: {
  platform: PlatformId;
  name: string;
  chosen: boolean;
  primary?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);
  async function choose() {
    setPending(true);
    setError(null);
    try {
      const result = await choosePlatformAction(chosen ? null : platform);
      if (!result.ok) setError(result.message);
      else focusWhenShown(chosen ? "step-choose" : "step-address");
    } catch {
      setError(failedMessage());
    } finally { setPending(false); }
  }
  return <div className="flex flex-col items-start gap-2">
    <button type="button" data-writes disabled={pending} onClick={choose} className={chosen || !primary ? SECONDARY : PRIMARY}>
      <Icon name={chosen ? "back" : "check"} size="sm" />{pending ? "Saving…" : chosen ? "Undo my choice" : `Choose ${name}`}
    </button>
    {error ? <p role="alert" className={ALERT}>{error}</p> : null}
  </div>;
}
