import type {
  BUDGET_RANGES,
  HIRING_PLANS,
  OFFERING_KINDS,
  PREMISES,
  SELLING_CHANNELS,
  UsStateCode,
} from "@/lib/domain";

// Owner-facing labels for each intake answer, in display order.

export const OFFERING_KIND_LABELS: Record<(typeof OFFERING_KINDS)[number], string> = {
  food: "Food you make",
  handmade: "Handmade goods",
  resale: "Goods you buy to resell",
  services: "Services",
  other: "Something else",
};

export const CHANNEL_LABELS: Record<(typeof SELLING_CHANNELS)[number], string> = {
  in_person: "In person",
  markets: "Markets and events",
  storefront: "A storefront",
  own_website: "Your own website",
  marketplace: "Marketplaces like Etsy",
  social_media: "Social media",
  wholesale: "Selling to shops (wholesale)",
};

export const PREMISES_LABELS: Record<(typeof PREMISES)[number], string> = {
  home: "At home",
  rented_space: "A rented space",
  shared_kitchen: "A shared kitchen or studio",
  online_only: "No workspace yet",
  unsure: "Not sure yet",
};

export const BUDGET_LABELS: Record<(typeof BUDGET_RANGES)[number], string> = {
  under_1k: "Under $1,000",
  "1k_5k": "$1,000–$5,000",
  "5k_25k": "$5,000–$25,000",
  over_25k: "Over $25,000",
  unsure: "Not sure yet",
};

export const HIRING_LABELS: Record<(typeof HIRING_PLANS)[number], string> = {
  not_now: "Not for now",
  first_year: "Within the first year",
  right_away: "Right away",
};

export const STATE_NAMES: Record<UsStateCode, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export function entries<K extends string>(labels: Record<K, string>): [K, string][] {
  return Object.entries(labels) as [K, string][];
}
