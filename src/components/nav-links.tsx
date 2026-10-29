import Link from "next/link";
import { formatMinutes } from "@/lib/rules/progress";
import { HOME, SECTION_GROUPS, SECTIONS } from "@/lib/sections";

// Steps left on a section, shown like an alert beside it, with the owner's time for them
export type NavBadges = Partial<Record<string, { count: number; minutes: number }>>;

// Sub-pages like /business/new highlight their section
function isActive(href: string, activeHref: string | null): boolean {
  if (!activeHref) return false;
  return activeHref === href || (href !== "/" && activeHref.startsWith(`${href}/`));
}

// One scrollable row on phones, a grouped column from md up
export function NavLinks({ activeHref, badges = {} }: { activeHref: string | null; badges?: NavBadges }) {
  return (
    <nav
      aria-label="Sections"
      className="relative -mx-4 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6 md:mx-0 md:overflow-visible md:px-0 md:py-0"
    >
      <div className="flex w-max gap-1 md:w-auto md:flex-col md:gap-4">
        <NavItem href={HOME.href} title={HOME.title} active={isActive(HOME.href, activeHref)} />
        {SECTION_GROUPS.map((group) => (
          <div key={group} className="flex gap-1 md:flex-col md:gap-0.5">
            <p className="sr-only md:not-sr-only md:mb-1 md:ml-3 md:text-xs md:font-bold md:uppercase md:tracking-wider md:text-muted">
              {group}
            </p>
            {SECTIONS.filter((section) => section.group === group).map((section) => (
              <NavItem
                key={section.href}
                href={section.href}
                title={section.title}
                active={isActive(section.href, activeHref)}
                badge={badges[section.href]}
              />
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

function NavItem({ href, title, active, badge }: { href: string; title: string; active: boolean; badge?: { count: number; minutes: number } }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 py-2 text-[15px] ${
        active ? "bg-accent-tint font-bold text-accent-ink" : "font-medium hover:bg-rule-tint"
      }`}
    >
      {title}
      {badge ? (
        <span className="ml-2 flex items-center gap-1.5 md:ml-auto">
          <span aria-hidden="true" className="text-xs font-semibold text-muted">
            {formatMinutes(badge.minutes)}
          </span>
          <span aria-hidden="true" className="min-w-6 rounded-full bg-check px-1.5 py-0.5 text-center text-xs font-bold text-white">
            {badge.count}
          </span>
          <span className="sr-only">
            : {badge.count} {badge.count === 1 ? "step" : "steps"} left, about {formatMinutes(badge.minutes)} of your time
          </span>
        </span>
      ) : null}
    </Link>
  );
}
