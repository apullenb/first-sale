"use client";

import { type FormEvent, useId, useLayoutEffect, useRef, useState } from "react";
import type { ActionResult } from "@/app/(app)/business/actions";
import { approveVersionsAction, drawRoundAction, makeImagesAction, makeVersionsAction, moreLikeThisAction, refineLogoAction } from "@/app/(app)/brand/actions";
import { useRequestKey, Working } from "@/components/photos/working";
import { AI_BUTTON, ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { MAX_CHANGE } from "@/lib/brand/prompts";
import type { BrandImageKind, VersionKind } from "@/lib/brand/types";

const OFFLINE = "Couldn’t reach First Sale. Check your connection, then try again.";

// Errors and notes clear when the page is hidden: kept-mounted screens keep their state
function useMessages() {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useLayoutEffect(
    () => () => {
      setError(null);
      setNote(null);
    },
    [],
  );
  return { error, setError, note, setNote };
}

function Messages({ error, note }: { error: string | null; note: string | null }) {
  return (
    <>
      {note ? (
        <p role="status" className={ALERT}>
          {note}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </>
  );
}

export type Intent =
  | { kind: "more"; conceptId: string }
  | { kind: "draw"; roundId: string }
  | { kind: "versions"; kinds: VersionKind[] }
  | { kind: "images"; kinds: BrandImageKind[] };

interface RunProps {
  intent: Intent;
  label: string;
  pendingLabel: string;
  working: string;
  variant?: "ai" | "secondary";
  // Owner-facing cost, shown next to the button
  cost?: string;
  // Lets the owner say what to change, for "make a new one"
  withChange?: boolean;
  blocked?: string | null;
}

// Runs one paid job. One key per intended request, kept across retries, so a retry never pays twice.
export function BrandRunButton({ intent, label, pendingLabel, working, variant = "ai", cost, withChange, blocked }: RunProps) {
  const uid = useId();
  const requestKey = useRequestKey();
  const [pending, setPending] = useState<"first" | "drawing" | null>(null);
  const [change, setChange] = useState("");
  const inFlight = useRef(false);
  const { error, setError, note, setNote } = useMessages();

  async function run() {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    setPending("first");
    setError(null);
    setNote(null);
    try {
      let result: ActionResult<string | null>;
      if (intent.kind === "more") {
        const round = await moreLikeThisAction({ conceptId: intent.conceptId, requestKey: requestKey.get() });
        if (!round.ok) return setError(round.message);
        setPending("drawing");
        result = await drawRoundAction(round.value);
      } else if (intent.kind === "draw") {
        result = await drawRoundAction(intent.roundId);
      } else if (intent.kind === "versions") {
        result = await makeVersionsAction({ requestKey: requestKey.get(), kinds: intent.kinds });
      } else {
        result = await makeImagesAction({ requestKey: requestKey.get(), kinds: intent.kinds, change: change.trim() || null });
      }
      if (!result.ok) return setError(result.message);
      requestKey.clear();
      setChange("");
      if (result.value) setNote(result.value);
    } catch {
      setError(OFFLINE);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {withChange ? (
        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor={`${uid}-change`} className="text-sm font-semibold">
            Anything to change? (optional)
          </label>
          <input
            id={`${uid}-change`}
            type="text"
            value={change}
            maxLength={MAX_CHANGE}
            placeholder="Such as “more space in the middle”"
            onChange={(event) => {
              setChange(event.target.value);
              requestKey.clear();
            }}
            className={INPUT}
          />
        </div>
      ) : null}
      <button type="button" onClick={run} disabled={pending !== null || Boolean(blocked)} className={variant === "ai" ? AI_BUTTON : SECONDARY}>
        {pending ? pendingLabel : label}
      </button>
      {cost ? <p className="text-sm text-muted">{cost}</p> : null}
      {blocked ? <p className="text-sm text-muted">{blocked}</p> : null}
      <Working label={pending === "drawing" ? "Drawing the new ideas and checking their spelling… this can take two or three minutes" : working} active={pending !== null} />
      <Messages error={error} note={note} />
    </div>
  );
}

// A change to one logo draft in the owner's words
export function RefineLogo({ assetId, cost }: { assetId: string; cost: string }) {
  const uid = useId();
  const requestKey = useRequestKey();
  const [change, setChange] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const { error, setError, note, setNote } = useMessages();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    if (change.trim().length < 3) return setError("Say what you’d like changed, such as “Make the letters thicker”.");
    inFlight.current = true;
    setPending(true);
    setError(null);
    setNote(null);
    try {
      const result = await refineLogoAction({ assetId, requestKey: requestKey.get(), change });
      if (!result.ok) return setError(result.message);
      requestKey.clear();
      setChange("");
      setNote("Done. The changed logo is shown under this idea.");
    } catch {
      setError(OFFLINE);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={`${uid}-change`} className="font-semibold">
        Change this logo
      </label>
      <textarea
        id={`${uid}-change`}
        value={change}
        rows={2}
        maxLength={MAX_CHANGE}
        placeholder="Such as “Make the wheat stalk simpler” or “Use the green for the letters”"
        onChange={(event) => {
          setChange(event.target.value);
          requestKey.clear();
          setError(null);
        }}
        className={`${INPUT} min-h-20`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={SECONDARY}>
          {pending ? "Changing…" : "Make this change"}
        </button>
        <span className="text-sm text-muted">{cost}</span>
      </div>
      <Working label="Redrawing your logo and checking the spelling… this can take a minute or two" active={pending} />
      <Messages error={error} note={note} />
    </form>
  );
}

export function ApproveVersions({ ids }: { ids: Record<VersionKind, string> }) {
  const uid = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const { error, setError, note } = useMessages();

  async function approve() {
    if (!confirmed) return setError("First confirm that you checked the spelling and that each version matches your logo.");
    setPending(true);
    setError(null);
    try {
      const result = await approveVersionsAction({ ...ids, confirmed: true });
      if (!result.ok) setError(result.message);
    } catch {
      setError(OFFLINE);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-accent-tint px-4 py-3">
      <label htmlFor={`${uid}-confirm`} className="flex min-h-11 cursor-pointer items-start gap-2.5">
        <input id={`${uid}-confirm`} type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-4 shrink-0 accent-accent" />
        <span>I checked the spelling myself, and each version matches my logo.</span>
      </label>
      <button type="button" onClick={approve} disabled={pending} className={`${PRIMARY} w-fit`}>
        {pending ? "Approving…" : "Approve these versions"}
      </button>
      <Messages error={error} note={note} />
    </div>
  );
}
