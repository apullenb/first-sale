import { STRUCTURE_LABELS } from "@/lib/details";
import type {
  BUDGET_RANGES,
  BUSINESS_STAGES,
  EXISTING_SETUP,
  EXPERIENCE_LEVELS,
  GOALS,
  HANDOFF_METHODS,
  HELP_KINDS,
  HIRING_PLANS,
  INVENTORY_SOURCES,
  LAUNCH_TIMINGS,
  OFFERING_KINDS,
  OWNER_RELATIONS,
  PREMISES,
  REGISTERED_AS,
  SALES_RANGES,
  SELLING_CHANNELS,
  UsStateCode,
  YES_NO_UNSURE,
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

export const YES_NO_LABELS: Record<(typeof YES_NO_UNSURE)[number], string> = {
  yes: "Yes",
  no: "No",
  unsure: "Not sure",
};

export const STAGE_LABELS: Record<(typeof BUSINESS_STAGES)[number], string> = {
  idea: "Just an idea so far",
  selling_informally: "Already selling a little",
  registered: "Already registered",
};

export const REGISTERED_AS_LABELS: Record<(typeof REGISTERED_AS)[number], string> = {
  sole_proprietorship: STRUCTURE_LABELS.sole_proprietorship,
  llc: STRUCTURE_LABELS.llc,
  partnership: STRUCTURE_LABELS.partnership,
  corporation: STRUCTURE_LABELS.corporation,
  unsure: "Not sure",
};

// One plain line under each structure name
export const REGISTERED_AS_HELP: Record<(typeof REGISTERED_AS)[number], string> = {
  sole_proprietorship: "You own it alone, and the business isn’t a separate company from you. You may have registered a business name.",
  llc: "A company you formed with your state, with “LLC” in its registered name.",
  partnership: "Two or more people own it together, without forming an LLC or corporation.",
  corporation: "A company formed with your state that’s owned through shares, such as an S corp or C corp.",
  unsure: "That’s fine. Your registration papers, or your state’s business search, will say.",
};

export const LAUNCH_TIMING_LABELS: Record<(typeof LAUNCH_TIMINGS)[number], string> = {
  within_1_month: "Within a month",
  "1_3_months": "In 1–3 months",
  "3_6_months": "In 3–6 months",
  later: "Later than that",
  unsure: "Not sure yet",
};

export const EXPERIENCE_LABELS: Record<(typeof EXPERIENCE_LEVELS)[number], string> = {
  first_business: "No, this is my first",
  some: "A little, like a side business",
  experienced: "Yes, I’ve run a business before",
};

export const OWNER_RELATION_LABELS: Record<(typeof OWNER_RELATIONS)[number], string> = {
  spouse: "My spouse or partner",
  family: "Family, like a brother, sister or parent",
  friends: "Friends or business partners",
  unsure: "Not sure",
};

export const EXISTING_SETUP_LABELS: Record<(typeof EXISTING_SETUP)[number], string> = {
  business_name: "A registered business name (DBA)",
  ein: "An EIN (federal tax ID number)",
  sales_tax: "A sales tax permit",
  local_license: "A city or county business license",
  health_permit: "A health or food permit",
  none: "None of these yet",
  unsure: "Not sure",
};

export const HANDOFF_LABELS: Record<(typeof HANDOFF_METHODS)[number], string> = {
  in_person_sale: "They take it when they buy",
  pickup_home: "Pickup at my home",
  pickup_elsewhere: "Pickup somewhere else",
  local_delivery: "I deliver nearby",
  ship_in_state: "I ship within my state",
  ship_out_of_state: "I ship to other states",
  unsure: "Not sure yet",
};

export const INVENTORY_SOURCE_LABELS: Record<(typeof INVENTORY_SOURCES)[number], string> = {
  new_wholesale: "New items from brands or wholesalers",
  secondhand: "Used or vintage items I buy",
  consignment: "Items people leave with me to sell",
  own_designs: "Things I design or sew myself",
  unsure: "Not sure yet",
};

export const SALES_LABELS: Record<(typeof SALES_RANGES)[number], string> = {
  under_5k: "Under $5,000",
  "5k_25k": "$5,000–$25,000",
  "25k_100k": "$25,000–$100,000",
  over_100k: "Over $100,000",
  unsure: "Not sure yet",
};

export const HELP_KIND_LABELS: Record<(typeof HELP_KINDS)[number], string> = {
  employees: "Employees on payroll",
  contractors: "Freelancers or contractors",
  family_help: "Family helping out",
  unsure: "Not sure yet",
};

export const GOAL_LABELS: Record<(typeof GOALS)[number], string> = {
  test_idea: "Test my idea first",
  side_income: "Extra income on the side",
  full_time: "Make it my full-time work",
  grow: "Grow it bigger, with a team or a shop",
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

// "Franklin" → "Franklin County"; parishes, boroughs and independent cities already say what they are
export function countyLabel(name: string): string {
  const trimmed = name.trim();
  return !trimmed || /(county|parish|borough|city|municipality|census area)$/i.test(trimmed) ? trimmed : `${trimmed} County`;
}

export function entries<K extends string>(labels: Record<K, string>): [K, string][] {
  return Object.entries(labels) as [K, string][];
}
