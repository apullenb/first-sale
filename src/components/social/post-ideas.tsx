"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { markSocialIdeaReadAction, socialIdeasAction } from "@/app/(app)/social/actions";
import { Icon } from "@/components/icons";
import { CopyButton } from "@/components/website/copy-button";
import type { IdeaSet } from "@/lib/social/ideas";

// The owner's calendar day, so new ideas arrive on their own morning
function localDay(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const siteOf = (url: string) => URL.parse(url)?.hostname.replace(/^www\./, "") ?? url;
const RETRY_MS = 6_000;
const MAX_TRIES = 30;

export function PostIdeas({ initial }: { initial: IdeaSet | null }) {
  const [set, setSet] = useState<IdeaSet | null>(initial);
  const [state, setState] = useState<"ready" | "loading" | "failed">("ready");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [read, setRead] = useState<number[]>(initial?.read ?? []);
  const panelId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const load = useCallback(() => {
    const attempt = async (tries: number) => {
      await Promise.resolve();
      setState("loading");
      const result = await socialIdeasAction(localDay()).catch(() => null);
      if (result?.ok) {
        setSet(result.value);
        setRead(result.value?.read ?? []);
        setState("ready");
        return;
      }
      // Another tab is making today's ideas
      if (result && "busy" in result && result.busy && tries < MAX_TRIES) {
        window.setTimeout(() => void attempt(tries + 1), RETRY_MS);
        return;
      }
      setMessage(result?.message ?? "Couldn’t load today’s ideas. Try again.");
      setState("failed");
    };
    void attempt(0);
  }, []);

  useEffect(() => {
    if (initial?.day !== localDay()) load();
  }, [initial?.day, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const ideas = set?.ideas ?? [];
  const unread = ideas.filter((_, index) => !read.includes(index)).length;

  function toggle(index: number) {
    const next = expanded === index ? null : index;
    setExpanded(next);
    if (next === null || !set || read.includes(index)) return;
    setRead((current) => [...current, index]);
    void markSocialIdeaReadAction({ day: set.day, index }).catch(() => null);
  }

  const label = state === "loading" && !ideas.length ? "Post ideas, finding today’s" : unread ? `Post ideas, ${unread} new` : "Post ideas";

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        title="Post ideas for today"
        className="relative inline-flex size-12 items-center justify-center rounded-full border border-line bg-surface text-accent shadow-card transition hover:border-accent-ring hover:bg-accent-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icon name="lightbulb" size="lg" strokeWidth={1.8} />
        {unread ? (
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[12px] font-bold leading-5 text-white">
            {unread}
          </span>
        ) : state === "loading" ? (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-3 animate-pulse rounded-full bg-accent-ring" />
        ) : null}
      </button>

      {open ? (
        <section
          id={panelId}
          aria-label="Post ideas"
          className="absolute right-0 top-full z-30 mt-2 w-[min(460px,calc(100vw-32px))] rounded-[14px] border border-line bg-surface p-4 shadow-card"
        >
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">Post ideas</p>
              <h2 className="font-display text-[20px] leading-snug">What to post about today</h2>
              <p className="text-sm text-muted">Three new ideas each day, from what’s happening near you and in your market.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close post ideas" className="rounded-md p-1 text-muted hover:bg-wash hover:text-ink">
              <Icon name="close" size="sm" />
            </button>
          </header>

          {set?.simulated ? (
            <p className="mt-3 rounded-xl border border-check/30 bg-check-tint px-3 py-2 text-sm text-check">
              <strong>Practice mode.</strong> These are stand-ins made from your answers, not real local news.
            </p>
          ) : null}

          {state === "loading" && set?.day !== localDay() ? (
            <p role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-accent-tint px-3 py-2 text-sm text-accent-ink">
              <Icon name="sparkles" size="sm" className="animate-pulse" />
              Finding today’s ideas. This takes about a minute.
            </p>
          ) : null}
          {state === "failed" ? (
            <p role="alert" className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-check-ring bg-check-tint px-3 py-2 text-sm text-check">
              {message}
              <button type="button" onClick={load} className="font-semibold text-accent underline underline-offset-2">
                Try again
              </button>
            </p>
          ) : null}

          {ideas.length ? (
            <ol className="mt-3 grid gap-2">
              {ideas.map((idea, index) => {
                const isOpen = expanded === index;
                const isNew = !read.includes(index);
                const bodyId = `${panelId}-${index}`;
                return (
                  <li key={idea.topic} className={`rounded-xl border ${isOpen ? "border-accent-ring bg-soft" : "border-line bg-surface"}`}>
                    <button type="button" onClick={() => toggle(index)} aria-expanded={isOpen} aria-controls={bodyId} className="flex w-full items-start gap-3 px-3 py-2.5 text-left">
                      <span aria-hidden="true" className={`mt-2 size-2 shrink-0 rounded-full ${isNew ? "bg-accent" : "bg-transparent"}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block leading-snug ${isNew ? "font-bold text-ink" : "font-semibold text-muted"}`}>{idea.topic}</span>
                        {isOpen ? null : <span className="line-clamp-1 text-sm text-muted">{idea.happening}</span>}
                        {isNew ? <span className="sr-only"> (new)</span> : null}
                      </span>
                      <Icon name="chevron" size="sm" className={`mt-1 shrink-0 text-muted transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </button>
                    {isOpen ? (
                      <div id={bodyId} className="grid gap-3 border-t border-line px-3 pb-3 pt-2.5 text-[15px]">
                        <div>
                          <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted">What’s happening</p>
                          <p>{idea.happening}</p>
                        </div>
                        <div>
                          <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted">Why it fits</p>
                          <p>{idea.fit}</p>
                        </div>
                        <div>
                          <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted">Suggested post</p>
                          <p className="mt-1 whitespace-pre-line rounded-lg border border-line bg-surface px-3 py-2">{idea.post}</p>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <CopyButton text={idea.post} label="suggested post" />
                            <a href={idea.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:text-accent-ink">
                              <Icon name="external" size="sm" />
                              Source: {siteOf(idea.sourceUrl)}
                              <span className="sr-only"> (opens in a new tab)</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : state === "ready" ? (
            <p className="mt-3 text-sm text-muted">No ideas yet today.</p>
          ) : null}

          <p className="mt-3 text-[13px] text-muted">Read each idea and its source before posting. You post it yourself.</p>
        </section>
      ) : null}
    </div>
  );
}
