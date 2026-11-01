"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { describeBrandAction, saveBrandAction } from "@/app/(app)/brand/actions";
import { Icon } from "@/components/icons";
import { RUNNING_ELSEWHERE, useJobWatch } from "@/components/job-watch";
import { Done, InfoRows, SectionHead } from "@/components/marketing/pieces";
import { Working } from "@/components/working";
import { AI_BUTTON, ALERT, INPUT, PRIMARY, PRIMARY_LINK, SECONDARY } from "@/components/styles";
import { Card, Chip } from "@/components/ui";
import { PRACTICE_LABEL } from "@/lib/brand/practice";
import { BRIEF_LIMITS, type BrandBrief } from "@/lib/brand/types";
import { MAX_COLOR_FAMILIES, VIBE_LIMITS } from "@/lib/brand/vibes";
import { ColorPicker, LeaningPicker, VibePicker } from "./feel-pickers";

const OFFLINE = "Couldn’t reach SnapStart. Check your connection, then try again.";

// What the description is written from; changing any of these makes it out of date
const STORY_INPUTS = ["sells", "customers", "vibes", "leanings", "colors", "likedColors"] as const;

type Phase = "idle" | "describing" | "saving";

// Build your brand: what you sell, how it should feel, and the description the owner approves
export function BrandForm({ initial, practice }: { initial: BrandBrief; practice: boolean }) {
  const uid = useId();
  const [brief, setBrief] = useState<BrandBrief>(initial);
  // Filled in from earlier answers; the owner opens this only to change them
  const [editingBusiness, setEditingBusiness] = useState(!initial.name.trim() || !initial.sells.trim());
  const [revising, setRevising] = useState(false);
  const [draft, setDraft] = useState(initial.story);
  const [stale, setStale] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // A description written in another tab arrives with the refreshed page
  const followed = useRef(false);
  const job = useJobWatch(() => {
    followed.current = true;
  });
  useEffect(() => {
    if (!followed.current) return;
    followed.current = false;
    setBrief(initial);
    setDraft(initial.story);
    setStale(false);
    setRevising(false);
    // Only a new saved description replaces what's on screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.story]);
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
    setError(null);
  }

  function detailsProblem(): string | null {
    if (!brief.name.trim()) return "Type your business name.";
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
      if (!result.ok && result.busy) return job.watch([result.busy]);
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
      const saved = await saveBrandAction(next);
      if (!saved.ok) return setError(saved.message);
      setBrief(next);
      setDraft(text);
      setStale(false);
      setRevising(false);
    });
  }

  function tryDifferentWords() {
    setBrief((current) => ({ ...current, story: "", storyByOwner: false, storyApproved: false }));
    setDraft("");
    setStale(false);
    setRevising(false);
    setError(null);
    setNote("Change your picks, then choose “Describe my brand” again.");
    const heading = document.getElementById(`${uid}-feel`);
    heading?.scrollIntoView({ behavior: "smooth", block: "start" });
    heading?.focus({ preventScroll: true });
  }

  const busy = phase !== "idle" || job.watching;
  const textField = (key: "name" | "customers" | "likedColors" | "avoidColors" | "avoid", label: string, help: string, max: number) => (
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
        <SectionHead id={`${uid}-business`} number={1} title="What you sell" lead="Filled in from what you told us about your business. Change it if it’s not quite right." />
        <Card>
          {editingBusiness ? (
            <div className="flex flex-col gap-5">
              {!initial.name.trim() ? textField("name", "Your business name", "You can change how it’s spelled in your logo in the next step.", BRIEF_LIMITS.name) : null}
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
                  { label: "Business", value: brief.name },
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
          lead="Tap the words that fit and answer a few quick questions. We’ll describe your brand back to you, and that description guides your logo and every picture."
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
          <div className="flex flex-col gap-4 border-t border-line pt-6">
            <h3 className="font-display text-[20px] leading-snug">Colors</h3>
            <ColorPicker
              picked={brief.colors}
              onToggle={(family) => set("colors", (colors) => (colors.includes(family) ? colors.filter((name) => name !== family) : colors.length < MAX_COLOR_FAMILIES ? [...colors, family] : colors))}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              {textField("likedColors", "Colors you like or already use (optional)", "Such as “the forest green on our sign”.", BRIEF_LIMITS.colors)}
              {textField("avoidColors", "Colors to avoid (optional)", "Such as “no pink” or “nothing neon”.", BRIEF_LIMITS.colors)}
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-6">
            <h3 className="font-display text-[20px] leading-snug">Anything to avoid?</h3>
            {textField("avoid", "Things your brand shouldn’t look like (optional)", "Such as “no cupcakes” or “nothing that looks like a coffee chain”.", BRIEF_LIMITS.avoid)}
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-5">
            <button type="button" onClick={describe} disabled={busy} className={`${AI_BUTTON} w-fit`}>
              <Icon name="sparkles" size="sm" />
              {phase === "describing" || job.watching ? "Describing…" : brief.story ? "Describe my brand again" : "Describe my brand"}
            </button>
            <Working label={job.watching ? RUNNING_ELSEWHERE : "Describing your brand… this takes a few seconds"} active={phase === "describing" || job.watching} />
            {!brief.story ? messages : null}
          </div>
        </Card>
      </section>

      <section id={`${uid}-story`} aria-labelledby={`${uid}-story-heading`} className="flex scroll-mt-4 flex-col gap-4">
        <SectionHead id={`${uid}-story-heading`} number={3} title="Your brand description">
          {brief.story ? (
            <p className="flex flex-wrap items-center gap-2 text-[15px] text-muted">
              {brief.storyByOwner ? (
                <>
                  In your words. It guides your logo ideas and every picture.
                </>
              ) : practice ? (
                <Chip tone="warn">{PRACTICE_LABEL}</Chip>
              ) : (
                <>
                  Written by AI from the words you picked. It guides your logo ideas and every picture.
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
              <div className="flex flex-col gap-4">
                <Done>
                  <span className="flex flex-wrap items-center gap-2">
                    You said this feels like your business. This step is done.
                  </span>
                </Done>
                <div className="flex flex-wrap gap-3">
                  <Link href="/logo" className={PRIMARY_LINK}>
                    Next: Create your logo
                    <Icon name="arrow" size="sm" />
                  </Link>
                  <button type="button" onClick={() => setRevising(true)} disabled={busy} className={SECONDARY}>
                    <Icon name="pencil" size="sm" />
                    Revise this description
                  </button>
                  <button type="button" onClick={tryDifferentWords} disabled={busy} className={SECONDARY}>
                    <Icon name="refresh" size="sm" />
                    Try different words
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => approve(brief.story)} disabled={busy} className={PRIMARY}>
                  <Icon name="check" size="sm" />
                  {phase === "saving" ? "Saving…" : "This feels like my business"}
                </button>
                <button type="button" onClick={() => setRevising(true)} disabled={busy} className={SECONDARY}>
                  Revise this description
                </button>
                <button type="button" onClick={tryDifferentWords} disabled={busy} className={SECONDARY}>
                  Try different words
                </button>
              </div>
            )}
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
