import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { HowItWorks } from "@/components/how-it-works";
import { NavLinks } from "@/components/nav-links";
import { SidebarNav } from "@/components/sidebar-nav";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  // Optical size axis gives large headings the tighter display cut
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: { default: "First Sale", template: "%s · First Sale" },
  description: "Step-by-step help for first-time US business owners, from registration to first sale.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2.5 focus:ring-2 focus:ring-ai"
        >
          Skip to content
        </a>
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-2.5 sm:px-6">
            <Link href="/" className="flex min-h-11 items-center gap-2.5">
              <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg bg-accent text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 10h18" />
                  <path d="M4.5 4h15L21 10H3z" />
                  <path d="M5 10v10h14V10" />
                  <path d="M10 20v-5h4v5" />
                </svg>
              </span>
              <span className="font-display text-xl font-bold tracking-tight">First Sale</span>
            </Link>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-4 sm:px-6 md:flex-row md:items-start md:gap-8 md:py-6">
          <aside className="flex min-w-0 flex-col gap-5 md:w-56 md:shrink-0">
            {/* Fallback keeps the menu prerendered if a route ever has unknown params */}
            <Suspense fallback={<NavLinks activeHref={null} />}>
              <SidebarNav />
            </Suspense>
            <HowItWorks />
          </aside>
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
