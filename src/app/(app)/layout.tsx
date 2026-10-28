import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AccountMenu } from "@/components/account-menu";
import { HowItWorks } from "@/components/how-it-works";
import { LogoMark } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { SidebarNav } from "@/components/sidebar-nav";
import { getMyPlan } from "@/lib/data/my-business";
import { remainingWork } from "@/lib/rules/progress";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex min-h-11 items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-xl font-bold tracking-tight">First Sale</span>
          </Link>
          <div className="ml-auto">
            {/* Reads the session, so it streams in after the rest of the page */}
            <Suspense fallback={<span className="block h-11 w-24" />}>
              <AccountMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-4 sm:px-6 md:flex-row md:items-start md:gap-8 md:py-6">
        <aside className="flex min-w-0 flex-col gap-5 md:w-56 md:shrink-0">
          {/* Fallback keeps the menu prerendered if a route ever has unknown params */}
          <Suspense fallback={<NavLinks activeHref={null} />}>
            <SidebarNavWithCounts />
          </Suspense>
          <HowItWorks />
        </aside>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </>
  );
}

// The count is extra: if the plan can't be read, the menu still shows without it
async function SidebarNavWithCounts() {
  let plan: Awaited<ReturnType<typeof getMyPlan>> = null;
  try {
    plan = await getMyPlan();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Sidebar counts skipped:", error instanceof Error ? error.name : "unknown error");
  }
  const work = remainingWork(plan?.steps ?? []);
  return <SidebarNav badges={work.left.length ? { "/checklist": { count: work.left.length, minutes: work.minutes } } : {}} />;
}
