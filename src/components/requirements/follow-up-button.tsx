"use client";

import { followUpAction } from "@/app/(app)/requirements/actions";
import { ActionButton } from "@/components/action-button";

// For a check that finished without its deeper look, such as one saved before it existed
export function FollowUpButton({ count }: { count: number }) {
  return (
    <ActionButton
      action={followUpAction}
      label={`Look deeper into ${count === 1 ? "it" : `these ${count}`}`}
      pendingLabel="Looking deeper…"
      pendingStatus="Searching each office’s own site, and finding who to write to about the rest. This can take a minute or two."
      variant="ai"
    />
  );
}
