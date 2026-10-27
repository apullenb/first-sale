import {
  MAX_OWNERS,
  type BUDGET_RANGES,
  type BUSINESS_STAGES,
  type BusinessProfile,
  type EXPERIENCE_LEVELS,
  type HIRING_PLANS,
  type LAUNCH_TIMINGS,
  type OFFERING_KINDS,
  type PREMISES,
  type REGISTERED_AS,
  type SELLING_CHANNELS,
  type UsStateCode,
  type YES_NO_UNSURE,
} from "@/lib/domain";
import {
  BUDGET_LABELS,
  CHANNEL_LABELS,
  EXPERIENCE_LABELS,
  HIRING_LABELS,
  LAUNCH_TIMING_LABELS,
  OFFERING_KIND_LABELS,
  PREMISES_LABELS,
  REGISTERED_AS_LABELS,
  STAGE_LABELS,
  STATE_NAMES,
  YES_NO_LABELS,
} from "./options";
import type { IntakeSuggestion } from "./suggestion-schema";

type OfferingKind = (typeof OFFERING_KINDS)[number];
type Channel = (typeof SELLING_CHANNELS)[number];
type YesNo = (typeof YES_NO_UNSURE)[number] | "";

// The wizard's working copy: empty strings mean "not answered yet".
// Follow-ups keep their answer while hidden, but only applying ones are saved.
export interface IntakeAnswers {
  description: string;
  name: string;
  noName: boolean;
  state: UsStateCode | "";
  county: string;
  city: string;
  insideCityLimits: YesNo;
  owners: "me" | "others" | "";
  ownerCount: number;
  stage: (typeof BUSINESS_STAGES)[number] | "";
  registeredAs: (typeof REGISTERED_AS)[number] | "";
  offeringKinds: OfferingKind[];
  firstItems: string;
  foodNeedsCold: YesNo;
  channels: Channel[];
  shipsOrders: YesNo;
  premises: (typeof PREMISES)[number] | "";
  customersVisit: YesNo;
  startupBudget: (typeof BUDGET_RANGES)[number] | "";
  hiringPlans: (typeof HIRING_PLANS)[number] | "";
  launchTiming: (typeof LAUNCH_TIMINGS)[number] | "";
  experience: (typeof EXPERIENCE_LEVELS)[number] | "";
}

export const EMPTY_ANSWERS: IntakeAnswers = {
  description: "",
  name: "",
  noName: false,
  state: "",
  county: "",
  city: "",
  insideCityLimits: "",
  owners: "",
  ownerCount: 2,
  stage: "",
  registeredAs: "",
  offeringKinds: [],
  firstItems: "",
  foodNeedsCold: "",
  channels: [],
  shipsOrders: "",
  premises: "",
  customersVisit: "",
  startupBudget: "",
  hiringPlans: "",
  launchTiming: "",
  experience: "",
};

export const STEPS = ["idea", "name", "place", "owners", "status", "sell", "channels", "premises", "money", "timing"] as const;
export type StepId = (typeof STEPS)[number];

// Channels where orders may go out by mail
export const SHIPPING_CHANNELS: readonly Channel[] = ["own_website", "marketplace", "social_media", "wholesale"];

export const FOLLOW_UPS = ["insideCityLimits", "registeredAs", "foodNeedsCold", "shipsOrders", "customersVisit"] as const;
export type FollowUp = (typeof FOLLOW_UPS)[number];

// Whether a follow-up question is asked, given the answers it depends on
export function asks(field: FollowUp, a: IntakeAnswers): boolean {
  switch (field) {
    case "insideCityLimits":
      return Boolean(a.city.trim());
    case "registeredAs":
      return a.stage === "registered";
    case "foodNeedsCold":
      return a.offeringKinds.includes("food");
    case "shipsOrders":
      return a.channels.some((channel) => SHIPPING_CHANNELS.includes(channel));
    case "customersVisit":
      return a.premises === "home";
  }
}

// Fields AI may suggest, and the step that shows each one
export const SUGGESTIBLE: Partial<Record<keyof IntakeAnswers, StepId>> = {
  state: "place",
  owners: "owners",
  stage: "status",
  registeredAs: "status",
  offeringKinds: "sell",
  channels: "channels",
  shipsOrders: "channels",
  premises: "premises",
};

export type SuggestibleField = keyof typeof SUGGESTIBLE;

// Fills only unanswered questions, and follow-ups only where they're asked; returns which it filled
export function applySuggestion(
  a: IntakeAnswers,
  s: IntakeSuggestion,
): { answers: IntakeAnswers; applied: SuggestibleField[] } {
  const fills: Partial<IntakeAnswers> = {};
  if (s.state && !a.state) fills.state = s.state;
  if (s.owners && !a.owners) fills.owners = s.owners;
  if (s.stage && !a.stage) fills.stage = s.stage;
  if (s.offeringKinds.length && !a.offeringKinds.length) fills.offeringKinds = s.offeringKinds;
  if (s.channels.length && !a.channels.length) fills.channels = s.channels;
  if (s.premises && !a.premises) fills.premises = s.premises;
  const filled = { ...a, ...fills };
  if (s.registeredAs && !a.registeredAs && asks("registeredAs", filled)) fills.registeredAs = s.registeredAs;
  if (s.shipsOrders && !a.shipsOrders && asks("shipsOrders", filled)) fills.shipsOrders = s.shipsOrders;
  return { answers: { ...a, ...fills }, applied: Object.keys(fills) as SuggestibleField[] };
}

