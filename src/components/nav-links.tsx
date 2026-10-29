"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { formatMinutes } from "@/lib/rules/progress";
import { type PartStatus, sectionState, type SidebarStatus, type StartStep, startSteps, stepsLeft } from "@/lib/rules/section-status";
import { HOME, overviewOf, SECTION_GROUPS, SECTIONS, type SectionGroup } from "@/lib/sections";
import { celebrate, onCelebrate } from "./celebrate";

export interface NavStatus {
  parts: SidebarStatus;
  // The business, so done steps remembered in this browser stay with it; null before there is one
  scope: string | null;
  // Start your business, one step per paperwork group once there are any
  start?: StartStep[];
  // Pages inside a menu step, like a group's other parts or its task pages, and the step they highlight
  groupOf?: Record<string, string>;
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

interface NavStep extends StartStep {
  number: number;
}

// Start your business comes from the owner's paperwork; the other sections' steps are fixed
function stepsOf(group: SectionGroup, status?: NavStatus): NavStep[] {
  const steps =
    group === "Start your business"
      ? (status?.start ?? startSteps([]))
      : SECTIONS.filter((section) => section.group === group && section.step !== null).map((section) => ({ href: section.href, title: section.title, later: false }));
  return steps.map((step, index) => ({ ...step, number: index + 1 }));
}

// Steps that hold a section open: everything but what comes after the first sale
const countedHrefs = (group: SectionGroup, status?: NavStatus) => stepsOf(group, status).filter((step) => !step.later).map((step) => step.href);

// Sub-pages like /business/new highlight their section
function isActive(href: string, activeHref: string | null): boolean {
  if (!activeHref) return false;
  return activeHref === href || (href !== "/" && activeHref.startsWith(`${href}/`));
}

export function NavLinks({ activeHref, status }: { activeHref: string | null; status?: NavStatus }) {
  const parts = status?.parts ?? {};
  const page = SECTIONS.find((section) => isActive(section.href, activeHref)) ?? null;
  // A task's page, or a group's other part, highlights the group's menu step
  const onTask = Boolean(activeHref?.startsWith("/checklist/"));
  const startHrefs = stepsOf("Start your business", status).map((step) => step.href);
  const startStep = activeHref && startHrefs.includes(activeHref) ? activeHref : activeHref ? (status?.groupOf?.[activeHref] ?? null) : null;
  const pageGroup: SectionGroup | null = startStep || onTask ? "Start your business" : (page?.group ?? null);
  const highlighted = startStep ?? page?.under ?? page?.href ?? null;
  // Open where the owner is working: this page's section, or the first with something left
  const working = pageGroup ?? JOURNEY.find((group) => sectionState(parts, countedHrefs(group, status)) === "todo") ?? null;
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

  // Steps left across the journey, as Today counts them; documents to check have their own count
  const total = stepsLeft(parts, JOURNEY.flatMap((group) => stepsOf(group, status).map((step) => step.href)));
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
        const steps = stepsOf(group, status);
        const others = SECTIONS.filter((section) => section.group === group && section.step === null && !section.under && !section.overview);
        const open = isOpen(group);
        const here = pageGroup === group;
        const id = `nav-${group.toLowerCase().replaceAll(" ", "-")}`;
        const counted = countedHrefs(group, status);
        const overview = overviewOf(group);
        const mark = counted.length ? (
          <SectionMark state={status ? sectionState(parts, counted) : null} done={counted.filter((href) => parts[href]?.state === "done").length} of={counted.length} />
        ) : null;
        const label = (
          <>
            <Icon name={GROUP_ICONS[group]} className={here ? "text-sky" : "text-white/50"} />
            <span className="flex-1 text-balance">{group}</span>
          </>
        );
        const chevron = <Icon name="chevron" size="sm" className={`text-white/40 transition-transform duration-300 motion-reduce:transition-none ${open ? "rotate-90" : ""}`} />;
        const headingStyle = `flex min-h-9 items-center rounded-[10px] px-2.5 py-1 text-left text-[15.5px] font-semibold transition hover:bg-white/[0.06] short:min-h-8 short:py-0.5 ${
          here ? "text-white" : "text-white/80 hover:text-white"
        }`;
        return (
          <div key={group} className="mt-1 flex flex-col border-t border-white/10 pt-1 short:mt-0.5 short:pt-0.5">
            {overview ? (
              // The heading opens the section's overview; the chevron folds it
              <div className="flex items-center gap-0.5">
                <Link
                  href={overview}
                  aria-current={activeHref === overview ? "page" : undefined}
                  className={`${headingStyle} min-w-0 flex-1 gap-2 ${activeHref === overview ? "bg-white/10" : ""}`}
                >
                  {label}
                  {mark}
                </Link>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={id}
                  onClick={() => toggle(group)}
                  className="grid h-9 w-7 shrink-0 place-items-center rounded-[10px] transition hover:bg-white/[0.06] short:h-8"
                >
                  {chevron}
                  <span className="sr-only">{open ? `Hide the steps in ${group}` : `Show the steps in ${group}`}</span>
                </button>
              </div>
            ) : (
              <button type="button" aria-expanded={open} aria-controls={id} onClick={() => toggle(group)} className={`${headingStyle} gap-3`}>
                {label}
                {mark}
                {chevron}
              </button>
            )}
            <div
              id={id}
              inert={!open}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="-mx-1 min-h-0 overflow-hidden px-1">
                {/* Steps hang from the section's icon on a thin line */}
                <div className="ml-[19px] flex flex-col gap-0.5 border-l border-white/15 py-1 pl-2">
                  {steps.length ? (
                    <ol className="flex flex-col gap-0.5">
                      {steps.map((step) => (
                        <PartItem key={step.href} step={step} active={highlighted === step.href} part={parts[step.href]} fresh={fresh.includes(step.href)} />
                      ))}
                    </ol>
                  ) : null}
                  {others.map((section) => (
                    <SubItem key={section.href} href={section.href} title={section.title} icon={ICONS[section.href] ?? "file"} active={highlighted === section.href} />
                  ))}
                </div>
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
  const steps = JOURNEY.flatMap((group) => stepsOf(group, status));
  const done = status
    ? steps
        .filter((step) => status.parts[step.href]?.state === "done")
        .map((step) => step.href)
        .sort()
        .join(" ")
    : null;
  // Kept as text, so the effect runs only when they change
  const titles = JSON.stringify(steps.map((step) => [step.href, step.title]));
  const sections = JSON.stringify(JOURNEY.map((group) => countedHrefs(group, status)));
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
    const groups = JSON.parse(sections) as string[][];
    const finished = JOURNEY.find((_, index) => groups[index].some((href) => added.includes(href)) && groups[index].every((href) => now.includes(href)));
    const last = (JSON.parse(titles) as [string, string][]).filter(([href]) => added.includes(href)).at(-1);
    celebrate(finished ?? last?.[1] ?? "Step", added);
  }, [scope, done, titles, sections]);
}

