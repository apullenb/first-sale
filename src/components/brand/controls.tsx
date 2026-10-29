"use client";

import { type FormEvent, useId, useLayoutEffect, useRef, useState } from "react";
import type { ActionResult } from "@/app/(app)/business/actions";
import { approveVersionsAction, drawRoundAction, makeImagesAction, makeVersionsAction, moreLikeThisAction, refineLogoAction } from "@/app/(app)/brand/actions";
import { useRequestKey, Working } from "@/components/photos/working";
import { AI_BUTTON, ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { contrast } from "@/lib/brand/colors";
import { MAX_CHANGE } from "@/lib/brand/prompts";
import { familyPalette, LETTERING_STYLE_KEYS, LETTERING_STYLES, type LetteringStyle, type Refinement } from "@/lib/brand/refine";
import { BRIEF_LIMITS, type BrandImageKind, type PaletteColor, type VersionKind } from "@/lib/brand/types";
import { COLOR_FAMILIES, type ColorFamily } from "@/lib/brand/vibes";

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

const CHOICE =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-field bg-surface px-3 py-2 text-[15px] font-semibold has-checked:border-accent has-checked:bg-accent-tint has-checked:text-accent-ink has-focus-visible:ring-2 has-focus-visible:ring-accent";

function Swatches({ hexes }: { hexes: string[] }) {
  return (
    <span aria-hidden="true" className="flex shrink-0">
      {hexes.map((hex, index) => (
        <span key={`${hex}-${index}`} className="-mr-1.5 size-5 rounded-full ring-2 ring-surface" style={{ backgroundColor: hex }} />
      ))}
    </span>
  );
}

interface RefineProps {
  assetId: string;
  cost: string;
  // The logo as drawn, with earlier changes applied
  current: { palette: PaletteColor[]; typography: string; tagline: string };
  // Offered when this logo has no tagline
  ownerTagline: string;
  // The owner's color picks, listed first
  pickedFamilies: ColorFamily[];
}

// One-click changes, written by code, and a change in the owner's own words. Each makes one new picture and keeps this one.
export function RefineLogo({ assetId, cost, current, ownerTagline, pickedFamilies }: RefineProps) {
  const uid = useId();
  const requestKey = useRequestKey();
  // A different change is a different request, so it gets a new key
  const lastIntent = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [change, setChange] = useState("");
  const [family, setFamily] = useState<ColorFamily | "custom" | null>(null);
  const [hexes, setHexes] = useState(() => current.palette.map((color) => color.hex.toUpperCase()));
  const [style, setStyle] = useState<LetteringStyle | null>(null);
  const [tagline, setTagline] = useState(current.tagline || ownerTagline);
  const { error, setError, note, setNote } = useMessages();
  const families = [...pickedFamilies, ...(Object.keys(COLOR_FAMILIES) as ColorFamily[]).filter((name) => !pickedFamilies.includes(name))];
  const lightCustom = family === "custom" && Math.max(...hexes.map((hex) => contrast(hex, "#ffffff"))) < 3;

  async function send(intent: { change: string } | { refinement: Refinement }) {
    if (inFlight.current) return;
    const signature = JSON.stringify(intent);
    if (signature !== lastIntent.current) {
      requestKey.clear();
      lastIntent.current = signature;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    setNote(null);
    try {
      const result = await refineLogoAction({ assetId, requestKey: requestKey.get(), ...intent });
      if (!result.ok) return setError(result.message);
      requestKey.clear();
      lastIntent.current = null;
      if ("change" in intent) setChange("");
      setNote("Done. The new logo is shown under this idea, and this one is kept.");
    } catch {
      setError(OFFLINE);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (change.trim().length < 3) return setError("Say what you’d like changed, such as “Make the letters thicker”.");
    return send({ change });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">Each change makes one new picture from this logo. {cost}</p>

      <div className="flex flex-col gap-2">
        <h4 className="font-semibold">Simpler</h4>
        <p className="text-sm text-muted">Fewer details and thicker lines, so it still reads when it’s small.</p>
        <button type="button" onClick={() => send({ refinement: { kind: "simpler" } })} disabled={pending} className={`${SECONDARY} w-fit`}>
          Make it simpler
        </button>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Different colors</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {families.map((name) => (
            <label key={name} className={CHOICE}>
              <input type="radio" name={`${uid}-colors`} checked={family === name} onChange={() => setFamily(name)} className="sr-only" />
              <Swatches hexes={familyPalette(name, current.palette.length).map((color) => color.hex)} />
              <span className="pl-1.5">
                {name}
                {pickedFamilies.includes(name) ? <span className="ml-1.5 text-sm font-normal text-muted">(you picked)</span> : null}
              </span>
            </label>
          ))}
          <label className={CHOICE}>
            <input type="radio" name={`${uid}-colors`} checked={family === "custom"} onChange={() => setFamily("custom")} className="sr-only" />
            <Swatches hexes={hexes} />
            <span className="pl-1.5">Pick exact colors</span>
          </label>
        </div>
        {family === "custom" ? (
          <div className="flex flex-wrap items-end gap-3">
            {hexes.map((hex, index) => (
              <label key={index} className="flex flex-col gap-1 text-sm font-semibold">
                Color {index + 1}
                <input
                  type="color"
                  value={hex.toLowerCase()}
                  onChange={(event) => setHexes((list) => list.map((each, at) => (at === index ? event.target.value.toUpperCase() : each)))}
                  className="h-11 w-16 cursor-pointer rounded-lg border border-field bg-surface"
                />
              </label>
            ))}
            {hexes.length < 3 ? (
              <button type="button" onClick={() => setHexes((list) => [...list, "#888888"])} className={SECONDARY}>
                Add a color
              </button>
            ) : null}
            {hexes.length > 1 ? (
              <button type="button" onClick={() => setHexes((list) => list.slice(0, -1))} className={SECONDARY}>
                Remove the last color
              </button>
            ) : null}
          </div>
        ) : null}
        {lightCustom ? <p className="text-sm text-check">These colors are all light, so your name may be hard to read on white.</p> : null}
        <button
          type="button"
          onClick={() => family && send({ refinement: { kind: "colors", colors: family === "custom" ? { hexes } : { family } } })}
          disabled={pending || !family}
          className={`${SECONDARY} w-fit`}
        >
          Use these colors
        </button>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Different lettering</legend>
        <p className="text-sm text-muted">Now: {current.typography}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LETTERING_STYLE_KEYS.map((key) => (
            <label key={key} className={`${CHOICE} justify-center text-center`}>
              <input type="radio" name={`${uid}-lettering`} checked={style === key} onChange={() => setStyle(key)} className="sr-only" />
              {LETTERING_STYLES[key].label}
            </label>
          ))}
        </div>
        <button type="button" onClick={() => style && send({ refinement: { kind: "lettering", style } })} disabled={pending || !style} className={`${SECONDARY} w-fit`}>
          Change the lettering
        </button>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${uid}-tagline`} className="font-semibold">
          Tagline
        </label>
        <p className="text-sm text-muted">{current.tagline ? `This logo’s tagline: “${current.tagline}”.` : "This logo has no tagline."}</p>
        <input id={`${uid}-tagline`} type="text" value={tagline} maxLength={BRIEF_LIMITS.tagline} onChange={(event) => setTagline(event.target.value)} className={INPUT} />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => send({ refinement: { kind: "tagline", text: tagline } })}
            disabled={pending || !tagline.trim() || tagline.trim() === current.tagline}
            className={SECONDARY}
          >
            {current.tagline ? "Use this tagline instead" : "Add this tagline"}
          </button>
          {current.tagline ? (
            <button type="button" onClick={() => send({ refinement: { kind: "tagline", text: "" } })} disabled={pending} className={SECONDARY}>
              Remove the tagline
            </button>
          ) : null}
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor={`${uid}-change`} className="font-semibold">
          Something else
        </label>
        <textarea
          id={`${uid}-change`}
          value={change}
          rows={2}
          maxLength={MAX_CHANGE}
          placeholder="Such as “Make the wheat stalk smaller” or “More space between the letters”"
          onChange={(event) => {
            setChange(event.target.value);
            setError(null);
          }}
          className={`${INPUT} min-h-20`}
        />
        <button type="submit" disabled={pending} className={`${SECONDARY} w-fit`}>
          {pending ? "Changing…" : "Make this change"}
        </button>
      </form>
      <Working label="Redrawing your logo and checking the spelling… this can take a minute or two" active={pending} />
      <Messages error={error} note={note} />
    </div>
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
