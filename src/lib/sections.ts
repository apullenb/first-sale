import type { Metadata } from "next";

export type SectionGroup = "Start your business" | "Build your brand" | "Run your business";

export interface Section {
  href: string;
  title: string;
  // Null: shown on its own under Today
  group: SectionGroup | null;
  // Position in its section's steps; null for the rest
  step: number | null;
  // A page inside another section: kept out of the menu, which highlights that section instead
  under?: string;
  // The section's own overview page: its heading in the menu links here
  overview?: boolean;
  milestone: number;
  summary: string;
}

export const HOME = { href: "/", title: "Today" } as const;

export const SECTIONS: Section[] = [
  {
    href: "/insights",
    title: "Business insights",
    group: null,
    step: null,
    milestone: 14,
    summary: "Encouraging feedback on your business idea: what’s strong, what to keep an eye on, tips for success and creative ideas.",
  },
  {
    href: "/documents",
    title: "Documents",
    group: null,
    step: null,
    milestone: 8,
    summary: "Forms you’re working on, with help understanding and filling them in, plus your business plan and other documents SnapStart prepared.",
  },
  {
    href: "/business",
    title: "Your business",
    group: "Start your business",
    step: 1,
    milestone: 2,
    summary: "Questions about where you are, who owns it, what you sell, how you sell it, and your budget.",
  },
  {
    href: "/contact",
    title: "Business email and phone",
    group: "Start your business",
    step: null,
    // Listed in the menu as a step only once the owner puts it in their plan
    under: "/business",
    milestone: 2,
    summary: "Add the business email and phone you have, or follow Google’s own steps to set them up.",
  },
  {
    href: "/start",
    title: "Start your business",
    group: "Start your business",
    step: null,
    overview: true,
    milestone: 4,
    summary: "Every step to start your business in one list, in order: what’s done, what’s next, what waits on something else, and what it costs.",
  },
  {
    href: "/structure",
    title: "Business structure",
    group: "Start your business",
    step: 2,
    milestone: 4,
    summary:
      "Sole proprietorship, partnership, LLC, and DBA compared for your situation, with a suggested path, its reasons, and when to talk to a professional.",
  },
  {
    href: "/requirements",
    title: "What applies to you",
    group: "Start your business",
    step: 3,
    milestone: 3,
    summary:
      "SnapStart checks official government sites for the rules that fit your business, then asks a few quick questions about the ones that depend on you.",
  },
  {
    href: "/brand",
    title: "Build your brand",
    group: "Build your brand",
    step: 1,
    milestone: 12,
    summary: "Pick the words that fit how your business should feel, your colors, and what to avoid, then approve a short description of your brand. Add brand pictures you already have.",
  },
  {
    href: "/logo",
    title: "Create your logo",
    group: "Build your brand",
    step: 2,
    milestone: 12,
    summary: "Logo ideas drawn from your brand and the kind of logo you want, or the logo you already have, plus its stacked, icon and one-color versions.",
  },
  {
    href: "/website",
    title: "Create your website",
    group: "Build your brand",
    step: 3,
    milestone: 13,
    summary: "Learn the pieces of a website, compare four packages and what each costs, then build yours with SnapStart or connect the site you already have.",
  },
  {
    href: "/products",
    title: "Add your products",
    group: "Build your brand",
    step: 4,
    milestone: 5,
    summary: "What you sell, with prices and photos, ready for your website and your posts.",
  },
  {
    href: "/photos",
    title: "Product photos",
    group: "Build your brand",
    step: null,
    under: "/products",
    milestone: 5,
    summary: "Turn an ordinary photo of what you sell into a polished store photo. The product stays exactly as it is, and you approve every photo.",
  },
  {
    href: "/marketing",
    title: "Create your marketing plan",
    group: "Build your brand",
    step: 5,
    milestone: 5,
    summary: "A few questions about where you want to show up and what you already know, then a marketing plan made for your business and steps to carry it out.",
  },
  {
    href: "/social",
    title: "Set up social media",
    group: "Build your brand",
    step: 6,
    milestone: 15,
    summary: "Set up the accounts in your marketing plan, with a name, bio, profile picture and cover ready for each. You sign up; SnapStart never posts for you.",
  },
  {
    href: "/brand-library",
    title: "Your Brand Library",
    group: "Build your brand",
    step: null,
    milestone: 16,
    summary: "Your logos, brand images, product photos and other pictures, kept together and sorted.",
  },
  {
    href: "/run",
    title: "Run your business",
    group: "Run your business",
    step: null,
    overview: true,
    milestone: 6,
    summary: "Choose help with daily work, set your preferences, and try a workflow before connecting your tools.",
  },
  {
    href: "/email",
    title: "Connect your email",
    group: "Run your business",
    step: null,
    milestone: 6,
    summary: "Set up help with customer messages and reply drafts, with every reply waiting for your review.",
  },
  {
    href: "/orders",
    title: "Orders & requests",
    group: "Run your business",
    step: null,
    milestone: 6,
    summary: "Set up tracking for orders and customer requests, with follow-up reminders and your review at every step.",
  },
];

export const SECTION_GROUPS: SectionGroup[] = ["Start your business", "Build your brand", "Run your business"];

// Sections whose heading links to an overview page
export function overviewOf(group: SectionGroup): string | null {
  return SECTIONS.find((section) => section.group === group && section.overview)?.href ?? null;
}

export function getSection(href: string): Section {
  const section = SECTIONS.find((candidate) => candidate.href === href);
  if (!section) throw new Error(`No section for ${href}`);
  return section;
}

export function sectionMetadata(href: string): Metadata {
  const section = getSection(href);
  return { title: section.title, description: section.summary };
}
