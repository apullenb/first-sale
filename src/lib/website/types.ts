// Stored shapes for the website section. Plain types, so the schema can import them.

// "first_sale": SnapStart builds and hosts the site from the owner's choices (a demo for now)
export const PLATFORMS = ["first_sale", "square", "wix", "shopify"] as const;
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

// The demo finish of the site SnapStart builds. Nothing goes online.
export interface SiteFinish {
  at: string;
  // The version finished, so the page can tell when there are newer changes
  signature: string;
}

// A site the owner already has, and its demo connection
export const EXISTING_PLATFORMS = ["square", "wix", "shopify", "other"] as const;
export type ExistingPlatform = (typeof EXISTING_PLATFORMS)[number];

export interface ExistingSite {
  platform: ExistingPlatform;
  url: string;
  connectedAt: string;
}
