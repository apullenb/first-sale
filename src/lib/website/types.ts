// Stored shapes for the website section. Plain types, so the schema can import them.

export const PLATFORMS = ["square", "wix", "shopify"] as const;
export type PlatformId = (typeof PLATFORMS)[number];

export interface DomainCheck {
  domain: string;
  // "available" only means no one had registered it when checked
  status: "available" | "taken" | "unknown";
  checkedAt: string;
}

export interface Offering {
  name: string;
  description: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

// The words for the owner's site, drafted by AI and edited by the owner
export interface WebsiteCopy {
  headline: string;
  subheadline: string;
  intro: string;
  about: string;
  offerings: Offering[];
  howToBuy: string;
  contact: string;
  faq: FaqEntry[];
  seoTitle: string;
  seoDescription: string;
}

export interface WebsiteContent extends WebsiteCopy {
  // Numbers in the draft the owner didn't give, for them to check
  flags: string[];
  platform: PlatformId;
  generatedAt: string;
  simulated: boolean;
}
