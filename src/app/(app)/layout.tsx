import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/logo";
import { SidebarFallback, SidebarNav, type SidebarBusiness } from "@/components/sidebar-nav";
import { displayName, formatLaunchDate } from "@/lib/intake/answers";
import { getMySidebarStatus } from "@/lib/sidebar-status";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-24 sm:px-6 md:grid md:grid-cols-[288px_minmax(0,1fr)] md:items-start md:gap-7 md:pt-3">
      {/* The fallback reads no route, so pages with unknown params still prerender */}
      <Suspense fallback={<SidebarFallback />}>
        <SidebarWithData />
      </Suspense>
      <div className="min-w-0">
        <header className="flex items-center pt-4 md:pt-1">
          <Link href="/" aria-label="SnapStart home">
            <Logo className="w-36 sm:w-40" />
          </Link>
        </header>
        <main id="main" className="pt-4 md:pt-3">
          {children}
        </main>
      </div>
    </div>
  );
}

// The business card is extra: if it can't be read, the menu still shows without it
async function SidebarWithData() {
  let sidebar: Awaited<ReturnType<typeof getMySidebarStatus>> = { business: null, status: null };
  try {
    sidebar = await getMySidebarStatus();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Sidebar details skipped:", error instanceof Error ? error.name : "unknown error");
  }
  const profile = sidebar.business?.profile ?? null;
  const card: SidebarBusiness | null = profile
    ? {
        name: displayName(profile),
        place: [profile.location.city, profile.location.state].filter(Boolean).join(", "),
        launch: profile.launchDate ? `Opens ${formatLaunchDate(profile.launchDate)}` : null,
      }
    : null;
  return (
    <SidebarNav
      status={sidebar.status ?? undefined}
      business={card}
      account={
        // Also the session check: an expired session redirects to log in
        <Suspense fallback={<span className="block h-11" />}>
          <AccountMenu />
        </Suspense>
      }
    />
  );
}