// Unvalidated: the server checks the result against businessProfileSchema
export function answersToProfile(a: IntakeAnswers) {
  const followUp = <T extends string>(field: FollowUp, value: T | "") => (asks(field, a) && value ? value : null);
  return {
    name: a.noName ? null : a.name.trim(),
    description: a.description.trim(),
    country: "US" as const,
    location: {
      state: a.state,
      county: a.county.trim(),
      city: a.city.trim(),
      insideCityLimits: followUp("insideCityLimits", a.insideCityLimits),
    },
    // Unanswered becomes 0, which the server rejects rather than guessing one owner
    owners: { count: a.owners === "others" ? a.ownerCount : a.owners === "me" ? 1 : 0 },
    stage: a.stage || null,
    registeredAs: followUp("registeredAs", a.registeredAs),
    offeringKinds: a.offeringKinds,
    firstItems: a.firstItems.trim(),
    foodNeedsCold: followUp("foodNeedsCold", a.foodNeedsCold),
    channels: a.channels,
    shipsOrders: followUp("shipsOrders", a.shipsOrders),
    premises: a.premises || null,
    customersVisit: followUp("customersVisit", a.customersVisit),
    startupBudget: a.startupBudget || null,
    hiringPlans: a.hiringPlans || null,
    experience: a.experience || null,
    launchTiming: a.launchTiming || null,
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
    insideCityLimits: p.location.insideCityLimits ?? "",
    owners: p.owners.count > 1 ? "others" : "me",
    ownerCount: Math.max(2, p.owners.count),
    stage: p.stage ?? "",
    registeredAs: p.registeredAs ?? "",
    offeringKinds: p.offeringKinds,
    firstItems: p.firstItems,
    foodNeedsCold: p.foodNeedsCold ?? "",
    channels: p.channels,
    shipsOrders: p.shipsOrders ?? "",
    premises: p.premises ?? "",
    customersVisit: p.customersVisit ?? "",
    startupBudget: p.startupBudget ?? "",
    hiringPlans: p.hiringPlans ?? "",
    launchTiming: p.launchTiming ?? "",
    experience: p.experience ?? "",
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
  // Answers shown in this row, for marking AI suggestions
  fields: (keyof IntakeAnswers)[];
  followUp?: true;
}

// Short summaries leave out follow-ups; the review and the business page ask for them
export function summarize(a: IntakeAnswers, options: { followUps?: boolean } = {}): SummaryRow[] {
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
  const yesNo = (value: YesNo) => (value ? YES_NO_LABELS[value] : "");
  const followUp = (field: FollowUp, label: string, value: string, step: StepId): SummaryRow[] =>
    options.followUps && asks(field, a) ? [{ label, value, step, fields: [field], followUp: true }] : [];

  const rows: SummaryRow[] = [
    { label: "Your idea", value: a.description.trim(), step: "idea", fields: ["description"] },
    { label: "Business name", value: a.noName ? "Not picked yet" : a.name.trim(), step: "name", fields: ["name", "noName"] },
    { label: "Where", value: place, step: "place", fields: ["state", "county", "city"] },
    ...followUp("insideCityLimits", "Inside city limits", yesNo(a.insideCityLimits), "place"),
    {
      label: "Owners",
      value: a.owners === "me" ? "Just you" : a.owners === "others" ? `${a.ownerCount} owners` : "",
      step: "owners",
      fields: ["owners", "ownerCount"],
    },
    { label: "Where you are now", value: a.stage ? STAGE_LABELS[a.stage] : "", step: "status", fields: ["stage"] },
    ...followUp("registeredAs", "Registered as", a.registeredAs ? REGISTERED_AS_LABELS[a.registeredAs] : "", "status"),
    {
      label: "What you’ll sell",
      value: [kinds, a.firstItems.trim()].filter(Boolean).join(": "),
      step: "sell",
      fields: ["offeringKinds", "firstItems"],
    },
    ...followUp("foodNeedsCold", "Food kept cold", yesNo(a.foodNeedsCold), "sell"),
    { label: "How you’ll sell", value: a.channels.map((c) => CHANNEL_LABELS[c]).join(", "), step: "channels", fields: ["channels"] },
    ...followUp("shipsOrders", "Shipping orders", yesNo(a.shipsOrders), "channels"),
    { label: "Where you’ll work", value: a.premises ? PREMISES_LABELS[a.premises] : "", step: "premises", fields: ["premises"] },
    ...followUp("customersVisit", "Customers at your home", yesNo(a.customersVisit), "premises"),
    { label: "Money and help", value: money, step: "money", fields: ["startupBudget", "hiringPlans"] },
    {
      label: "When you’ll start",
      value: a.launchTiming ? LAUNCH_TIMING_LABELS[a.launchTiming] : "",
      step: "timing",
      fields: ["launchTiming"],
    },
    { label: "Run a business before", value: a.experience ? EXPERIENCE_LABELS[a.experience] : "", step: "timing", fields: ["experience"] },
  ];
  return rows;
}

// Unnamed businesses get their state so owners can tell them apart
export function displayName(profile: BusinessProfile | null): string {
  if (!profile) return "Business with answers to update";
  return profile.name ?? `Unnamed business in ${STATE_NAMES[profile.location.state]}`;
}
