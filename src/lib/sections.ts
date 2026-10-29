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
    summary: "Forms you’re working on, with help understanding and filling them in, plus your business plan and other documents First Sale prepared.",
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
    href: "/requirements",
    title: "Requirements",
    group: "Start your business",
    step: 2,
    milestone: 3,
    summary:
      "Registrations, licenses, and permits that apply to you, each linked to an official source or marked for you to verify.",
  },
  {
    href: "/structure",
    title: "Structure and path",
    group: "Start your business",
    step: 3,
    milestone: 4,
    summary:
      "Sole proprietorship, partnership, LLC, and DBA compared for your situation, with a suggested path, its reasons, and when to talk to a professional.",
  },
  {
    href: "/checklist",
    title: "Startup plan",
    group: "Start your business",
    step: 4,
    milestone: 4,
    summary: "Your steps in order, with who handles each one, what to gather, checked fees, and what’s still uncertain. Track what’s done.",
  },
  {
    href: "/logo",
    title: "Create your logo",
    group: "Build your brand",
    step: 1,
    milestone: 12,
    summary: "Pick the words that fit how your business should feel, get logo ideas drawn from them, and choose one. Or upload the logo you already have.",
  },
  {
    href: "/brand",
    title: "Build your brand",
    group: "Build your brand",
    step: 2,
    milestone: 12,
    summary: "Your logo’s stacked, profile and one-color versions, your colors and lettering, and matching images for your social pages and website.",
  },
  {
    href: "/website",
    title: "Create your website",
    group: "Build your brand",
    step: 3,
    milestone: 13,
    summary: "Compare three ways to build your website and what they cost, get a recommendation for your business, then build it step by step.",
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
    summary: "Set up the accounts in your marketing plan, with a name, bio, profile picture and cover ready for each. You sign up; First Sale never posts for you.",
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
    href: "/orders",
    title: "Orders",
    group: "Run your business",
    step: null,
    milestone: 6,
    summary: "Orders update stock by fixed rules. AI drafts the customer reply and flags anything missing.",
  },
  {
    href: "/planning-for-help",
    title: "Planning for help",
    group: "Run your business",
    step: null,
    milestone: 7,
    summary: "What hiring help would cost each month, the sales needed to cover it, and a draft role description.",
  },
];

export const SECTION_GROUPS: SectionGroup[] = ["Start your business", "Build your brand", "Run your business"];

export function getSection(href: string): Section {
  const section = SECTIONS.find((candidate) => candidate.href === href);
  if (!section) throw new Error(`No section for ${href}`);
  return section;
}

export function sectionMetadata(href: string): Metadata {
  const section = getSection(href);
  return { title: section.title, description: section.summary };
}
