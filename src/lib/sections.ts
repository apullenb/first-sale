import type { Metadata } from "next";

export type SectionGroup = "Start your business" | "Run your business";

export interface Section {
  href: string;
  title: string;
  group: SectionGroup;
  // Position in the formation journey; run-your-business sections have none
  step: number | null;
  milestone: number;
  summary: string;
}

export const HOME = { href: "/", title: "Today" } as const;

export const SECTIONS: Section[] = [
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
    href: "/documents",
    title: "Documents",
    group: "Start your business",
    step: 5,
    milestone: 8,
    summary: "Forms you’re working on, with help understanding and filling them in, plus your business plan and other documents First Sale prepared.",
  },
  {
    href: "/photos",
    title: "Product photos",
    group: "Run your business",
    step: null,
    milestone: 5,
    summary: "Turn an ordinary photo of what you sell into a polished store photo. The product stays exactly as it is, and you approve every photo.",
  },
  {
    href: "/products",
    title: "Products and marketing",
    group: "Run your business",
    step: null,
    milestone: 5,
    summary: "Add a product and get a draft listing and social post. Nothing goes out until you approve it.",
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
