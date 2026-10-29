"use client";

import Link from "next/link";
import { type ReactNode, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { markInsightAction, writeInsightsAction } from "@/app/(app)/insights/actions";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { PracticeBanner } from "@/components/practice-banner";
import { StepProgress, stepStatus, useStepTicker } from "@/components/step-progress";
import { AI_BUTTON, ALERT, CARD, SECONDARY, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import type { Insight, InsightMark, InsightSection } from "@/lib/insights/types";

const STEPS = [
  "Reading your answers, plan, brand and website",
  "Finding what’s strong about your idea",
  "Looking for things worth planning for",
  "Picking tips that fit your business",
  "Thinking up creative ideas",
  "Checking it’s kind, clear and sticks to your facts",
] as const;
// The last two steps tick only when the reply is back
const SCHEDULE = [1200, 7000, 15000, 24000];

const SECTIONS: Record<InsightSection, { title: string; intro: string; empty: string }> = {
  strengths: { title: "What’s strong", intro: "Things you’re already doing well.", empty: "" },
  watch: {
    title: "Worth keeping an eye on",
    intro: "A few things to plan for, each with a small next step.",
    empty: "Nothing to flag right now. Keep going!",
  },
  tips: { title: "Tips for success", intro: "Ideas that fit your business and how you sell.", empty: "" },
  ideas: { title: "Creative ideas", intro: "Fresh ways to delight customers and stand out.", empty: "" },
};
const ORDER: InsightSection[] = ["strengths", "watch", "tips", "ideas"];

type Marks = Record<string, InsightMark>;

interface Props {
  insights: { opening: string; items: Insight[]; generatedAt: string; simulated: boolean; removed: number } | null;
  marks: Marks;
  // Plain labels of what changed since the insights were written
  changed: string[];
  practice: boolean;
}

// Focus a section's heading after its card goes, so keyboard users aren't dropped at the top of the page
function focusSection(section: InsightSection) {
  window.requestAnimationFrame(() => document.getElementById(`insights-${section}`)?.focus());
}

export function InsightsPanel({ insights, marks: savedMarks, changed, practice }: Props) {
  const ticker = useStepTicker(STEPS.length, SCHEDULE);
  const [error, setError] = useState<string | null>(null);
  // Set when a run starts, so the title holds when the new insights arrive mid-run
  const [refreshing, setRefreshing] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  // Where focus goes once the progress screen closes
  const focusNext = useRef<"opening" | "button" | null>(null);
  const [, startTransition] = useTransition();
  const [marks, setOptimistic] = useOptimistic(savedMarks, (state, change: { key: string; mark: InsightMark | null }) => {
    const next = { ...state };
    if (change.mark) next[change.key] = change.mark;
    else delete next[change.key];
    return next;
  });
  // Clear old messages when the page is hidden: kept-mounted screens keep their state
  useLayoutEffect(
    () => () => {
      setError(null);
      setAnnouncement("");
    },
    [],
  );

  async function write() {
    setError(null);
    setAnnouncement("");
    setRefreshing(Boolean(insights));
    ticker.start();
    try {
      const result = await writeInsightsAction();
      if (!result.ok) {
        focusNext.current = "button";
        ticker.stop();
        setError(result.message);
        return;
      }
      focusNext.current = "opening";
      await ticker.finish();
      setAnnouncement("Your insights are ready.");
    } catch {
      focusNext.current = "button";
      ticker.stop();
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    }
  }

  function mark(item: Insight, value: InsightMark | null) {
    setError(null);
    startTransition(async () => {
      setOptimistic({ key: item.key, mark: value });
      if (value === "dismissed" || (value === null && marks[item.key] === "dismissed")) focusSection(item.section);
      try {
        const result = await markInsightAction({ key: item.key, mark: value });
        if (!result.ok) setError(result.message);
      } catch {
        setError("Couldn’t reach First Sale. Check your connection and try again.");
      }
    });
  }

  // Focuses a screen's element once, when it mounts after the progress screen
  const focusIf = (target: "opening" | "button") => (node: HTMLElement | null) => {
    if (node && focusNext.current === target) {
      focusNext.current = null;
      node.focus();
    }
  };

  const errorAlert = error ? (
    <p role="alert" className={ALERT}>
      {error}
    </p>
  ) : null;

  const refreshButton = (
    <button type="button" ref={focusIf("button")} onClick={write} className={`${changed.length ? AI_BUTTON : SECONDARY} w-fit`}>
      Refresh insights
    </button>
  );

  let body: ReactNode;
  if (ticker.running) {
    body = (
      <StepProgress
        title={refreshing ? "Refreshing your insights" : "Writing your insights"}
        steps={STEPS}
        done={ticker.done}
        note={practice ? "Practice mode: built-in rules make sample insights, so this is quick." : "This usually takes under a minute."}
      />
    );
  } else if (!insights) {
    body = (
      <section className={`${CARD} flex flex-col gap-3`}>
        <h2 className={SECTION_TITLE}>Get friendly feedback on your idea</h2>
        <p className="text-rule">
          First Sale reads what you’ve told it so far, like your answers, startup plan, brand and website, and shares what’s strong, a few
          things to keep an eye on, tips for success and creative ideas.
        </p>
        <WhoDoesWhat simulated={practice} />
        {practice ? <p className="text-sm text-check">Practice mode: you’ll see sample insights made by built-in rules, not AI.</p> : null}
        <button type="button" ref={focusIf("button")} onClick={write} className={`${AI_BUTTON} w-fit`}>
          Get my insights
        </button>
        {errorAlert}
      </section>
    );
  } else {
    body = (
      <SavedInsights
        insights={insights}
        marks={marks}
        changed={changed}
        onMark={mark}
        refreshButton={refreshButton}
        errorAlert={errorAlert}
        openingRef={focusIf("opening")}
      />
    );
  }

  // The live region stays in one place, so screen readers announce each change
  return (
    <>
      <p role="status" className="sr-only">
        {ticker.running ? stepStatus(STEPS, ticker.done) : announcement}
      </p>
      {body}
    </>
  );
}

interface SavedProps {
  insights: NonNullable<Props["insights"]>;
  marks: Marks;
  changed: string[];
  onMark: (item: Insight, mark: InsightMark | null) => void;
  refreshButton: ReactNode;
  errorAlert: ReactNode;
  openingRef: (node: HTMLElement | null) => void;
}

function SavedInsights({ insights, marks, changed, onMark, refreshButton, errorAlert, openingRef }: SavedProps) {
  return (
    <div className="flex flex-col gap-5">
      {insights.simulated ? <PracticeBanner what="These are sample insights, made to show how this page works." /> : null}

      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">
          Written <LocalDate iso={insights.generatedAt} />
        </p>
        {changed.length ? (
          <div className="flex flex-col gap-3 rounded-xl bg-ai-tint px-4 py-3">
            <p className="text-ai-ink">You’ve updated {joinWords(changed)} since these were written. Refresh to get insights that fit.</p>
            {refreshButton}
          </div>
        ) : null}
        {errorAlert}
        <p ref={openingRef} tabIndex={-1} className="text-lg outline-none">
          {insights.opening}
        </p>
      </div>

      {changed.length ? null : <NextStep items={insights.items} marks={marks} />}

      <InsightSections items={insights.items} marks={marks} onMark={onMark} />

      <footer className="flex flex-col gap-3 border-t border-line pt-4">
        <WhoDoesWhat simulated={insights.simulated} />
        <p className="text-sm text-muted">
          Anything about laws, permits, taxes or fees links to pages First Sale checked against official sources. Points that state their own
          rules, fees or numbers are left out.
          {insights.removed > 0
            ? ` This time ${insights.removed === 1 ? "one point was" : `${insights.removed} points were`} left out to keep this kind, short and true to your facts.`
            : ""}
        </p>
        {changed.length ? null : refreshButton}
      </footer>
    </div>
  );
}

function WhoDoesWhat({ simulated }: { simulated: boolean }) {
  return (
    <ul aria-label="Who does what" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      <li className="flex items-center gap-2">
        {simulated ? <ActorChip actor="rule" /> : <ActorChip actor="ai" />}
        {simulated ? "make sample insights in practice mode" : "writes insights from your answers"}
      </li>
      <li className="flex items-center gap-2">
        <ActorChip actor="rule" /> keep them kind and stick to your facts
      </li>
      <li className="flex items-center gap-2">
        <ActorChip actor="owner" /> keep what’s useful
      </li>
    </ul>
  );
}

// One clear next action: the first thing to plan for, else the first tip, that the owner hasn't dismissed
function NextStep({ items, marks }: { items: Insight[]; marks: Marks }) {
  const open = items.filter((item) => item.action && marks[item.key] !== "dismissed");
  const next = open.find((item) => item.section === "watch") ?? open.find((item) => item.section === "tips");
  if (!next) return null;
  return (
    <section aria-labelledby="next-step" className="flex flex-col gap-1.5 rounded-2xl bg-accent-tint p-5">
      <h2 id="next-step" className="text-xs font-bold uppercase tracking-wider text-accent-ink">
        A good next step
      </h2>
      <p className="font-semibold text-accent-ink">{next.action}</p>
      {next.link ? <TakeMeThere link={next.link} /> : null}
    </section>
  );
}

function InsightSections({ items, marks, onMark }: { items: Insight[]; marks: Marks; onMark: (item: Insight, mark: InsightMark | null) => void }) {
  const dismissed = items.filter((item) => marks[item.key] === "dismissed");
  return (
    <>
      {ORDER.map((section) => {
        const all = items.filter((item) => item.section === section);
        const shown = all.filter((item) => marks[item.key] !== "dismissed");
        const info = SECTIONS[section];
        if (!all.length && !info.empty) return null;
        return (
          <section key={section} aria-labelledby={`insights-${section}`} className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id={`insights-${section}`} tabIndex={-1} className={`${SECTION_TITLE} outline-none`}>
                {info.title}
              </h2>
              <p className="text-muted">{info.intro}</p>
            </div>
            {shown.length ? (
              <ul className="flex flex-col gap-3">
                {shown.map((item) => (
                  <InsightCard key={item.key} item={item} mark={marks[item.key] ?? null} onMark={(value) => onMark(item, value)} />
                ))}
              </ul>
            ) : all.length ? (
              <p className="text-sm text-muted">You dismissed everything here. You can bring points back below.</p>
            ) : (
              <p className="rounded-xl bg-accent-tint px-4 py-3 text-accent-ink">{info.empty}</p>
            )}
          </section>
        );
      })}
      {dismissed.length ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-muted">
            {dismissed.length === 1 ? "Show 1 dismissed insight" : `Show ${dismissed.length} dismissed insights`}
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {dismissed.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rule-tint px-4 py-2">
                <span className="text-rule">{item.title}</span>
                <button type="button" onClick={() => onMark(item, null)} className={SECONDARY}>
                  Bring back<span className="sr-only">: {item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function InsightCard({ item, mark, onMark }: { item: Insight; mark: InsightMark | null; onMark: (mark: InsightMark | null) => void }) {
  const useful = mark === "useful";
  return (
    <li className={`flex flex-col gap-2 rounded-xl bg-surface p-4 ring-1 ${useful ? "ring-accent/40" : "ring-ink/5"}`}>
      <h3 className="font-display text-lg font-bold">{item.title}</h3>
      <p className="text-rule">{item.detail}</p>
      {item.action ? (
        <p>
          <span className="font-semibold">Try this: </span>
          {item.action}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {item.link ? <TakeMeThere link={item.link} /> : null}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            aria-pressed={useful}
            onClick={() => onMark(useful ? null : "useful")}
            className={`min-h-11 rounded-lg border px-3 text-sm font-semibold ${useful ? "border-accent bg-accent-tint text-accent-ink" : "border-field bg-surface hover:border-muted"}`}
          >
            {useful ? "Useful ✓" : "Useful"}
            <span className="sr-only">: {item.title}</span>
          </button>
          <button type="button" onClick={() => onMark("dismissed")} className="min-h-11 rounded-lg border border-field bg-surface px-3 text-sm font-semibold text-muted hover:border-muted">
            Dismiss<span className="sr-only">: {item.title}</span>
          </button>
        </div>
      </div>
    </li>
  );
}

function TakeMeThere({ link }: { link: { href: string; label: string } }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      <Link href={link.href} className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
        Take me there<span className="sr-only">: {link.label}</span>
      </Link>
      <span aria-hidden="true" className="text-sm text-muted">
        {link.label}
      </span>
    </span>
  );
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
