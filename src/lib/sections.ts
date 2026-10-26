import type { Metadata } from "next";

export type SectionGroup = "Start your business" | "Run your business";

export interface Section {
  href: string;
  title: string;
  group: SectionGroup;
  milestone: number;
  summary: string;
}

export const SECTIONS: Section[] = [
  {
    href: "/business",
    title: "Your business",
    group: "Start your business",
    milestone: 1,
    summary: "Questions about where you are, who owns it, what you sell, how you sell it, and your budget.",
  },
  {
    href: "/requirements",
    title: "Requirements",
    group: "Start your business",
    milestone: 2,
    summary:
      "Registrations, licenses, and permits that apply to you, each linked to an official source or marked for you to verify.",
  },
  {
    href: "/options",
    title: "Business structure",
    group: "Start your business",
    milestone: 3,
    summary: "Sole proprietorship, partnership, LLC, and registered business names (DBAs), compared for your situation.",
  },
  {
    href: "/decision",
    title: "Your path",
    group: "Start your business",
    milestone: 3,
    summary: "A suggested path with its reasoning, tradeoffs, open questions, and when to talk to a professional.",
  },
  {
    href: "/checklist",
    title: "Checklist",
    group: "Start your business",
    milestone: 3,
    summary: "Steps in order, with where to go, what to bring, and fees. Track what's done and keep your confirmations.",
  },
  {
    href: "/products",
    title: "Products & marketing",
    group: "Run your business",
    milestone: 4,
    summary: "Add a product and get a draft listing and social post. Nothing goes out until you approve it.",
  },
  {
    href: "/orders",
    title: "Orders",
    group: "Run your business",
    milestone: 5,
    summary: "Orders update stock by fixed rules. AI drafts the customer reply and flags anything missing.",
  },
  {
    href: "/planning-for-help",
    title: "Planning for help",
    group: "Run your business",
    milestone: 6,
    summary: "What hiring help would cost each month, the sales needed to cover it, and a draft role description.",
  },
];

export const SECTION_GROUPS: SectionGroup[] = ["Start your business", "Run your business"];

export function getSection(href: string): Section {
  const section = SECTIONS.find((candidate) => candidate.href === href);
  if (!section) throw new Error(`No section for ${href}`);
  return section;
}

export function sectionMetadata(href: string): Metadata {
  const section = getSection(href);
  return { title: section.title, description: section.summary };
}
