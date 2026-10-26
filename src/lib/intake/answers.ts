import {
  MAX_OWNERS,
  type BUDGET_RANGES,
  type BusinessProfile,
  type HIRING_PLANS,
  type OFFERING_KINDS,
  type PREMISES,
  type SELLING_CHANNELS,
  type UsStateCode,
} from "@/lib/domain";
import {
  BUDGET_LABELS,
  CHANNEL_LABELS,
  HIRING_LABELS,
  OFFERING_KIND_LABELS,
  PREMISES_LABELS,
  STATE_NAMES,
} from "./options";

type OfferingKind = (typeof OFFERING_KINDS)[number];
type Channel = (typeof SELLING_CHANNELS)[number];

// The wizard's working copy: empty strings mean "not answered yet".
export interface IntakeAnswers {
  description: string;
  name: string;
  noName: boolean;
  state: UsStateCode | "";
  county: string;
  city: string;
  owners: "me" | "others" | "";
  ownerCount: number;
  offeringKinds: OfferingKind[];
  firstItems: string;
  channels: Channel[];
  premises: (typeof PREMISES)[number] | "";
  startupBudget: (typeof BUDGET_RANGES)[number] | "";
  hiringPlans: (typeof HIRING_PLANS)[number] | "";
}

export const EMPTY_ANSWERS: IntakeAnswers = {
  description: "",
  name: "",
  noName: false,
  state: "",
  county: "",
  city: "",
  owners: "",
  ownerCount: 2,
  offeringKinds: [],
  firstItems: "",
  channels: [],
  premises: "",
  startupBudget: "",
  hiringPlans: "",
};

export const STEPS = ["idea", "name", "place", "owners", "sell", "channels", "premises", "money"] as const;
export type StepId = (typeof STEPS)[number];

// Fields AI may suggest, and the step that shows each one
export const SUGGESTIBLE: Partial<Record<keyof IntakeAnswers, StepId>> = {
  state: "place",
  owners: "owners",
  offeringKinds: "sell",
  channels: "channels",
  premises: "premises",
};

export type SuggestibleField = keyof typeof SUGGESTIBLE;

// Fills only unanswered questions; returns which ones it filled
export function applySuggestion(
  a: IntakeAnswers,
  s: {
    state: IntakeAnswers["state"] | null;
    owners: IntakeAnswers["owners"] | null;
    offeringKinds: IntakeAnswers["offeringKinds"];
    channels: IntakeAnswers["channels"];
    premises: IntakeAnswers["premises"] | null;
  },
): { answers: IntakeAnswers; applied: SuggestibleField[] } {
  const fills: Partial<IntakeAnswers> = {};
  if (s.state && !a.state) fills.state = s.state;
  if (s.owners && !a.owners) fills.owners = s.owners;
  if (s.offeringKinds.length && !a.offeringKinds.length) fills.offeringKinds = s.offeringKinds;
  if (s.channels.length && !a.channels.length) fills.channels = s.channels;
  if (s.premises && !a.premises) fills.premises = s.premises;
  return { answers: { ...a, ...fills }, applied: Object.keys(fills) as SuggestibleField[] };
}

// Unvalidated: the server checks the result against businessProfileSchema
export function answersToProfile(a: IntakeAnswers) {
  return {
    name: a.noName ? null : a.name.trim(),
    description: a.description.trim(),
    location: { state: a.state, county: a.county.trim(), city: a.city.trim() },
    // Unanswered becomes 0, which the server rejects rather than guessing one owner
    owners: { count: a.owners === "others" ? a.ownerCount : a.owners === "me" ? 1 : 0 },
    offeringKinds: a.offeringKinds,
    firstItems: a.firstItems.trim(),
    channels: a.channels,
    premises: a.premises || null,
    startupBudget: a.startupBudget || null,
    hiringPlans: a.hiringPlans || null,
  };
}

export function profileToAnswers(p: BusinessProfile): IntakeAnswers {
  return {
    description: p.description,
    name: p.name ?? "",
    noName: p.name === null,
    state: p.location.state,
    county: p.location.county,
    city: p.location.city,
    owners: p.owners.count > 1 ? "others" : "me",
    ownerCount: Math.max(2, p.owners.count),
    offeringKinds: p.offeringKinds,
    firstItems: p.firstItems,
    channels: p.channels,
    premises: p.premises ?? "",
    startupBudget: p.startupBudget ?? "",
    hiringPlans: p.hiringPlans ?? "",
  };
}

// What stops Continue on a step; null when the step is complete enough
export function stepProblem(step: StepId, a: IntakeAnswers): string | null {
  switch (step) {
    case "name":
      return a.noName || a.name.trim() ? null : "Enter a name, or tick “I haven’t picked a name yet”.";
    case "place":
      return a.state ? null : "Choose your state. Requirements depend on it.";
    case "owners":
      if (!a.owners) return "Choose who owns the business.";
      return a.owners === "others" && (a.ownerCount < 2 || a.ownerCount > MAX_OWNERS)
        ? `Enter between 2 and ${MAX_OWNERS} owners.`
        : null;
    case "sell":
      return a.offeringKinds.length ? null : "Pick at least one kind of thing you’ll sell.";
    case "channels":
      return a.channels.length ? null : "Pick at least one way you’ll sell.";
    default:
      return null;
  }
}

export interface SummaryRow {
  label: string;
  value: string;
  step: StepId;
}

export function summarize(a: IntakeAnswers): SummaryRow[] {
  const county = a.county.trim();
  const countyText = county && !/(county|parish|borough|city)$/i.test(county) ? `${county} County` : county;
  const place = [a.city.trim(), countyText, a.state ? STATE_NAMES[a.state] : ""].filter(Boolean).join(", ");
  const kinds = a.offeringKinds.map((k) => OFFERING_KIND_LABELS[k]).join(", ");
  const money = [
    a.startupBudget ? BUDGET_LABELS[a.startupBudget] : "",
    a.hiringPlans ? `Hiring: ${HIRING_LABELS[a.hiringPlans].toLowerCase()}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    { label: "Your idea", value: a.description.trim(), step: "idea" },
    { label: "Business name", value: a.noName ? "Not picked yet" : a.name.trim(), step: "name" },
    { label: "Where", value: place, step: "place" },
    {
      label: "Owners",
      value: a.owners === "me" ? "Just you" : a.owners === "others" ? `${a.ownerCount} owners` : "",
      step: "owners",
    },
    { label: "What you’ll sell", value: [kinds, a.firstItems.trim()].filter(Boolean).join(": "), step: "sell" },
    { label: "How you’ll sell", value: a.channels.map((c) => CHANNEL_LABELS[c]).join(", "), step: "channels" },
    { label: "Where you’ll work", value: a.premises ? PREMISES_LABELS[a.premises] : "", step: "premises" },
    { label: "Money and help", value: money, step: "money" },
  ];
}

// Unnamed businesses get their state so owners can tell them apart
export function displayName(profile: BusinessProfile | null): string {
  if (!profile) return "Business with answers to update";
  return profile.name ?? `Unnamed business in ${STATE_NAMES[profile.location.state]}`;
}
