"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { type NavBadges, NavLinks } from "./nav-links";

export function SidebarNav({ badges }: { badges?: NavBadges }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // Keeps the current page visible in the phone's scrolling menu row
  useEffect(() => {
    ref.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <div ref={ref}>
      <NavLinks activeHref={pathname} badges={badges} />
    </div>
  );
}
