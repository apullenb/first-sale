import type { Metadata } from "next";
import { Caveat, Source_Sans_3, Young_Serif } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

// Headings and the business's own name
const youngSerif = Young_Serif({
  variable: "--font-young-serif",
  subsets: ["latin"],
  weight: "400",
});

// A couple of handwritten notes only
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: "600",
});

export const metadata: Metadata = {
  title: { default: "SnapStart Business Assembly Kit", template: "%s · SnapStart" },
  applicationName: "SnapStart Business Assembly Kit",
  description: "Step-by-step help for first-time US business owners, from registration to first sale.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${youngSerif.variable} ${caveat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2.5 focus:ring-2 focus:ring-accent"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
