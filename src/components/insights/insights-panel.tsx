"use client";

import Link from "next/link";
import { type ReactNode, useLayoutEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { markInsightAction, writeInsightsAction } from "@/app/(app)/insights/actions";
import { Icon, type IconName } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { useJobWatch } from "@/components/job-watch";
import { PracticeBanner } from "@/components/practice-banner";
import { StepProgress, stepStatus, useStepTicker } from "@/components/step-progress";
import { AI_BUTTON, ALERT, EYEBROW, PRIMARY_LINK, SECONDARY, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { Fold, IconTile } from "@/components/ui";
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
  const job = useJobWatch(() => {
    focusNext.current = "opening";
    void ticker.finish().then(() => setAnnouncement("Your insights are ready."));
  });
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
      // Already being written, maybe in another tab: keep showing progress until it's done
      if (!result.ok && result.busy) return job.watch([result.busy]);
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
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
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
        setError("Couldn’t reach SnapStart. Check your connection and try again.");
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
      <Icon name="refresh" size="sm" />
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
      <section aria-labelledby="insights-start" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface px-4 py-6 shadow-card sm:p-7">
        <div className="flex items-center gap-3">
          <IconTile icon="lightbulb" big />
          <h2 id="insights-start" className={SECTION_TITLE}>
            Get friendly feedback on your idea
          </h2>
        </div>
        <p className="text-rule">
          SnapStart reads what you’ve told it so far, like your answers, licenses and registrations, brand and website, and shares what’s strong, a few
          things to keep an eye on, tips for success and creative ideas.
        </p>
        {practice ? (
          <p className="flex items-start gap-2 text-sm text-check">
            <Icon name="info" size="sm" className="mt-px" />
            Practice mode: you’ll see sample insights made by built-in rules, not AI.
          </p>
        ) : null}
        <button type="button" ref={focusIf("button")} onClick={write} className={`${AI_BUTTON} w-fit`}>
          <Icon name="sparkles" size="sm" />
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
    <div className="flex flex-col gap-6">
      {insights.simulated ? <PracticeBanner what="These are sample insights, made to show how this page works." /> : null}

      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Icon name="clock" size="xs" />
          <span>
            Written <LocalDate iso={insights.generatedAt} />
          </span>
        </p>
        {changed.length ? (
          <div className="flex flex-col gap-3 rounded-[14px] border border-ai/20 bg-ai-tint px-4 py-3.5 sm:flex-row sm:items-center">
            <p className="flex min-w-0 flex-1 items-start gap-2.5 text-ai-ink">
              <Icon name="refresh" className="mt-0.5 text-ai" />
              <span>You’ve updated {joinWords(changed)} since these were written. Refresh to get insights that fit.</span>
            </p>
            {refreshButton}
          </div>
        ) : null}
        {errorAlert}
        <p ref={openingRef} tabIndex={-1} className="border-l-[3px] border-accent-ring py-1 pl-4 text-lg text-rule">
          {insights.opening}
        </p>
      </div>

      {changed.length ? null : <NextStep items={insights.items} marks={marks} />}

      <InsightSections items={insights.items} marks={marks} onMark={onMark} />

      <footer className="flex flex-col gap-3 border-t border-line pt-5">
        <p className="text-sm text-muted">
          Anything about laws, permits, taxes or fees links to pages SnapStart checked against official sources. Points that state their own
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


// One clear next action: the first thing to plan for, else the first tip, that the owner hasn't dismissed
function NextStep({ items, marks }: { items: Insight[]; marks: Marks }) {
  const open = items.filter((item) => item.action && marks[item.key] !== "dismissed");
  const next = open.find((item) => item.section === "watch") ?? open.find((item) => item.section === "tips");
  if (!next) return null;
  return (
    <section
      aria-labelledby="next-step"
      className="relative flex flex-col gap-3 rounded-2xl border border-line bg-surface py-5 pl-11 pr-5 shadow-lift before:absolute before:inset-y-0 before:left-7 before:w-[1.5px] before:bg-accent-ring sm:pl-12 sm:pr-7"
    >
      <div className="flex items-center gap-3">
        <IconTile icon="flag" big />
        <h2 id="next-step" className={EYEBROW}>
          A good next step
        </h2>
      </div>
      <p className="font-display text-[22px] leading-snug sm:text-[24px]">{next.action}</p>
      {next.link ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={next.link.href} className={PRIMARY_LINK}>
            Take me there<span className="sr-only">: {next.link.label}</span>
            <Icon name="arrow" size="sm" />
          </Link>
          <span aria-hidden="true" className="text-sm text-muted">
            {next.link.label}
          </span>
        </div>
      ) : null}
    </section>
  );
}

const SECTION_LOOK: Record<InsightSection, { icon: IconName; tone: "done" | "warn" | "accent" | "pick" }> = {
  strengths: { icon: "check", tone: "done" },
  watch: { icon: "flag", tone: "warn" },
  tips: { icon: "lightbulb", tone: "pick" },
  ideas: { icon: "sparkles", tone: "accent" },
};

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
          <section key={section} aria-labelledby={`insights-${section}`} className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
              <IconTile icon={SECTION_LOOK[section].icon} tone={SECTION_LOOK[section].tone} />
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 id={`insights-${section}`} tabIndex={-1} className="text-[17.5px] font-bold leading-snug">
                  {info.title}
                </h2>
                <p className="text-[14.5px] text-muted">{info.intro}</p>
              </div>
            </div>
            {shown.length ? (
              <ul className="flex flex-col">
                {shown.map((item) => (
                  <InsightCard key={item.key} item={item} mark={marks[item.key] ?? null} onMark={(value) => onMark(item, value)} />
                ))}
              </ul>
            ) : all.length ? (
              <p className="px-4 py-4 text-sm text-muted sm:px-5">You dismissed everything here. You can bring points back below.</p>
            ) : (
              <p className="flex items-center gap-2 px-4 py-4 text-rule sm:px-5">
                <Icon name="check" size="sm" className="text-done" />
                {info.empty}
              </p>
            )}
          </section>
        );
      })}
      {dismissed.length ? (
        <Fold title={dismissed.length === 1 ? "Show 1 dismissed insight" : `Show ${dismissed.length} dismissed insights`} summary="Bring back any you want to see again.">
          <ul className="flex flex-col">
            {dismissed.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2.5 last:border-b-0">
                <span className="text-rule">{item.title}</span>
                <button type="button" onClick={() => onMark(item, null)} className={SECONDARY}>
                  Bring back<span className="sr-only">: {item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </Fold>
      ) : null}
    </>
  );
}

