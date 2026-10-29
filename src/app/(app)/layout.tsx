import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AccountMenu } from "@/components/account-menu";
import { SidebarNav, type SidebarBusiness } from "@/components/sidebar-nav";
import { getMyBusiness, getMyPlan } from "@/lib/data/my-business";
import { displayName, formatLaunchDate } from "@/lib/intake/answers";
import { remainingWork } from "@/lib/rules/progress";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-24 sm:px-6 md:grid md:grid-cols-[288px_minmax(0,1fr)] md:items-start md:gap-7 md:pt-5">
      {/* Fallback keeps the menu prerendered if a route ever has unknown params */}
      <Suspense fallback={<SidebarNav />}>
        <SidebarWithData />
      </Suspense>
      <main id="main" className="min-w-0 pt-5 md:pt-1">
        {children}
      </main>
    </div>
  );
}

// The counts and business card are extra: if they can't be read, the menu still shows without them
async function SidebarWithData() {
  let plan: Awaited<ReturnType<typeof getMyPlan>> = null;
  let business: Awaited<ReturnType<typeof getMyBusiness>> = null;
  try {
    [plan, business] = await Promise.all([getMyPlan(), getMyBusiness()]);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Sidebar details skipped:", error instanceof Error ? error.name : "unknown error");
  }
  const work = remainingWork(plan?.steps ?? []);
  const profile = business?.profile ?? null;
  const card: SidebarBusiness | null = profile
    ? {
        name: displayName(profile),
        place: [profile.location.city, profile.location.state].filter(Boolean).join(", "),
        launch: profile.launchDate ? `Opens ${formatLaunchDate(profile.launchDate)}` : null,
      }
    : null;
  return (
    <SidebarNav
      badges={work.left.length ? { "/checklist": { count: work.left.length, minutes: work.minutes } } : {}}
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
