"use client";

import { type FormEvent, useId, useLayoutEffect, useState } from "react";
import { approveVersionAction } from "@/app/(app)/photos/actions";
import { ActorChip } from "@/components/actor-chip";
import { ALERT, PRIMARY } from "@/components/styles";

// The owner's review: they confirm it shows the product as it really is before it can be used
export function ApprovePanel({ photoId, versionId, preview }: { photoId: string; versionId: string; preview: boolean }) {
  const uid = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!confirmed) return setError("Tick the box once you’ve compared the photos.");
    setPending(true);
    setError(null);
    try {
      const result = await approveVersionAction({ photoId, versionId, confirmed: true });
      if (!result.ok) setError(result.message);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection, then try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor={`${uid}-confirm`} className="flex cursor-pointer items-start gap-3 rounded-lg border border-field bg-surface px-3.5 py-3 has-checked:border-accent has-checked:bg-accent-tint">
        <input
          id={`${uid}-confirm`}
          type="checkbox"
          checked={confirmed}
          onChange={(event) => {
            setConfirmed(event.target.checked);
            setError(null);
          }}
          className="mt-1 size-5 shrink-0 accent-accent"
        />
        <span className="flex flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            <ActorChip actor="owner" /> I compared it with my original photo
          </span>
          <span className="text-sm text-rule">
            {preview
              ? "This preview is your original photo, unchanged. Saving it only shows how the library works."
              : "The product’s shape, size, color, materials, lettering and logos, and how many there are, all match what customers will get. Nothing in the photo looks included that isn’t."}
          </span>
        </span>
      </label>
      <button type="submit" disabled={pending} className={`${PRIMARY} self-start`}>
        {pending ? "Saving…" : "Approve and save to my product library"}
      </button>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
