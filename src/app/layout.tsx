import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SECTION_GROUPS, SECTIONS } from "@/lib/sections";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "First Sale", template: "%s · First Sale" },
  description: "Step-by-step help for first-time US business owners, from registration to first sale.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 sm:px-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              First Sale
            </Link>
            <nav aria-label="Sections" className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
              {SECTION_GROUPS.map((group) => (
                <div key={group} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-zinc-500">{group}:</span>
                  {SECTIONS.filter((section) => section.group === group).map((section) => (
                    <Link
                      key={section.href}
                      href={section.href}
                      className="text-zinc-800 underline-offset-4 hover:underline dark:text-zinc-200"
                    >
                      {section.title}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
