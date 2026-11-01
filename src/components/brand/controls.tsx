"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ActionResult } from "@/app/(app)/business/actions";
import { drawRoundAction, editPictureAction, makeImagesAction, makeVersionsAction, moreLikeThisAction, refineLogoAction } from "@/app/(app)/brand/actions";
import { Icon } from "@/components/icons";
import { LABEL, PickOption } from "@/components/marketing/pieces";
import { useRequestKey, Working } from "@/components/working";
import { AI_BUTTON, ALERT, INPUT, SECONDARY } from "@/components/styles";
import { contrast } from "@/lib/brand/colors";
import { MAX_CHANGE } from "@/lib/brand/prompts";
import { familyPalette, LETTERING_STYLE_KEYS, LETTERING_STYLES, type LetteringStyle, type Refinement } from "@/lib/brand/refine";
import { BRIEF_LIMITS, type BrandImageKind, type PaletteColor, type VersionKind } from "@/lib/brand/types";
import { COLOR_FAMILIES, type ColorFamily } from "@/lib/brand/vibes";

const OFFLINE = "Couldn’t reach SnapStart. Check your connection, then try again.";

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
  // logoId: the chosen logo the page showed, so a stale page can't make files from another logo
  // redraw: have the image model draw it instead of building it from the logo
  | { kind: "versions"; logoId: string; kinds: VersionKind[]; redraw?: boolean }
  | { kind: "images"; logoId: string; kinds: BrandImageKind[] };

// Runs one paid job. One key per intended request, kept across retries, so a retry never pays twice.
function useBrandRun(intent: Intent, blocked?: string | null) {
  const requestKey = useRequestKey();
  const [pending, setPending] = useState<"first" | "drawing" | null>(null);
  const inFlight = useRef(false);
  const messages = useMessages();
  const { setError, setNote } = messages;

  async function run(change?: string) {
    if (inFlight.current || blocked) return false;
    inFlight.current = true;
    setPending("first");
    setError(null);
    setNote(null);
    try {
      let result: ActionResult<string | null>;
      if (intent.kind === "more") {
        const round = await moreLikeThisAction({ conceptId: intent.conceptId, requestKey: requestKey.get() });
        if (!round.ok) {
          setError(round.message);
          return false;
        }
        setPending("drawing");
        result = await drawRoundAction(round.value);
      } else if (intent.kind === "draw") {
        result = await drawRoundAction(intent.roundId);
      } else if (intent.kind === "versions") {
        result = await makeVersionsAction({ requestKey: requestKey.get(), logoId: intent.logoId, kinds: intent.kinds, redraw: intent.redraw });
      } else {
        result = await makeImagesAction({ requestKey: requestKey.get(), logoId: intent.logoId, kinds: intent.kinds, change: change?.trim() || null });
      }
      if (!result.ok) {
        setError(result.message);
        return false;
      }
      requestKey.clear();
      if (result.value) setNote(result.value);
      return true;
    } catch {
      setError(OFFLINE);
      return false;
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return { run, pending, requestKey, ...messages };
}

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

export function BrandRunButton({ intent, label, pendingLabel, working, variant = "ai", cost, withChange, blocked }: RunProps) {
  const uid = useId();
  const [change, setChange] = useState("");
  const { run, pending, requestKey, error, note } = useBrandRun(intent, blocked);

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
      <button type="button" onClick={async () => (await run(change)) && setChange("")} disabled={pending !== null || Boolean(blocked)} className={variant === "ai" ? AI_BUTTON : SECONDARY}>
        <Icon name={variant === "ai" ? "sparkles" : "refresh"} size="sm" />
        {pending ? pendingLabel : label}
      </button>
      {cost ? <p className="text-sm text-muted">{cost}</p> : null}
      {blocked ? <p className="text-sm text-muted">{blocked}</p> : null}
      <Working label={pending === "drawing" ? "Drawing the new ideas and checking their spelling… this can take two or three minutes" : working} active={pending !== null} />
      <Messages error={error} note={note} />
    </div>
  );
}

interface PlusProps {
  intent: Extract<Intent, { kind: "versions" | "images" }>;
  // "Make the stacked version"
  label: string;
  // A gray outline of what goes here
  sketch: ReactNode;
  // CSS aspect ratio of the placeholder, such as "1 / 1"
  ratio: string;
  working: string;
  cost: string;
  blocked?: string | null;
}

// An empty slot: a soft gray placeholder with a "+" that makes this one file
export function PlusTile({ intent, label, sketch, ratio, working, cost, blocked }: PlusProps) {
  const { run, pending, error, note } = useBrandRun(intent, blocked);
  const busy = pending !== null;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => run()}
        disabled={busy || Boolean(blocked)}
        aria-label={busy ? `${label}: working` : label}
        className="group/plus relative grid w-full place-items-center overflow-hidden rounded-xl border-2 border-dashed border-line-strong bg-wash text-faint transition hover:border-accent hover:bg-accent-tint/40 disabled:cursor-not-allowed disabled:hover:border-line-strong disabled:hover:bg-wash"
        style={{ aspectRatio: ratio }}
      >
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center p-[12%] opacity-60">
          {sketch}
        </span>
        <span
          aria-hidden="true"
          className={`relative grid size-14 place-items-center rounded-full border border-line bg-surface shadow-card transition ${busy ? "" : "text-accent group-hover/plus:scale-105"}`}
        >
          {busy ? <span className="size-6 rounded-full border-2 border-accent-tint border-t-accent motion-safe:animate-spin" /> : <Icon name="plus" size="lg" strokeWidth={2.4} />}
        </span>
      </button>
      <p className="text-sm text-muted">{blocked ?? cost}</p>
      <Working label={working} active={busy} />
      <Messages error={error} note={note} />
    </div>
  );
}

