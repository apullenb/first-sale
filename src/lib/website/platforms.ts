import type { PlatformId } from "./types";

// Shape of the curated platform facts in src/data/website-platforms.ts. Every price comes from the vendor's own page.

export interface PlatformPlan {
  name: string;
  // As the vendor shows it, such as "$29 a month, billed yearly"
  price: string;
  // For the first-year estimate; the plan we suggest starting on
  monthlyUsd: number;
  adds: string;
}

export interface CostItem {
  item: string;
  cost: string;
  why: string;
  // Where First Sale already helps with it
  inApp: { label: string; href: string } | null;
}

export interface SetupStepInfo {
  key: string;
  title: string;
  detail: string;
  help: { label: string; url: string } | null;
  inApp: { label: string; href: string } | null;
}

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  oneLine: string;
  bestFor: string;
  canSell: boolean;
  startPlan: PlatformPlan;
  otherPlans: PlatformPlan[];
  // Online card payments on the starting plan; null when the platform has no checkout
  cardFee: { label: string; percent: number; fixedCents: number } | null;
  domain: { label: string; firstYearUsd: number | null };
  includes: string[];
  notIncluded: CostItem[];
  pros: string[];
  cons: string[];
  signupUrl: string;
  sources: { label: string; url: string }[];
  // Date the prices and links were read on the vendor's pages
  checkedOn: string;
  setupSteps: SetupStepInfo[];
}
