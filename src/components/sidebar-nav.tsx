"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Celebration } from "./celebrate";
import { Icon } from "./icons";
import { LogoMark } from "./logo";
import { NavLinks, type NavStatus } from "./nav-links";

export interface SidebarBusiness {
  name: string;
  place: string;
  // "Opens Jan 15, 2027", already worded
  launch: string | null;
}

// Sky outline: the accent is too dark to see on the sidebar
const SIDEBAR_FOCUS = "[&_:focus-visible]:outline-sky";
const MENU_BUTTON = "ml-auto flex min-h-11 items-center gap-2 rounded-[10px] px-3 font-semibold hover:bg-white/10 disabled:opacity-60 disabled:hover:bg-transparent";

// A floating navy sidebar on wide screens; a top bar with a slide-out menu on phones
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
      <PhoneBar>
        <button ref={menuButton} type="button" aria-expanded={open} aria-controls="phone-menu" onClick={() => (open ? setOpenOn(null) : setOpenOn(pathname))} className={MENU_BUTTON}>
          <Icon name={open ? "close" : "menu"} />
          Menu
          {status && Object.values(status.parts).some((part) => part.count) ? <span aria-hidden="true" className="size-2 rounded-full bg-alert" /> : null}
        </button>
      </PhoneBar>
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
        className={`fixed inset-y-0 left-0 z-40 w-[300px] max-w-[85vw] p-3 transition-transform md:visible md:sticky md:top-3 md:z-auto md:h-[calc(100vh-1.5rem)] md:w-auto md:max-w-none md:translate-x-0 md:p-0 ${
          open ? "translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <Panel pathname={pathname} status={status} business={business} account={account} />
      </aside>
    </>
  );
}

function PhoneBar({ children }: { children: ReactNode }) {
  return (
    <div className={`sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-white/10 bg-sidebar px-4 py-2 text-white sm:-mx-6 sm:px-6 md:hidden ${SIDEBAR_FOCUS}`}>
      <Link href="/" className="flex min-h-11 items-center gap-2">
        <LogoMark className="bg-accent text-white" />
        <span className="text-lg font-extrabold tracking-[-0.03em]">
          First <span className="text-sky">Sale</span>
        </span>
      </Link>
      {children}
    </div>
  );
}

type PanelProps = { pathname: string | null; status?: NavStatus; business?: SidebarBusiness | null; account?: ReactNode };

function Panel({ pathname, status, business, account }: PanelProps) {
  return (
    // Sized to fit a laptop screen; scrolls only on very short ones
    <div className={`flex h-full flex-col gap-0.5 overflow-y-auto rounded-[18px] bg-sidebar px-3.5 pb-2.5 pt-3 text-white shadow-lift [scrollbar-width:thin] ${SIDEBAR_FOCUS}`}>
      <div className="border-b border-white/10 px-1.5 pb-2.5 short:pb-1">
        <Link href="/" className="flex min-h-11 w-fit items-center gap-2.5 short:min-h-10" title="Step by step from your idea to your first sale">
          <LogoMark className="bg-accent text-white" />
          <span className="text-[22px] font-extrabold tracking-[-0.03em]">
            First <span className="text-sky">Sale</span>
          </span>
        </Link>
      </div>
      {business ? (
        <Link href="/business" className="mx-0.5 mb-1 mt-2.5 flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 transition hover:border-white/25 short:mt-1.5 short:py-1.5">
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
      <PhoneBar>
        <button type="button" disabled className={MENU_BUTTON}>
          <Icon name="menu" />
          Menu
        </button>
      </PhoneBar>
      <aside className="hidden md:sticky md:top-3 md:block md:h-[calc(100vh-1.5rem)]">
        <Panel pathname={null} />
      </aside>
    </>
  );
}
