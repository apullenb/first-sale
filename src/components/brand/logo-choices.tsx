"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { drawRoundAction, getIdeasAction, suggestTaglinesAction } from "@/app/(app)/brand/actions";
import { Icon } from "@/components/icons";
import { PickTile, SectionHead, SOFT } from "@/components/marketing/pieces";
import { useRequestKey, Working } from "@/components/working";
import { AI_BUTTON, ALERT, INPUT, SECONDARY } from "@/components/styles";
import { Card, Chip } from "@/components/ui";
import type { LogoChoices as Choices } from "@/lib/brand/brief";
import { dollars, IDEAS } from "@/lib/brand/cost";
import { PRACTICE_LABEL } from "@/lib/brand/practice";
import { BRIEF_LIMITS } from "@/lib/brand/types";
import { LogoKindPicker } from "./feel-pickers";

const OFFLINE = "Couldn’t reach SnapStart. Check your connection, then try again.";

interface Props {
  initial: Choices;
  practice: boolean;
  // Why generating is off right now, such as no approved brand description
  blocked: string | null;
  hasIdeas: boolean;
  number: number;
}

type Phase = "idle" | "suggesting" | "writing" | "drawing";

// The logo-only choices; "Generate logo ideas" sends them with the approved brand description
export function LogoChoices({ initial, practice, blocked, hasIdeas, number }: Props) {
  const uid = useId();
  const requestKey = useRequestKey();
  const [choices, setChoices] = useState<Choices>(initial);
  const [addingTagline, setAddingTagline] = useState(Boolean(initial.tagline));
  const [suggestions, setSuggestions] = useState<{ taglines: string[]; simulated: boolean } | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [taglineError, setTaglineError] = useState<string | null>(null);
  const taglineInput = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  // Where focus goes after the tagline box opens or closes, so it isn't lost
  const focusNext = useRef<"input" | "add" | null>(null);
  useEffect(() => {
    const target = focusNext.current === "input" ? taglineInput.current : focusNext.current === "add" ? addButton.current : null;
    focusNext.current = null;
    target?.focus();
  }, [addingTagline]);
  useLayoutEffect(
    () => () => {
      setError(null);
      setNote(null);
      setTaglineError(null);
    },
    [],
  );

  function set<K extends keyof Choices>(key: K, value: Choices[K]) {
    setChoices((current) => ({ ...current, [key]: value }));
    // Different choices are a different request
    requestKey.clear();
    setError(null);
  }

  async function run(next: Phase, job: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase(next);
    try {
      await job();
    } catch {
      (next === "suggesting" ? setTaglineError : setError)(OFFLINE);
    } finally {
      inFlight.current = false;
      setPhase("idle");
    }
  }

  function suggest() {
    if (inFlight.current) return;
    setTaglineError(null);
    return run("suggesting", async () => {
      const result = await suggestTaglinesAction({ name: choices.name });
      if (!result.ok) return setTaglineError(result.message);
      setSuggestions(result.value);
      setAddingTagline(true);
    });
  }

  function generate() {
    if (blocked) return;
    if (!choices.name.trim()) return setError("Type your business name exactly as it should appear in your logo.");
    setNote(null);
    setError(null);
    return run("writing", async () => {
      const ideas = await getIdeasAction({ requestKey: requestKey.get(), choices });
      if (!ideas.ok) return setError(ideas.message);
      setPhase("drawing");
      const drawn = await drawRoundAction(ideas.value);
      if (!drawn.ok) return setError(`${drawn.message} Your ideas are saved: choose “Draw the missing logos” below to try again.`);
      // Kept until the drawings are back, so a retry reuses the same round and draws only what's missing
      requestKey.clear();
      if (drawn.value) setNote(drawn.value);
      document.getElementById("ideas-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const busy = phase !== "idle";
  return (
    <section aria-labelledby={`${uid}-heading`} className="flex flex-col gap-4">
      <SectionHead id={`${uid}-heading`} number={number} title="What your logo shows" lead="Only about the logo itself. How your brand feels comes from your description above." />
      <Card bodyClassName="gap-7">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-name`} className="font-semibold">
            Name in your logo
          </label>
          <input
            id={`${uid}-name`}
            type="text"
            value={choices.name}
            maxLength={BRIEF_LIMITS.name}
            onChange={(event) => set("name", event.target.value)}
            aria-describedby={`${uid}-name-help`}
            className={`${INPUT} font-display text-xl`}
          />
          <p id={`${uid}-name-help`} className="text-sm text-muted">
            Spelled exactly as it should appear. AI checks the spelling of every logo against it.
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-6">
          {/* One row whose second child is always Suggest, so it keeps focus while the first child changes */}
          <p id={`${uid}-tagline-label`} className="font-semibold">
            Tagline <span className="font-normal text-muted">(optional)</span>
          </p>
          <div className="flex items-stretch gap-2">
            {addingTagline ? (
              <input
                ref={taglineInput}
                id={`${uid}-tagline`}
                type="text"
                value={choices.tagline}
                maxLength={BRIEF_LIMITS.tagline}
                placeholder="Such as “Sourdough and pastries”"
                aria-labelledby={`${uid}-tagline-label`}
                onChange={(event) => set("tagline", event.target.value)}
                className={`${INPUT} min-w-0 flex-1`}
              />
            ) : (
              <button
                ref={addButton}
                type="button"
                onClick={() => {
                  setAddingTagline(true);
                  focusNext.current = "input";
                }}
                className={SECONDARY}
              >
                <Icon name="plus" size="sm" />
                Add a tagline
              </button>
            )}
            {/* aria-disabled, not disabled: a disabled button drops focus */}
            <button type="button" onClick={suggest} aria-disabled={busy} aria-label="Suggest taglines from your brand" className={`${AI_BUTTON} shrink-0 px-3.5 aria-disabled:opacity-60`}>
              <Icon name="sparkles" size="sm" />
              {phase === "suggesting" ? "Suggesting…" : "Suggest"}
            </button>
          </div>
          <p className="text-sm text-muted">A few words under your name, such as “Sourdough and pastries”. Type your own, or choose Suggest for ideas from your brand.</p>
          {addingTagline ? (
            <button
              type="button"
              onClick={() => {
                set("tagline", "");
                setAddingTagline(false);
                focusNext.current = "add";
              }}
              className="min-h-11 w-fit text-[15px] font-semibold text-accent underline decoration-[1.5px] underline-offset-[3px] hover:text-accent-ink"
            >
              No tagline
            </button>
          ) : null}
          <Working label="Suggesting taglines from your brand… this takes a few seconds" active={phase === "suggesting"} />
          {taglineError ? (
            <p role="alert" className={ALERT}>
              {taglineError}
            </p>
          ) : null}
          {suggestions ? (
            <div className={`${SOFT} flex flex-col gap-2.5 p-3.5`}>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                {suggestions.simulated ? <Chip tone="warn">{PRACTICE_LABEL}</Chip> : <span>Suggested by AI from your brand.</span>}
                Pick one, then change any word you like.
              </p>
              <div role="group" aria-label="Suggested taglines" className="grid gap-2 sm:grid-cols-2">
                {suggestions.taglines.map((line) => (
                  <PickTile key={line} pressed={choices.tagline === line} onClick={() => set("tagline", line)} label={line} layout="word" />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-6">
          <h3 className="font-display text-[20px] leading-snug">What kind of logo?</h3>
          <LogoKindPicker picked={choices.logoKinds} onChange={(kinds) => set("logoKinds", kinds)} />
        </div>

        <div className="grid gap-5 border-t border-line pt-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-symbol`} className="font-semibold">
              A symbol idea <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id={`${uid}-symbol`} type="text" value={choices.symbolIdea} maxLength={BRIEF_LIMITS.symbol} onChange={(event) => set("symbolIdea", event.target.value)} className={INPUT} />
            <p className="text-sm text-muted">Something you’d like in the logo, such as a wheat stalk or a sunrise. Leave it empty to see fresh ideas.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-likes`} className="font-semibold">
              Logos you like <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id={`${uid}-likes`} type="text" value={choices.logoLikes} maxLength={BRIEF_LIMITS.logoLikes} onChange={(event) => set("logoLikes", event.target.value)} className={INPUT} />
            <p className="text-sm text-muted">What you like about logos you’ve seen, such as “bold, simple letters”. Ideas take the feel from this, never a copy.</p>
          </div>
        </div>

        <div className={`${SOFT} flex flex-col gap-3 px-4 py-4`}>
          <p className="flex items-start gap-2.5 text-[15px] text-rule">
            <Icon name="dollar" size="sm" className="mt-[3px] text-accent" />
            <span>
              {practice
                ? `Practice mode: no logos are drawn and nothing is charged. You’ll see ${IDEAS.first} labeled samples.`
                : `Muse writes ${IDEAS.first} different logo ideas from your brand description and these choices, and draws each one. Meta charges ${dollars(1)} per picture, so the drawings cost ${dollars(IDEAS.first)}, plus a small amount for writing the ideas and checking the spelling.`}
            </span>
          </p>
          {blocked ? <p className={ALERT}>{blocked}</p> : null}
          <button type="button" onClick={generate} disabled={busy || Boolean(blocked)} className={`${AI_BUTTON} w-fit`}>
            <Icon name="sparkles" size="sm" />
            {phase === "writing" ? "Writing ideas…" : phase === "drawing" ? "Drawing logos…" : hasIdeas ? "Generate new logo ideas" : "Generate logo ideas"}
          </button>
          <Working label="Writing logo ideas… this can take a minute" active={phase === "writing"} />
          <Working label={`Drawing ${IDEAS.first} logos and checking their spelling… this can take two or three minutes`} active={phase === "drawing"} />
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
        </div>
      </Card>
    </section>
  );
}
