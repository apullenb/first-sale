"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { describeBrandAction, drawRoundAction, getIdeasAction, saveBriefAction } from "@/app/(app)/brand/actions";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { Done, InfoRows, SectionHead, SOFT } from "@/components/marketing/pieces";
import { useRequestKey, Working } from "@/components/photos/working";
import { AI_BUTTON, ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { Card, Chip } from "@/components/ui";
import { dollars, IDEAS } from "@/lib/brand/cost";
import { PRACTICE_LABEL } from "@/lib/brand/practice";
import { BRIEF_LIMITS, type BrandBrief } from "@/lib/brand/types";
import { MAX_COLOR_FAMILIES, VIBE_LIMITS } from "@/lib/brand/vibes";
import { ColorPicker, LeaningPicker, LogoKindPicker, VibePicker } from "./feel-pickers";

const OFFLINE = "Couldn’t reach First Sale. Check your connection, then try again.";

// What the brand picture is written from; changing any of these makes it out of date
const STORY_INPUTS = ["name", "sells", "customers", "vibes", "leanings", "colors", "likedColors", "symbolIdea"] as const;

interface Props {
  initial: BrandBrief;
  practice: boolean;
  // Why getting ideas is off right now, if it is
  blocked: string | null;
  hasIdeas: boolean;
}

type Phase = "idle" | "describing" | "saving" | "writing" | "drawing";

export function BriefForm({ initial, practice, blocked, hasIdeas }: Props) {
  const uid = useId();
  const requestKey = useRequestKey();
  const [brief, setBrief] = useState<BrandBrief>(initial);
  // Name and products come from earlier answers; the owner opens this only to change them
  const [editingBusiness, setEditingBusiness] = useState(!initial.name.trim() || !initial.sells.trim());
  const [revising, setRevising] = useState(false);
  const [draft, setDraft] = useState(initial.story);
  const [stale, setStale] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useLayoutEffect(
    () => () => {
      setError(null);
      setNote(null);
    },
    [],
  );

  // Takes a value or an update from the latest brief, so quick taps never undo each other
  function set<K extends keyof BrandBrief>(key: K, value: BrandBrief[K] | ((current: BrandBrief[K]) => BrandBrief[K])) {
    const outdates = (STORY_INPUTS as readonly string[]).includes(key) && Boolean(brief.story);
    setBrief((current) => ({
      ...current,
      [key]: typeof value === "function" ? (value as (current: BrandBrief[K]) => BrandBrief[K])(current[key]) : value,
      storyApproved: outdates ? false : current.storyApproved,
    }));
    if (outdates) setStale(true);
    // A different brief is a different request
    requestKey.clear();
    setError(null);
  }

  function detailsProblem(): string | null {
    if (!brief.name.trim()) return "Type your business name exactly as it should appear in your logo.";
    if (!brief.sells.trim()) return "Say what you sell, in a few words.";
    return null;
  }

  async function run(next: Phase, job: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase(next);
    setError(null);
    setNote(null);
    try {
      await job();
    } catch {
      setError(OFFLINE);
    } finally {
      inFlight.current = false;
      setPhase("idle");
    }
  }

  function describe() {
    const details = detailsProblem();
    if (details) {
      setEditingBusiness(true);
      return setError(details);
    }
    if (brief.vibes.length < VIBE_LIMITS.min) return setError(`Pick at least ${VIBE_LIMITS.min} words for how your brand should feel.`);
    return run("describing", async () => {
      const result = await describeBrandAction(brief);
      if (!result.ok) return setError(result.message);
      setBrief((current) => ({ ...current, story: result.value.story, storyByOwner: false, storyApproved: false }));
      setDraft(result.value.story);
      setStale(false);
      setRevising(false);
      window.setTimeout(() => document.getElementById(`${uid}-story`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    });
  }

  function approve(story: string) {
    const text = story.trim();
    if (text.length < 10) return setError("Write a sentence or two about how your business feels.");
    return run("saving", async () => {
      const next = { ...brief, story: text, storyByOwner: brief.storyByOwner || text !== brief.story, storyApproved: true };
      const saved = await saveBriefAction(next);
      if (!saved.ok) return setError(saved.message);
      setBrief(next);
      setDraft(text);
      setStale(false);
      setRevising(false);
      requestKey.clear();
    });
  }

  function tryDifferentWords() {
    setBrief((current) => ({ ...current, story: "", storyByOwner: false, storyApproved: false }));
    setDraft("");
    setStale(false);
    setRevising(false);
    requestKey.clear();
    setError(null);
    setNote("Change your picks, then choose “Describe my brand” again.");
    const heading = document.getElementById(`${uid}-feel`);
    heading?.scrollIntoView({ behavior: "smooth", block: "start" });
    heading?.focus({ preventScroll: true });
  }

  function getIdeas() {
    if (blocked) return;
    return run("writing", async () => {
      const ideas = await getIdeasAction({ requestKey: requestKey.get(), brief });
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
  const textField = (key: "name" | "tagline" | "customers" | "likedColors" | "avoidColors" | "symbolIdea" | "avoid" | "logoLikes", label: string, help: string, max: number) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${uid}-${key}`} className="font-semibold">
        {label}
      </label>
      <input
        id={`${uid}-${key}`}
        type="text"
        value={brief[key]}
        maxLength={max}
        onChange={(event) => set(key, event.target.value)}
        aria-describedby={`${uid}-${key}-help`}
        className={INPUT}
      />
      <p id={`${uid}-${key}-help`} className="text-sm text-muted">
        {help}
      </p>
    </div>
  );
  const messages = (
    <>
      {note ? (
        <p role="status" className="text-[15px] text-rule">
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

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby={`${uid}-business`} className="flex flex-col gap-4">
        <SectionHead
          id={`${uid}-business`}
          number={1}
          title="Your business"
          lead={editingBusiness && !initial.name.trim() ? "We don’t have your business name yet. Add it here, spelled the way it should look in your logo." : "Filled in from what you told us about your business."}
        />
        <Card>
          {editingBusiness ? (
            <div className="flex flex-col gap-5">
              {textField("name", "Name in your logo", "Spelled exactly as it should appear. AI checks the spelling of every logo against it.", BRIEF_LIMITS.name)}
              {textField("tagline", "Tagline (optional)", "A few words under your name, such as “Sourdough and pastries”. Leave it empty if you don’t want one.", BRIEF_LIMITS.tagline)}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${uid}-sells`} className="font-semibold">
                  What you sell
                </label>
                <textarea
                  id={`${uid}-sells`}
                  value={brief.sells}
                  maxLength={BRIEF_LIMITS.sells}
                  rows={2}
                  onChange={(event) => set("sells", event.target.value)}
                  className={`${INPUT} min-h-20`}
                />
              </div>
              {textField("customers", "Who buys it (optional)", "Your usual customers, such as “neighbors and busy parents”.", BRIEF_LIMITS.customers)}
              <button
                type="button"
                onClick={() => {
                  const problem = detailsProblem();
                  if (problem) return setError(problem);
                  setEditingBusiness(false);
                  setError(null);
                }}
                className={`${SECONDARY} w-fit`}
              >
                <Icon name="check" size="sm" />
                Done
              </button>
            </div>
          ) : (
            <>
              <InfoRows
                rows={[
                  { label: "Name in your logo", value: <span className="font-display text-xl font-normal">{brief.name}</span> },
                  {
                    label: "Tagline",
                    value: brief.tagline ? (
                      brief.tagline
                    ) : (
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-normal text-muted">None. Would you like a few words under your name?</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBusiness(true);
                            window.setTimeout(() => document.getElementById(`${uid}-tagline`)?.focus(), 0);
                          }}
                          className="min-h-11 font-semibold text-accent underline decoration-[1.5px] underline-offset-[3px] hover:text-accent-ink"
                        >
                          Add a tagline
                        </button>
                      </span>
                    ),
                  },
                  { label: "What you sell", value: brief.sells },
                  { label: "Who buys it", value: brief.customers || <span className="font-normal text-muted">Not said</span> },
                ]}
              />
              <button type="button" onClick={() => setEditingBusiness(true)} className={`${SECONDARY} w-fit`}>
                <Icon name="pencil" size="sm" />
                Edit
              </button>
            </>
          )}
        </Card>
      </section>

      <section aria-labelledby={`${uid}-feel`} className="flex flex-col gap-4">
        <SectionHead
          id={`${uid}-feel`}
          number={2}
          title="How should your brand feel?"
          lead="Tap the words that fit and answer a few quick questions. We’ll describe your brand back to you before any logo is drawn."
        />
        <Card bodyClassName="gap-8">
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-[20px] leading-snug">Words that fit</h3>
            <VibePicker picked={brief.vibes} onToggle={(vibe) => set("vibes", (vibes) => (vibes.includes(vibe) ? vibes.filter((word) => word !== vibe) : vibes.length < VIBE_LIMITS.max ? [...vibes, vibe] : vibes))} />
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <h3 className="font-display text-[20px] leading-snug">A few quick questions</h3>
            <LeaningPicker value={brief.leanings} onChange={(leanings) => set("leanings", leanings)} />
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <h3 className="font-display text-[20px] leading-snug">What kind of logo?</h3>
            <LogoKindPicker picked={brief.logoKinds} onChange={(kinds) => set("logoKinds", kinds)} />
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <h3 className="font-display text-[20px] leading-snug">Colors you’re drawn to</h3>
            <ColorPicker
              picked={brief.colors}
              onToggle={(family) => set("colors", (colors) => (colors.includes(family) ? colors.filter((name) => name !== family) : colors.length < MAX_COLOR_FAMILIES ? [...colors, family] : colors))}
            />
          </div>
          <details className={`group/more ${SOFT}`}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">
              <Icon name="pencil" className="text-accent" />
              <span className="flex-1">More options: colors to avoid, a symbol, logos you like</span>
              <Icon name="chevron" size="sm" className="text-faint transition-transform group-open/more:rotate-90" />
            </summary>
            <div className="flex flex-col gap-5 px-4 pb-4">
              {textField("likedColors", "Exact colors you already use (optional)", "Such as “the forest green on our sign”.", BRIEF_LIMITS.colors)}
              {textField("avoidColors", "Colors to avoid (optional)", "Such as “no pink” or “nothing neon”.", BRIEF_LIMITS.colors)}
              {textField("symbolIdea", "A symbol you’d like (optional)", "Something you’d like in the logo, such as a wheat stalk or a sunrise. Leave it empty to see fresh ideas.", BRIEF_LIMITS.symbol)}
              {textField("avoid", "Anything to avoid (optional)", "Such as “no cupcakes” or “nothing that looks like a coffee chain”.", BRIEF_LIMITS.avoid)}
              {textField(
                "logoLikes",
                "Logos you like (optional)",
                "What you like about logos you’ve seen, such as “bold, simple letters” or “a friendly hand-drawn feel”. Ideas take the feel from this, never a copy.",
                BRIEF_LIMITS.logoLikes,
              )}
            </div>
          </details>
          <div className="flex flex-col gap-2 border-t border-line pt-5">
            <button type="button" onClick={describe} disabled={busy} className={`${AI_BUTTON} w-fit`}>
              <Icon name="sparkles" size="sm" />
              {phase === "describing" ? "Describing…" : brief.story ? "Describe my brand again" : "Describe my brand"}
            </button>
            <Working label="Describing your brand… this takes a few seconds" active={phase === "describing"} />
            {!brief.story ? messages : null}
          </div>
        </Card>
      </section>

      <section id={`${uid}-story`} aria-labelledby={`${uid}-story-heading`} className="flex scroll-mt-4 flex-col gap-4">
        <SectionHead id={`${uid}-story-heading`} number={3} title="Your brand picture">
          {brief.story ? (
            <p className="flex flex-wrap items-center gap-2 text-[15px] text-muted">
              {brief.storyByOwner ? (
                <>
                  <ActorChip actor="owner" /> In your words. It guides every logo idea and picture.
                </>
              ) : practice ? (
                <Chip tone="warn">{PRACTICE_LABEL}</Chip>
              ) : (
                <>
                  <ActorChip actor="ai" /> Written by AI from the words you picked. It guides every logo idea and picture.
                </>
              )}
            </p>
          ) : null}
        </SectionHead>
        {brief.story ? (
          <Card bodyClassName="gap-4">
            {revising ? (
              <div className="flex flex-col gap-2">
                <label htmlFor={`${uid}-revise`} className="font-semibold">
                  Change it until it sounds like your business
                </label>
                <textarea
                  id={`${uid}-revise`}
                  value={draft}
                  maxLength={BRIEF_LIMITS.story}
                  rows={5}
                  onChange={(event) => setDraft(event.target.value)}
                  className={`${INPUT} min-h-32 text-lg`}
                />
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => approve(draft)} disabled={busy} className={PRIMARY}>
                    {phase === "saving" ? "Saving…" : "Save: this feels like my business"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRevising(false);
                      setDraft(brief.story);
                    }}
                    className={SECONDARY}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <blockquote className="border-l-[3px] border-accent-ring py-1 pl-4 font-display text-[22px] leading-snug sm:text-2xl">{brief.story}</blockquote>
            )}

            {stale && !revising ? <p className={ALERT}>You changed your picks since this was written. Describe your brand again, or keep this if it still fits.</p> : null}

            {revising ? null : brief.storyApproved ? (
              <div className="flex flex-col gap-3">
                <Done>
                  <span className="flex flex-wrap items-center gap-2">
                    <ActorChip actor="owner" /> You said this feels like your business.
                  </span>
                </Done>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setRevising(true)} disabled={busy} className={SECONDARY}>
                    <Icon name="pencil" size="sm" />
                    Revise this description
                  </button>
                  <button type="button" onClick={tryDifferentWords} disabled={busy} className={SECONDARY}>
                    <Icon name="refresh" size="sm" />
                    Try again with different adjectives
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => approve(brief.story)} disabled={busy} className={PRIMARY}>
                  <Icon name="check" size="sm" />
                  {phase === "saving" ? "Saving…" : "This feels like my business"}
                </button>
                <button type="button" onClick={tryDifferentWords} disabled={busy} className={SECONDARY}>
                  Try again with different adjectives
                </button>
                <button type="button" onClick={() => setRevising(true)} disabled={busy} className={SECONDARY}>
                  Revise this description
                </button>
              </div>
            )}

            {brief.storyApproved && !revising ? (
              <div className={`${SOFT} flex flex-col gap-3 px-4 py-4`}>
                <p className="flex items-start gap-2.5 text-[15px] text-rule">
                  <Icon name="dollar" size="sm" className="mt-[3px] text-accent" />
                  <span>
                    {practice
                      ? `Practice mode: no logos are drawn and nothing is charged. You’ll see ${IDEAS.first} labeled placeholders.`
                      : `Muse writes ${IDEAS.first} different logo ideas from your brand picture and draws each one. Meta charges ${dollars(1)} per picture, so the drawings cost ${dollars(IDEAS.first)}, plus a small amount for writing the ideas and checking the spelling.`}
                  </span>
                </p>
                {blocked ? <p className={ALERT}>{blocked}</p> : null}
                <button type="button" onClick={getIdeas} disabled={busy || Boolean(blocked)} className={`${AI_BUTTON} w-fit`}>
                  <Icon name="sparkles" size="sm" />
                  {phase === "writing" ? "Writing ideas…" : phase === "drawing" ? "Drawing logos…" : hasIdeas ? "Get new logo ideas" : "Get logo ideas"}
                </button>
                <Working label="Writing logo ideas… this can take a minute" active={phase === "writing"} />
                <Working label={`Drawing ${IDEAS.first} logos and checking their spelling… this can take two or three minutes`} active={phase === "drawing"} />
              </div>
            ) : null}
            {messages}
          </Card>
        ) : (
          <Card>
            <p className="text-muted">After you pick your words, choose “Describe my brand” and it appears here for you to approve or change.</p>
          </Card>
        )}
      </section>
    </div>
  );
}
