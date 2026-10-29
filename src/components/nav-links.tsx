"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { formatMinutes } from "@/lib/rules/progress";
import { type PartStatus, sectionState, type SidebarStatus } from "@/lib/rules/section-status";
import { HOME, SECTION_GROUPS, SECTIONS, type Section, type SectionGroup } from "@/lib/sections";
import { celebrate, onCelebrate } from "./celebrate";

export interface NavStatus {
  parts: SidebarStatus;
  // The business, so done steps remembered in this browser stay with it; null before there is one
  scope: string | null;
}

const ICONS: Record<string, IconName> = {
  "/insights": "lightbulb",
  "/documents": "book",
  "/brand-library": "image",
  "/orders": "receipt",
  "/planning-for-help": "users",
};

const GROUP_ICONS: Record<SectionGroup, IconName> = {
  "Start your business": "flag",
  "Build your brand": "palette",
  "Run your business": "building",
};

// Sections that are steps to finish, in order
const JOURNEY: SectionGroup[] = ["Start your business", "Build your brand"];

const stepsOf = (group: SectionGroup) => SECTIONS.filter((section) => section.group === group && section.step !== null).map((section) => section.href);

// Sub-pages like /business/new highlight their section
function isActive(href: string, activeHref: string | null): boolean {
  if (!activeHref) return false;
  return activeHref === href || (href !== "/" && activeHref.startsWith(`${href}/`));
}

