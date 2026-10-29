import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { formatMinutes } from "@/lib/rules/progress";
import { HOME, SECTION_GROUPS, SECTIONS, type Section } from "@/lib/sections";

// Steps left on a section, shown like an alert beside it, with the owner's time for them
export type NavBadges = Partial<Record<string, { count: number; minutes: number }>>;

const ICONS: Record<string, IconName> = {
  "/": "home",
  "/business": "store",
  "/insights": "lightbulb",
  "/requirements": "clipboard",
  "/structure": "scale",
  "/checklist": "checklist",
  "/documents": "book",
  "/marketing": "megaphone",
  "/brand": "palette",
  "/website": "globe",
  "/photos": "camera",
  "/products": "tag",
  "/orders": "receipt",
  "/planning-for-help": "users",
};

const GROUP_ICONS: Record<string, IconName> = {
  "Start your business": "flag",
  "Marketing and branding": "megaphone",
  "Run your business": "building",
};

// Sub-pages like /business/new highlight their section
function isActive(href: string, activeHref: string | null): boolean {
  if (!activeHref) return false;
  return activeHref === href || (href !== "/" && activeHref.startsWith(`${href}/`));
}

export function NavLinks({ activeHref, badges = {} }: { activeHref: string | null; badges?: NavBadges }) {
  const total = Object.values(badges).reduce((sum, badge) => sum + (badge?.count ?? 0), 0);
  return (
    <nav aria-label="Sections" className="flex flex-col gap-0.5">
      <NavItem href={HOME.href} title={HOME.title} icon="home" active={isActive(HOME.href, activeHref)} count={total} />
      {SECTION_GROUPS.map((group) => {
        const sections = SECTIONS.filter((section) => section.group === group);
        const parts = sections.filter((section) => section.step !== null);
        const others = sections.filter((section) => section.step === null);
        return (
          <div key={group} className="flex flex-col gap-0.5">
            <p className="flex items-center gap-2 px-2.5 pb-1.5 pt-4 text-[12.5px] font-bold uppercase tracking-[0.09em] text-white/55">
              <Icon name={GROUP_ICONS[group] ?? "flag"} size="xs" className="text-sky" />
              {group}
            </p>
            {parts.length ? (
              <ol className="relative flex flex-col gap-0.5 before:absolute before:bottom-6 before:left-[25px] before:top-6 before:w-[1.5px] before:bg-white/15">
                {parts.map((section) => (
                  <PartItem key={section.href} section={section} active={isActive(section.href, activeHref)} badge={badges[section.href]} />
                ))}
              </ol>
            ) : null}
            {others.map((section) => (
              <NavItem
                key={section.href}
                href={section.href}
                title={section.title}
                icon={ICONS[section.href] ?? "file"}
                active={isActive(section.href, activeHref)}
                count={badges[section.href]?.count ?? 0}
              />
            ))}
          </div>
        );
      })}
    </nav>
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

function NavItem({ href, title, icon, active, count }: { href: string; title: string; icon: IconName; active: boolean; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-[46px] items-center gap-3 rounded-[10px] px-2.5 py-2 text-[15.5px] font-semibold transition ${
        active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      <Icon name={icon} className={active ? "text-sky" : "text-white/50"} />
      <span className="relative">
        {title}
        {active ? <Underline /> : null}
      </span>
      <Count count={count} label={`${count} ${count === 1 ? "step" : "steps"} left`} />
    </Link>
  );
}

function PartItem({ section, active, badge }: { section: Section; active: boolean; badge?: { count: number; minutes: number } }) {
  return (
    <li>
      <Link
        href={section.href}
        aria-current={active ? "page" : undefined}
        className={`relative grid min-h-[50px] grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-[10px] px-2.5 py-2 transition ${
          active ? "bg-white/10" : "hover:bg-white/[0.06]"
        }`}
      >
        <span
          aria-hidden="true"
          className={`relative z-10 grid size-7 place-items-center rounded-full border-[1.5px] text-sm font-bold ${
            active ? "border-sky bg-sky text-sidebar" : "border-white/30 bg-sidebar text-white/70"
          }`}
        >
          {section.step}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className={`relative w-fit font-display text-[16px] leading-tight ${active ? "text-white" : "text-white/85"}`}>
            {section.title}
            {active ? <Underline /> : null}
          </span>
          {badge ? <span className="mt-1 text-[13px] text-white/55">~{formatMinutes(badge.minutes)} of your time</span> : null}
        </span>
        <Count count={badge?.count ?? 0} label={badge ? `${badge.count} ${badge.count === 1 ? "step" : "steps"} left, about ${formatMinutes(badge.minutes)} of your time` : ""} />
      </Link>
    </li>
  );
}