function SectionMark({ state, done, of }: { state: "done" | "waiting" | "todo" | null; done: number; of: number }) {
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
      className={`relative flex min-h-9 items-center gap-3 rounded-[10px] px-2.5 py-1 text-[15.5px] font-semibold transition short:min-h-8 short:py-0.5 ${
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

function SubItem({ href, title, icon, active }: { href: string; title: string; icon: IconName; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative grid min-h-9 grid-cols-[22px_minmax(0,1fr)] items-center gap-x-2.5 rounded-lg px-2 py-1 text-[14.5px] font-medium transition ${
        active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <span className="grid place-items-center">
        <Icon name={icon} size="sm" className={active ? "text-sky" : "text-white/45"} />
      </span>
      <span className="relative w-fit">
        {title}
        {active ? <Underline /> : null}
      </span>
    </Link>
  );
}

const LIST = new Intl.ListFormat("en-US", { type: "conjunction" });

function PartItem({ step, active, part, fresh }: { step: NavStep; active: boolean; part?: PartStatus; fresh: boolean }) {
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
      <span className="grid size-[22px] place-items-center rounded-full border-[1.5px] border-check-ring text-check-ring">
        <Icon name="clock" size="xs" strokeWidth={2.2} />
      </span>
    ) : state === "locked" ? (
      <span className={`grid size-[22px] place-items-center rounded-full border-[1.5px] border-dashed ${active ? "border-sky text-sky" : "border-white/30 text-white/55"}`}>
        <Icon name="lock" size="xs" strokeWidth={2.2} />
      </span>
    ) : (
      <span
        className={`grid size-[22px] place-items-center rounded-full border-[1.5px] text-[12px] font-bold ${
          active ? "border-sky bg-sky text-sidebar" : "border-white/30 text-white/70"
        }`}
      >
        {step.number}
      </span>
    );
  const label =
    state === "done"
      ? "done"
      : state === "waiting"
        ? "waiting to hear back"
        : state === "locked"
          ? `locked${part?.waitsOn?.length ? `, waits on ${LIST.format(part.waitsOn)}` : ""}`
          : null;
  const unit = part?.unit ?? "step";
  const time = part && state !== "done" && state !== "waiting" && part.minutes ? formatMinutes(part.minutes) : null;
  const sub = [step.part, step.later && time ? "After your first sale" : null, time ? `~${time}` : null].filter(Boolean).join(" · ");
  return (
    <li>
      <Link
        href={step.href}
        aria-current={active ? "page" : undefined}
        className={`relative grid min-h-9 grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-lg px-2 py-[3px] transition short:min-h-8 short:py-px ${
          active ? "bg-white/10" : "hover:bg-white/[0.06]"
        }`}
      >
        <span aria-hidden="true" className="grid place-items-center">
          {marker}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className={`relative w-fit text-[14.5px] font-medium leading-snug ${active ? "text-white" : state === "locked" ? "text-white/60" : "text-white/80"}`}>
            {step.title}
            {active ? <Underline /> : null}
            {step.part ? <span className="sr-only">, {step.part.toLowerCase()}</span> : null}
            {label ? <span className="sr-only">, {label}</span> : null}
            {time ? <span className="sr-only">, about {time} of your time{step.later ? " after your first sale" : ""}</span> : null}
          </span>
          {sub ? (
            <span aria-hidden="true" className={`text-[12.5px] leading-tight text-white/50 ${active ? "mt-1" : ""}`}>
              {sub}
            </span>
          ) : null}
        </span>
        <Count
          count={part?.count ?? 0}
          label={part ? `${part.count} ${part.count === 1 ? unit : `${unit}s`} ${unit === "question" ? "to answer" : unit === "decision" ? "to make" : "left"}` : ""}
        />
      </Link>
    </li>
  );
}