export function NavLinks({ activeHref, status }: { activeHref: string | null; status?: NavStatus }) {
  const parts = status?.parts ?? {};
  const page = SECTIONS.find((section) => isActive(section.href, activeHref)) ?? null;
  const highlighted = page?.under ?? page?.href ?? null;
  // Open where the owner is working: this page's section, or the first with something left
  const working = page?.group ?? JOURNEY.find((group) => sectionState(parts, stepsOf(group)) === "todo") ?? null;
  // Opened or closed by hand, until the owner moves to another section
  const [toggled, setToggled] = useState<{ on: SectionGroup | null; groups: Partial<Record<SectionGroup, boolean>> }>({ on: working, groups: {} });
  if (toggled.on !== working) setToggled({ on: working, groups: {} });
  const isOpen = (group: SectionGroup) => toggled.groups[group] ?? group === working;
  // One section open at a time, so the menu fits without scrolling
  const toggle = (group: SectionGroup) =>
    setToggled({ on: working, groups: Object.fromEntries(SECTION_GROUPS.map((each) => [each, each === group ? !isOpen(group) : false])) });

  // Set before paint, so a new check doesn't flash in full before it pops
  const [fresh, setFresh] = useState<string[]>([]);
  useLayoutEffect(() => onCelebrate(({ hrefs }) => setFresh((current) => [...current, ...hrefs])), []);
  useCelebrateNewlyDone(status);

  // Plan steps left; documents to check have their own count
  const total = SECTIONS.filter((section) => section.step !== null).reduce((sum, section) => sum + (parts[section.href]?.count ?? 0), 0);
  const standalone = SECTIONS.filter((section) => section.group === null);
  return (
    <nav aria-label="Sections" className="flex flex-col gap-0.5">
      <NavItem href={HOME.href} title={HOME.title} icon="home" active={isActive(HOME.href, activeHref)} count={total} />
      {standalone.map((section) => {
        const count = parts[section.href]?.count ?? 0;
        return (
          <NavItem
            key={section.href}
            href={section.href}
            title={section.title}
            icon={ICONS[section.href] ?? "file"}
            active={highlighted === section.href}
            count={count}
            countLabel={`${count} to check`}
          />
        );
      })}
      {SECTION_GROUPS.map((group) => {
        const sections = SECTIONS.filter((section) => section.group === group && !section.under);
        const steps = sections.filter((section) => section.step !== null);
        const others = sections.filter((section) => section.step === null);
        const open = isOpen(group);
        const id = `nav-${group.toLowerCase().replaceAll(" ", "-")}`;
        const body = (
          <>
            {steps.length ? (
              <ol className="relative flex flex-col gap-0.5 before:absolute before:bottom-5 before:left-[25px] before:top-5 before:w-[1.5px] before:bg-white/15">
                {steps.map((section) => (
                  <PartItem key={section.href} section={section} active={highlighted === section.href} part={parts[section.href]} fresh={fresh.includes(section.href)} />
                ))}
              </ol>
            ) : null}
            {others.map((section) => (
              <NavItem key={section.href} href={section.href} title={section.title} icon={ICONS[section.href] ?? "file"} active={highlighted === section.href} count={0} />
            ))}
          </>
        );
        const stepHrefs = steps.map((section) => section.href);
        return (
          <div key={group} className="flex flex-col">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => toggle(group)}
              className="mt-0.5 flex min-h-9 items-center gap-2 rounded-[10px] px-2.5 text-left text-[12.5px] font-bold uppercase tracking-[0.09em] text-white/60 transition hover:bg-white/[0.06] hover:text-white"
            >
              <Icon name={GROUP_ICONS[group]} size="xs" className="text-sky" />
              <span className="flex-1">{group}</span>
              {stepHrefs.length ? (
                <SectionMark state={status ? sectionState(parts, stepHrefs) : null} done={stepHrefs.filter((href) => parts[href]?.state === "done").length} of={stepHrefs.length} />
              ) : null}
              <Icon name="chevron" size="xs" className={`text-white/45 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-90" : ""}`} />
            </button>
            <div
              id={id}
              inert={!open}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="-mx-1 min-h-0 overflow-hidden px-1">
                <div className="flex flex-col gap-0.5 py-1">{body}</div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

const NEW_OWNER = "first-sale:new-owner";

// Steps done since this browser last looked get the stamp and a check that draws in. The first look just remembers
// them, unless this browser saw the owner before they had a business: then their first step gets its stamp too.
function useCelebrateNewlyDone(status: NavStatus | undefined) {
  const scope = status ? status.scope : undefined;
  const done = status
    ? SECTIONS.filter((section) => section.step !== null && status.parts[section.href]?.state === "done")
        .map((section) => section.href)
        .sort()
        .join(" ")
    : null;
  useLayoutEffect(() => {
    if (scope === undefined || done === null) return;
    const now = done ? done.split(" ") : [];
    let seen: string[] | null = null;
    try {
      if (scope === null) {
        window.localStorage.setItem(NEW_OWNER, "1");
        return;
      }
      const key = `first-sale:done:${scope}`;
      const saved = window.localStorage.getItem(key);
      seen = saved ? (JSON.parse(saved) as string[]) : window.localStorage.getItem(NEW_OWNER) ? [] : null;
      window.localStorage.setItem(key, JSON.stringify(now));
      window.localStorage.removeItem(NEW_OWNER);
    } catch {
      return;
    }
    const added = seen ? now.filter((href) => !seen.includes(href)) : [];
    if (!added.length) return;
    const finished = JOURNEY.find((group) => {
      const hrefs = stepsOf(group);
      return hrefs.some((href) => added.includes(href)) && hrefs.every((href) => now.includes(href));
    });
    const last = SECTIONS.filter((section) => added.includes(section.href)).at(-1);
    celebrate(finished ?? last?.title ?? "Step", added);
  }, [scope, done]);
}

function SectionMark({ state, done, of }: { state: PartStatus["state"] | null; done: number; of: number }) {
  if (state === "done") {
    return (
      <span title="All done" className="grid size-4 place-items-center rounded-full bg-done-bright text-sidebar">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        <span className="sr-only">, all done</span>
      </span>
    );
  }
  if (state === "waiting") {
    return (
      <span title="Waiting to hear back on something you sent in" className="grid size-4 place-items-center rounded-full bg-check-ring text-sidebar">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 7v5l3 2" />
        </svg>
        <span className="sr-only">, waiting to hear back</span>
      </span>
    );
  }
  if (state === null) return null;
  return (
    <span className="text-[12px] font-semibold normal-case tracking-normal text-white/45 tabular-nums">
      {done} of {of}
      <span className="sr-only"> steps done</span>
    </span>
  );
}

function Underline() {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 8" preserveAspectRatio="none" className="absolute -bottom-1.5 -left-0.5 -right-1 h-[7px] w-[calc(100%+6px)] text-sky">
      <path d="M1 5.5C18 3 40 2.6 60 3.4S88 5.2 99 3.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function Count({ count, label }: { count: number; label: string }) {
  if (!count) return null;
  return (
    <span title={label} className="ml-auto inline-grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-alert px-[7px] text-[12.5px] font-bold leading-none text-white tabular-nums ring-2 ring-sidebar">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">, {label}</span>
    </span>
  );
}

function NavItem({ href, title, icon, active, count, countLabel }: { href: string; title: string; icon: IconName; active: boolean; count: number; countLabel?: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-9 items-center gap-3 rounded-[10px] px-2.5 py-1 text-[15.5px] font-semibold transition ${
        active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Icon name={icon} className={active ? "text-sky" : "text-white/50"} />
      <span className="relative">
        {title}
        {active ? <Underline /> : null}
      </span>
      <Count count={count} label={countLabel ?? `${count} ${count === 1 ? "step" : "steps"} left`} />
    </Link>
  );
}

function PartItem({ section, active, part, fresh }: { section: Section; active: boolean; part?: PartStatus; fresh: boolean }) {
  const state = part?.state ?? null;
  const marker =
    state === "done" ? (
      <span className={`grid size-[18px] place-items-center rounded-full bg-done-bright text-sidebar ${fresh ? "animate-pop" : ""}`}>
        <svg viewBox="0 0 24 24" className={`size-3 ${fresh ? "pen-draw" : ""}`} fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          {/* Draws in once the circle has popped */}
          <path d="M5 12.5l4.5 4.5L19 7.5" style={fresh ? { animationDelay: "1.2s" } : undefined} />
        </svg>
      </span>
    ) : state === "waiting" ? (
      <Icon name="clock" size="xs" strokeWidth={2.2} />
    ) : (
      section.step
    );
  const label = state === "done" ? "done" : state === "waiting" ? "waiting to hear back" : null;
  return (
    <li>
      <Link
        href={section.href}
        aria-current={active ? "page" : undefined}
        className={`relative grid min-h-[38px] grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-[10px] px-2.5 py-1 transition ${
          active ? "bg-white/10" : "hover:bg-white/[0.06]"
        }`}
      >
        <span
          aria-hidden="true"
          className={`relative z-10 grid size-[26px] place-items-center rounded-full border-[1.5px] text-[13px] font-bold ${
            state === "done"
              ? "border-transparent bg-sidebar"
              : state === "waiting"
                ? "border-check-ring bg-sidebar text-check-ring"
                : active
                  ? "border-sky bg-sky text-sidebar"
                  : "border-white/30 bg-sidebar text-white/70"
          }`}
        >
          {marker}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className={`relative w-fit font-display text-[16px] leading-tight ${active ? "text-white" : "text-white/85"}`}>
            {section.title}
            {active ? <Underline /> : null}
            {label ? <span className="sr-only">, {label}</span> : null}
          </span>
          {part?.count ? <span className="mt-0.5 text-[12.5px] text-white/55">~{formatMinutes(part.minutes)} of your time</span> : null}
        </span>
        <Count
          count={part?.count ?? 0}
          label={part ? `${part.count} ${part.count === 1 ? "step" : "steps"} left, about ${formatMinutes(part.minutes)} of your time` : ""}
        />
      </Link>
    </li>
  );
}
