"use client";

import { type FormEvent, useId, useLayoutEffect, useState } from "react";
import { approveVersionAction } from "@/app/(app)/photos/actions";
import { Icon } from "@/components/icons";
import { PickOption } from "@/components/marketing/pieces";
import { ALERT, PRIMARY } from "@/components/styles";
import { failedMessage } from "@/lib/failure";

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
      setError(failedMessage());
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <PickOption
        id={`${uid}-confirm`}
        type="checkbox"
        checked={confirmed}
        onChange={(event) => {
          setConfirmed(event.target.checked);
          setError(null);
        }}
        layout="top"
        label={
          <span className="flex flex-wrap items-center gap-2">
            I compared it with my original photo
          </span>
        }
        description={
          preview
            ? "This preview is your original photo, unchanged. Saving it only shows how the library works."
            : "The product’s shape, size, color, materials, lettering and logos, and how many there are, all match what customers will get. Nothing in the photo looks included that isn’t."
        }
      />
      <button type="submit" disabled={pending} className={`${PRIMARY} self-start`}>
        <Icon name="check" size="sm" />
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
