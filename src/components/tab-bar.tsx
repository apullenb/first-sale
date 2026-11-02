"use client";

import Link from "next/link";
import { type Ref, useEffect, useSyncExternalStore } from "react";
import { Icon, type IconName } from "./icons";
import { type NavStatus, placeOf, stepsOf } from "./nav-links";
import type { SectionGroup } from "@/lib/sections";

interface Tab {
  key: string;
  label: string;
  // Read out in place of the short label
  name: string;
  icon: IconName;
  href: string;
  group?: SectionGroup;
}

const TABS: Tab[] = [
  { key: "today", label: "Today", name: "Today", icon: "home", href: "/" },
  { key: "start", label: "Start", name: "Start your business", icon: "flag", href: "/start", group: "Start your business" },
  { key: "brand", label: "Brand", name: "Build your brand", icon: "palette", href: "/build-your-brand", group: "Build your brand" },
  { key: "run", label: "Run", name: "Run your business", icon: "building", href: "/run", group: "Run your business" },
];

const TAB = "relative flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 pt-1.5 pb-1 text-[12.5px] font-semibold leading-none transition";

// Phones only: the sections as tabs along the bottom; More opens the full menu
export function TabBar({
  pathname,
  status,
  menuOpen,
  onMore,
  moreRef,
}: {
  pathname: string | null;
  status?: NavStatus;
  menuOpen: boolean;
  // Missing while the menu loads
  onMore?: () => void;
  moreRef?: Ref<HTMLButtonElement>;
}) {
  const parts = status?.parts ?? {};
  const { group } = placeOf(pathname, status);
  const current = pathname === "/" ? "today" : (TABS.find((tab) => tab.group && tab.group === group)?.key ?? (pathname ? "more" : null));
  // Brand and Run open once there's a business; until then they show, locked
  const locked = status ? !status.scope : false;
  const waiting = (tab: Tab) => (tab.group ? stepsOf(tab.group, status).some((step) => (parts[step.href]?.count ?? 0) > 0) : false);
  const moreWaiting = (parts["/documents"]?.count ?? 0) > 0;
  return (
    <>
      <TabsHint />
      <nav
        aria-label="Section tabs"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-sidebar pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-white shadow-[0_-8px_24px_-12px_rgb(19_41_75/0.45)] md:hidden [&_:focus-visible]:outline-sky"
      >
        <ul className="mx-auto flex max-w-xl items-stretch gap-1 px-2 py-1">
          {TABS.map((tab) => {
            const active = current === tab.key && !menuOpen;
            const isLocked = locked && tab.key !== "today" && tab.key !== "start";
            return (
              <li key={tab.key} className="flex flex-1">
                <Link href={tab.href} aria-current={active ? "page" : undefined} className={`${TAB} ${active ? "text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`}>
                  {active ? <span aria-hidden="true" className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-sky" /> : null}
                  <span className="relative">
                    <Icon name={tab.icon} className={active ? "text-sky" : ""} />
                    {isLocked ? (
                      <span aria-hidden="true" className="absolute -right-2 -bottom-1 grid size-[15px] place-items-center rounded-full bg-sidebar text-white/80 ring-1 ring-white/30">
                        <Icon name="lock" size="xs" strokeWidth={2.4} />
                      </span>
                    ) : waiting(tab) ? (
                      <span aria-hidden="true" className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-alert ring-2 ring-sidebar" />
                    ) : null}
                  </span>
                  <span>
                    <span aria-hidden="true">{tab.label}</span>
                    <span className="sr-only">{tab.name}</span>
                    {isLocked ? <span className="sr-only">, locked until you tell us about your business</span> : waiting(tab) ? <span className="sr-only">, has steps waiting</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              ref={moreRef}
              type="button"
              aria-expanded={menuOpen}
              aria-controls="phone-menu"
              onClick={onMore}
              disabled={!onMore}
              className={`${TAB} ${menuOpen || current === "more" ? "text-white" : "text-white/70 hover:bg-white/[0.06] hover:text-white"}`}
            >
              {current === "more" && !menuOpen ? <span aria-hidden="true" className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-sky" /> : null}
              <span className="relative">
                <Icon name={menuOpen ? "close" : "menu"} className={menuOpen || current === "more" ? "text-sky" : ""} />
                {moreWaiting ? <span aria-hidden="true" className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-alert ring-2 ring-sidebar" /> : null}
              </span>
              <span>
                More
                <span className="sr-only">{menuOpen ? ", close the menu" : ": insights, documents, your account and every step"}</span>
                {moreWaiting ? <span className="sr-only">, documents to check</span> : null}
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

const HINT_KEY = "first-sale:tabs-hint";
const HINT_EVENT = "first-sale:tabs-hint";

function hintSeen(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "seen";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(HINT_EVENT, onChange);
  return () => window.removeEventListener(HINT_EVENT, onChange);
}

// Once per browser, the first time the tabs show
function dismissHint() {
  try {
    window.localStorage.setItem(HINT_KEY, "seen");
  } catch {
    // Private windows: it shows again next time
  }
  window.dispatchEvent(new Event(HINT_EVENT));
}

function TabsHint() {
  const seen = useSyncExternalStore(subscribe, hintSeen, () => true);
  // Scrolling means they've seen it, and it never sits over the page for long
  useEffect(() => {
    // Only on phones, where the tip shows
    if (seen || !window.matchMedia("(max-width: 767px)").matches) return;
    const start = window.scrollY;
    const onScroll = () => {
      if (Math.abs(window.scrollY - start) > 120) dismissHint();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [seen]);
  if (seen) return null;
  const dismiss = dismissHint;
  return (
    <div
      role="note"
      aria-label="Tip"
      className="fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-center gap-2 rounded-xl border border-line-strong bg-surface py-1.5 pr-1.5 pl-3.5 text-[15px] font-semibold text-ink shadow-lift md:hidden"
    >
      <Icon name="arrow" size="sm" className="rotate-90 text-accent" />
      <p className="flex-1">Your other sections are down here</p>
      <button type="button" onClick={dismiss} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft hover:text-ink">
        <Icon name="close" size="sm" />
        <span className="sr-only">Got it, hide this tip</span>
      </button>
      <span aria-hidden="true" className="absolute -bottom-[7px] left-1/2 size-3 -translate-x-1/2 rotate-45 border-r border-b border-line-strong bg-surface" />
    </div>
  );
}
