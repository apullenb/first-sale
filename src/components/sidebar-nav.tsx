"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Icon } from "./icons";
import { LogoMark } from "./logo";
import { type NavBadges, NavLinks } from "./nav-links";

export interface SidebarBusiness {
  name: string;
  place: string;
  // "Opens Jan 15, 2027", already worded
  launch: string | null;
}

// A floating navy sidebar on wide screens; a top bar with a slide-out menu on phones
export function SidebarNav({ badges, business, account }: { badges?: NavBadges; business?: SidebarBusiness | null; account?: ReactNode }) {
  const pathname = usePathname();
  // Open only on the page it was opened from, so moving to a new page closes the phone menu
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);

  const panel = (
    <div className="flex max-h-full flex-col gap-1 overflow-y-auto rounded-[18px] bg-sidebar px-3.5 pb-4 pt-5 text-white shadow-lift [scrollbar-width:thin]">
      <div className="flex flex-col gap-2 border-b border-white/10 px-1.5 pb-4">
        <Link href="/" className="flex min-h-11 w-fit items-center gap-2.5">
          <LogoMark className="bg-accent text-white" />
          <span className="text-[22px] font-extrabold tracking-[-0.03em]">
            First <span className="text-sky">Sale</span>
          </span>
        </Link>
        <p className="text-[13.5px] leading-snug text-white/55">Step by step from your idea to your first sale</p>
      </div>
      {business ? (
        <Link href="/business" className="mx-0.5 mb-1 mt-3 flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-3 transition hover:border-white/25">
          <span className="font-display text-[18px] leading-tight text-white">{business.name}</span>
          {business.place ? <span className="text-sm text-white/60">{business.place}</span> : null}
          {business.launch ? (
            <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-sky">
              <Icon name="calendar" size="sm" />
              {business.launch}
            </span>
          ) : null}
        </Link>
      ) : null}
      <NavLinks activeHref={pathname} badges={badges} />
      {account ? <div className="mt-4 border-t border-white/10 px-1 pt-3">{account}</div> : null}
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-white/10 bg-sidebar px-4 py-2 text-white sm:-mx-6 sm:px-6 md:hidden">
        <Link href="/" className="flex min-h-11 items-center gap-2">
          <LogoMark className="bg-accent text-white" />
          <span className="text-lg font-extrabold tracking-[-0.03em]">
            First <span className="text-sky">Sale</span>
          </span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="phone-menu"
          onClick={() => setOpen(!open)}
          className="ml-auto flex min-h-11 items-center gap-2 rounded-[10px] px-3 font-semibold hover:bg-white/10"
        >
          <Icon name={open ? "close" : "menu"} />
          Menu
          {badges && Object.values(badges).some((badge) => badge?.count) ? <span aria-hidden="true" className="size-2 rounded-full bg-alert" /> : null}
        </button>
      </div>
      {open ? <button type="button" aria-label="Close the menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-navy/40 md:hidden" /> : null}
      <aside
        id="phone-menu"
        className={`fixed inset-y-0 left-0 z-40 w-[300px] max-w-[85vw] p-3 transition-transform md:visible md:sticky md:top-5 md:z-auto md:h-[calc(100vh-2.5rem)] md:w-auto md:max-w-none md:translate-x-0 md:p-0 ${
          open ? "translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        {panel}
      </aside>
    </>
  );
}
