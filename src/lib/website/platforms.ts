import type { PlatformId } from "./types";

// Shape of the curated platform facts in src/data/website-platforms.ts. Every price comes from the vendor's own page, except First Sale's demo price.

export interface PlatformPlan {
  name: string;
  // As the vendor shows it, such as "$29 a month, billed yearly"
  price: string;
  // For the first-year estimate; the plan we suggest starting on
  monthlyUsd: number;
  adds: string;
}

// Something the owner does themselves, with where First Sale already helps
export interface OwnerTask {
  text: string;
  inApp: { label: string; href: string } | null;
}

// The owner's own web address, as the platform's pages describe it
export interface DomainOffer {
  // A free address on the platform, such as yourname.square.site
  freeAddress: string | null;
  // "here": the platform sells web addresses; "elsewhere": bought from another company
  sold: "here" | "elsewhere";
  // The lowest first price the platform shows, null when it shows none
  firstUsd: number | null;
  // "year" when the page says the price is yearly; null when it doesn't say
  per: "year" | null;
  // A "from" or "starting at" price
  from: boolean;
  // Free for the first year on the starting plan
  firstYearFree: boolean;
  // After the free first year, as the platform's pages give it
  later: string | null;
  // Using your own address needs this plan instead of the starting one
  needsPlan: { name: string; monthlyUsd: number } | null;
}

// A business email address such as you@yourname.com
export interface EmailOffer {
  // "addon": set up through the platform for a fee; "forwarding": free forwarding, a full inbox costs extra; "none": not offered
  kind: "addon" | "forwarding" | "none";
  via: string;
  // Null when the price isn't checked here
  monthlyUsd: number | null;
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
  // The starting price is First Sale's own placeholder, not read on a vendor's page
  demoPrice: boolean;
  startPlan: PlatformPlan;
  otherPlans: PlatformPlan[];
  // Who makes the pages: the owner with the platform's builder, or First Sale from the owner's choices
  builtBy: "owner" | "first_sale";
  hosting: boolean;
  // Its own cart and checkout, or Buy buttons that open a payment provider's page
  checkout: "built_in" | "payment_links";
  // Card fee per online sale on the starting plan, or through the payment provider
  cardFee: { label: string; percent: number; fixedCents: number };
  domain: DomainOffer;
  email: EmailOffer;
  includes: string[];
  youDo: OwnerTask[];
  thingsToKnow: string[];
  // Null when there's nothing to sign up for elsewhere
  signupUrl: string | null;
  sources: { label: string; url: string }[];
  // Date the prices and links were read on the vendor's pages
  checkedOn: string;
  setupSteps: SetupStepInfo[];
  // Date the menus, buttons and DNS values were read in the vendor's help
  stepsCheckedOn: string;
  // Null when there are no records to add
  domainSetup: DomainSetup | null;
}
