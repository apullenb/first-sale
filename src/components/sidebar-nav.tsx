"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Celebration } from "./celebrate";
import { Logo } from "./logo";
import { NavLinks, type NavStatus } from "./nav-links";
import { TabBar } from "./tab-bar";

export interface SidebarBusiness {
  name: string;
  place: string;
  // "Opens Jan 15, 2027", already worded
  launch: string | null;
}

// Sky outline: the accent is too dark to see on the sidebar
const SIDEBAR_FOCUS = "[&_:focus-visible]:outline-sky";

// A floating navy sidebar on wide screens; tabs along the bottom on phones, with More for the slide-out menu
export function SidebarNav({ status, business, account }: { status?: NavStatus; business?: SidebarBusiness | null; account?: ReactNode }) {
  const pathname = usePathname();
  // Open only on the page it was opened from; forgotten on any move, so Back doesn't reopen it
  const [openOn, setOpenOn] = useState<string | null>(null);
  if (openOn !== null && openOn !== pathname) setOpenOn(null);
  const open = openOn !== null;
  const menuButton = useRef<HTMLButtonElement>(null);
  const scrim = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);

  function close() {
    setOpenOn(null);
    menuButton.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    drawer.current?.querySelector("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenOn(null);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Before the menu, so it's listening when the menu spots a newly done step */}
      <Celebration />
      <TabBar pathname={pathname} status={status} menuOpen={open} onMore={() => (open ? setOpenOn(null) : setOpenOn(pathname))} moreRef={menuButton} />
      {open ? <button ref={scrim} type="button" tabIndex={-1} aria-label="Close the menu" onClick={close} className="fixed inset-0 z-30 bg-navy/40 md:hidden" /> : null}
      <aside
        ref={drawer}
        id="phone-menu"
        // Any link closes it, including one to this page; so does tabbing out
        onClick={(event) => {
          const link = (event.target as Element).closest("a");
          if (!open || !link) return;
          if (link.pathname === window.location.pathname) close();
          else setOpenOn(null);
        }}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (open && next && !event.currentTarget.contains(next) && next !== menuButton.current && next !== scrim.current) setOpenOn(null);
        }}
        className={`fixed top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 z-40 w-[300px] max-w-[85vw] p-3 transition-transform md:visible md:sticky md:top-3 md:bottom-auto md:z-auto md:h-[calc(100vh-1.5rem)] md:w-auto md:max-w-none md:translate-x-0 md:p-0 ${
          open ? "translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <Panel pathname={pathname} status={status} business={business} account={account} />
      </aside>
    </>
  );
}

type PanelProps = { pathname: string | null; status?: NavStatus; business?: SidebarBusiness | null; account?: ReactNode };

function Panel({ pathname, status, business, account }: PanelProps) {
  return (
    // Sized to fit a laptop screen; scrolls only on very short ones
    <div className={`flex h-full flex-col gap-0.5 overflow-y-auto rounded-[18px] bg-sidebar px-3.5 pb-2.5 pt-3 text-white shadow-lift [scrollbar-width:thin] ${SIDEBAR_FOCUS}`}>
      <div className="border-b border-white/10 px-1.5 pb-4 short:pb-2">
        <Link href="/" className="flex min-h-11 w-fit items-center short:min-h-10" title="Your complete small business startup kit">
          <Logo light className="w-36" />
        </Link>
      </div>
      {business ? (
        <Link href="/business" className="mx-0.5 mb-3 mt-4 flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 transition hover:border-white/25 short:mt-2.5 short:mb-1.5 short:py-1.5">
          <span className="font-display text-[17px] leading-tight text-white">{business.name}</span>
          <span className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-white/60">
            {business.place ? <span>{business.place}</span> : null}
            {business.place && business.launch ? <span aria-hidden="true">·</span> : null}
            {business.launch ? <span className="font-semibold text-sky">{business.launch}</span> : null}
          </span>
        </Link>
      ) : null}
      <NavLinks activeHref={pathname} status={status} />
      {account ? <div className="mt-auto border-t border-white/10 px-1 pt-2">{account}</div> : null}
    </div>
  );
}

// Shown while the menu's data streams in; reads no route, so it can render outside Suspense
export function SidebarFallback() {
  return (
    <>
      <TabBar pathname={null} menuOpen={false} />
      <aside className="hidden md:sticky md:top-3 md:block md:h-[calc(100vh-1.5rem)]">
        <Panel pathname={null} />
      </aside>
    </>
  );
}
