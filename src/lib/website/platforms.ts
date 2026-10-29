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

// The owner's own things shown ready to copy beside a step
export const PASTE_KINDS = ["name", "seo", "colors", "logo", "favicon", "home", "pages", "faq", "contact", "items", "dns"] as const;
export type PasteKind = (typeof PASTE_KINDS)[number];

export interface SetupStepInfo {
  key: string;
  title: string;
  detail: string;
  // Menus and buttons in order, named as the platform's help names them
  clicks: string[];
  // "Take me there": the platform's own page for this step
  goTo: { label: string; url: string } | null;
  help: { label: string; url: string } | null;
  inApp: { label: string; href: string } | null;
  paste: PasteKind[];
}

export interface DnsRecord {
  type: "A" | "AAAA" | "CNAME";
  // "@" is the bare address, such as yourname.com
  host: string;
  // "{site}" stands for the site's own address on the host, such as yourname.netlify.app
  value: string;
}

export interface DomainSetup {
  // Records to add at the company where the web address was bought
  records: DnsRecord[];
  // Set when the platform shows its own values for each site instead
  shownIn: string | null;
  note: string;
  source: { label: string; url: string };
}

export interface PlatformInfo {
  id: PlatformId;
  name: string;
  oneLine: string;
  bestFor: string;
  // Has its own cart and checkout
  canSell: boolean;
  startPlan: PlatformPlan;
  otherPlans: PlatformPlan[];
  // Online card payments on the starting plan; null when the platform has no checkout
  cardFee: { label: string; percent: number; fixedCents: number } | null;
  // How customers pay when there's no checkout
  paymentNote: string | null;
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
  // Date the menus, buttons and DNS values were read in the vendor's help
  stepsCheckedOn: string;
  domainSetup: DomainSetup;
}