interface EditProps {
  // A logo is changed with refineLogoAction; a version or brand image with editPictureAction
  target: { kind: "logo" | "picture"; assetId: string };
  label?: string;
  cost: string;
  working: string;
  // Said once the new file is made
  done: string;
  // The newest file in this slot: the note shows only while it's the one this edit made, so a Regenerate clears it
  latestId?: string;
}

// "Edit": asks what to change, then makes a new file from the owner's words and keeps this one
export function EditPrompt({ target, label = "Edit", cost, working, done, latestId }: EditProps) {
  const uid = useId();
  const requestKey = useRequestKey();
  const [open, setOpen] = useState(false);
  const [change, setChange] = useState("");
  const [pending, setPending] = useState(false);
  const [made, setMade] = useState<string | null>(null);
  const inFlight = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  // Focus goes back to the Edit button when the form closes, not to the page
  const refocus = useRef(false);
  const { error, setError } = useMessages();
  useLayoutEffect(() => () => setMade(null), []);
  useEffect(() => {
    if (open || !refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  }, [open]);

  function close() {
    refocus.current = true;
    setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    if (change.trim().length < 3) return setError("Say what you’d like changed, such as “Make the letters thicker”.");
    inFlight.current = true;
    setPending(true);
    setError(null);
    setMade(null);
    try {
      const input = { assetId: target.assetId, requestKey: requestKey.get(), change };
      const result = target.kind === "logo" ? await refineLogoAction(input) : await editPictureAction(input);
      if (!result.ok) return setError(result.message);
      requestKey.clear();
      setChange("");
      setMade(result.value);
      close();
    } catch {
      setError(OFFLINE);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const showMade = made !== null && (latestId === undefined || latestId === made);
  return (
    <div className={`flex flex-col items-start gap-2 ${open || showMade || error ? "w-full basis-full" : ""}`}>
      {open ? (
        <form onSubmit={submit} className="flex w-full flex-col gap-2 rounded-xl border border-line bg-soft p-3.5">
          <label htmlFor={`${uid}-change`} className="font-semibold">
            What would you like to change?
          </label>
          <textarea
            id={`${uid}-change`}
            value={change}
            rows={2}
            maxLength={MAX_CHANGE}
            autoFocus
            placeholder="Such as “Make the letters thicker” or “Use a warmer green”"
            onChange={(event) => {
              setChange(event.target.value);
              requestKey.clear();
              setError(null);
            }}
            className={`${INPUT} min-h-20`}
          />
          <p className="text-sm text-muted">A new picture is made from your words. This one is kept, so you can pick either. {cost}</p>
          <div className="flex flex-wrap gap-2">
            {/* aria-disabled, not disabled: a disabled button drops focus */}
            <button type="submit" aria-disabled={pending} className={`${AI_BUTTON} aria-disabled:opacity-60`}>
              <Icon name="sparkles" size="sm" />
              {pending ? "Making the change…" : "Make this change"}
            </button>
            <button type="button" onClick={() => !inFlight.current && close()} aria-disabled={pending} className={`${SECONDARY} aria-disabled:opacity-60`}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          ref={button}
          type="button"
          onClick={() => {
            setOpen(true);
            setMade(null);
          }}
          className={SECONDARY}
        >
          <Icon name="pencil" size="sm" />
          {label}
        </button>
      )}
      <Working label={working} active={pending} />
      {showMade ? (
        <p role="status" className="flex items-start gap-2 text-[15px] font-semibold text-done">
          <Icon name="check" size="sm" strokeWidth={2.4} className="mt-0.5" />
          {done}
        </p>
      ) : null}
      <Messages error={error} note={null} />
    </div>
  );
}

const CHOICES = "grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2";
const PART = "flex flex-col gap-2 border-t border-line pt-5";
// Fieldsets draw their legend on the top border, so the rule goes on a wrapper
const RULED = "border-t border-line pt-5";

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

// One-click changes, written by code. Each makes one new picture and keeps this one.
export function RefineLogo({ assetId, cost, current, ownerTagline, pickedFamilies }: RefineProps) {
  const uid = useId();
  const requestKey = useRequestKey();
  // A different change is a different request, so it gets a new key
  const lastIntent = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [family, setFamily] = useState<ColorFamily | "custom" | null>(null);
  const [hexes, setHexes] = useState(() => current.palette.map((color) => color.hex.toUpperCase()));
  const [style, setStyle] = useState<LetteringStyle | null>(null);
  const [tagline, setTagline] = useState(current.tagline || ownerTagline);
  const { error, setError, note, setNote } = useMessages();
  const families = [...pickedFamilies, ...(Object.keys(COLOR_FAMILIES) as ColorFamily[]).filter((name) => !pickedFamilies.includes(name))];
  const lightCustom = family === "custom" && Math.max(...hexes.map((hex) => contrast(hex, "#ffffff"))) < 3;

  async function send(intent: { refinement: Refinement }) {
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
      setNote("Done. The new logo is shown under this idea, and this one is kept.");
    } catch {
      setError(OFFLINE);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">Each change makes one new picture from this logo. {cost}</p>

      <div className="flex flex-col gap-2">
        <h4 className={LABEL}>Simpler</h4>
        <p className="text-sm text-muted">Fewer details and thicker lines, so it still reads when it’s small.</p>
        <button type="button" onClick={() => send({ refinement: { kind: "simpler" } })} disabled={pending} className={`${SECONDARY} w-fit`}>
          Make it simpler
        </button>
      </div>

      <div className={RULED}>
        <fieldset className="flex flex-col gap-2">
          <legend className={`${LABEL} mb-2`}>Different colors</legend>
          <div className={CHOICES}>
            {families.map((name) => (
              <PickOption
                key={name}
                type="radio"
                name={`${uid}-colors`}
                checked={family === name}
                onChange={() => setFamily(name)}
                lead={<Swatches hexes={familyPalette(name, current.palette.length).map((color) => color.hex)} />}
                label={
                  <>
                    {name}
                    {pickedFamilies.includes(name) ? <span className="ml-1.5 text-sm font-normal text-muted">(you picked)</span> : null}
                  </>
                }
                layout="word"
              />
            ))}
            <PickOption type="radio" name={`${uid}-colors`} checked={family === "custom"} onChange={() => setFamily("custom")} lead={<Swatches hexes={hexes} />} label="Pick exact colors" layout="word" />
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
                    className="h-11 w-16 cursor-pointer rounded-[10px] border border-line-strong bg-surface"
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
      </div>

      <div className={RULED}>
        <fieldset className="flex flex-col gap-2">
          <legend className={`${LABEL} mb-1`}>Different lettering</legend>
          <p className="text-sm text-muted">Now: {current.typography}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
            {LETTERING_STYLE_KEYS.map((key) => (
              <PickOption key={key} type="radio" name={`${uid}-lettering`} checked={style === key} onChange={() => setStyle(key)} label={LETTERING_STYLES[key].label} layout="word" />
            ))}
          </div>
          <button type="button" onClick={() => style && send({ refinement: { kind: "lettering", style } })} disabled={pending || !style} className={`${SECONDARY} w-fit`}>
            Change the lettering
          </button>
        </fieldset>
      </div>

      <div className={PART}>
        <label htmlFor={`${uid}-tagline`} className={LABEL}>
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

      <Working label="Redrawing your logo and checking the spelling… this can take a minute or two" active={pending} />
      <Messages error={error} note={note} />
    </div>
  );
}
