import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
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
        {children}
      </body>
    </html>
  );
}