const MARK_BUTTON = "inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border px-3.5 text-[15px] font-semibold shadow-soft transition active:translate-y-px";

function InsightCard({ item, mark, onMark }: { item: Insight; mark: InsightMark | null; onMark: (mark: InsightMark | null) => void }) {
  const useful = mark === "useful";
  return (
    <li className="flex flex-col gap-2 border-b border-line px-4 py-4 last:border-b-0 sm:px-5">
      <h3 className="font-display text-[19px] leading-snug">{item.title}</h3>
      <p className="text-rule">{item.detail}</p>
      {item.action ? (
        <p className="flex items-start gap-2">
          <Icon name="arrow" size="sm" className="mt-1 text-accent" />
          <span>
            <span className="font-semibold">Try this: </span>
            {item.action}
          </span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        {item.link ? <TakeMeThere link={item.link} /> : null}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            aria-pressed={useful}
            onClick={() => onMark(useful ? null : "useful")}
            className={`${MARK_BUTTON} ${useful ? "border-accent bg-accent-tint text-accent-ink" : "border-line-strong bg-surface text-ink hover:border-muted hover:bg-soft"}`}
          >
            {useful ? <Icon name="check" size="sm" strokeWidth={2.4} className="pen-draw" /> : null}
            Useful
            <span className="sr-only">: {item.title}</span>
          </button>
          <button type="button" onClick={() => onMark("dismissed")} className={`${MARK_BUTTON} border-line-strong bg-surface text-muted hover:border-muted hover:bg-soft hover:text-ink`}>
            <Icon name="close" size="sm" />
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
