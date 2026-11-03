"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useLayoutEffect, useRef, useState } from "react";
import { refinePhotoAction } from "@/app/(app)/photos/actions";
import { Icon } from "@/components/icons";
import { RUNNING_ELSEWHERE, useJobWatch } from "@/components/job-watch";
import { AI_BUTTON, ALERT, INPUT, SECONDARY } from "@/components/styles";
import { MAX_CHANGE } from "@/lib/photos/instructions";
import { useRequestKey, Working } from "@/components/working";
import { failedMessage } from "@/lib/failure";

const EXAMPLES = ["Make the background ivory", "Remove the props", "Make it a little brighter", "Show more space around it"];

// A change in the owner's own words; the original photo still goes with it as the product reference
export function RefineForm({ photoId, versionId, versionNumber }: { photoId: string; versionId: string; versionNumber: number }) {
  const uid = useId();
  const router = useRouter();
  const requestKey = useRequestKey();
  const [change, setChange] = useState("");
  const [pending, setPending] = useState(false);
  // Set before the first await, so a second submit in the same moment can't slip through
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const job = useJobWatch();
  useLayoutEffect(() => () => setError(null), []);

  function edit(value: string) {
    setChange(value);
    requestKey.clear();
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (job.watching || inFlight.current) return;
    if (change.trim().length < 3) return setError("Say what you’d like changed.");
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await refinePhotoAction({ photoId, versionId, requestKey: requestKey.get(), change });
      if (!result.ok && result.busy) return job.watch([result.busy]);
      if (!result.ok) return setError(result.message);
      requestKey.clear();
      setChange("");
      router.push(`/photos/${photoId}?v=${result.value}`);
    } catch {
      setError(failedMessage());
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-change`} className="font-bold">
          Ask for a change to version {versionNumber}
        </label>
        <textarea
          id={`${uid}-change`}
          rows={2}
          maxLength={MAX_CHANGE}
          value={change}
          onChange={(event) => edit(event.target.value)}
          className={INPUT}
          aria-describedby={`${uid}-change-help`}
        />
        <p id={`${uid}-change-help`} className="text-sm text-muted">
          Change the background, light, props or framing. The product itself always stays as it is in your original photo.
        </p>
      </div>
      <div role="group" aria-label="Examples" className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" onClick={() => edit(example)} className={`${SECONDARY} font-normal`}>
            {example}
          </button>
        ))}
      </div>
      <button type="submit" disabled={pending || job.watching} className={`${AI_BUTTON} self-start`}>
        <Icon name="sparkles" size="sm" />
        {pending ? "Making the change…" : "Make this change"}
      </button>
      <Working active={pending || job.watching} label={job.watching ? RUNNING_ELSEWHERE : "Making the change from your original photo, then checking it. This can take a minute or two."} />
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
