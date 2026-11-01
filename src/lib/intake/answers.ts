import {
  MAX_OWNERS,
  type BUDGET_RANGES,
  type BUSINESS_STAGES,
  type BusinessCategory,
  type BusinessProfile,
  type EXISTING_SETUP,
  type EXPERIENCE_LEVELS,
  type GOALS,
  type HANDOFF_METHODS,
  type HELP_KINDS,
  type HIRING_PLANS,
  type INVENTORY_SOURCES,
  type LAUNCH_TIMINGS,
  type OFFERING_KINDS,
  type OWNER_RELATIONS,
  type PREMISES,
  type REGISTERED_AS,
  type SALES_RANGES,
  type SELLING_CHANNELS,
  type UsStateCode,
  type YES_NO_UNSURE,
} from "@/lib/domain";
import { categoryFor, examplesText, hasFlag } from "./catalog";
import {
  BUDGET_LABELS,
  CHANNEL_LABELS,
  countyLabel,
  EXISTING_SETUP_LABELS,
  EXPERIENCE_LABELS,
  GOAL_LABELS,
  HANDOFF_LABELS,
  HELP_KIND_LABELS,
  HIRING_LABELS,
  INVENTORY_SOURCE_LABELS,
  LAUNCH_TIMING_LABELS,
  OFFERING_KIND_LABELS,
  OWNER_RELATION_LABELS,
  PREMISES_LABELS,
  REGISTERED_AS_LABELS,
  SALES_LABELS,
  STAGE_LABELS,
  STATE_NAMES,
  YES_NO_LABELS,
} from "./options";
import type { IntakeSuggestion } from "./suggestion-schema";

type OfferingKind = (typeof OFFERING_KINDS)[number];
type Channel = (typeof SELLING_CHANNELS)[number];
type YesNo = (typeof YES_NO_UNSURE)[number] | "";
type Handoff = (typeof HANDOFF_METHODS)[number];

// The wizard's working copy: empty strings and lists mean "not answered yet".
// Follow-ups keep their answer while hidden, but only applying ones are saved.
export interface IntakeAnswers {
  description: string;
  category: BusinessCategory | "";
  productTags: string[];
  name: string;
  noName: boolean;
  nameIsLegalName: YesNo;
  state: UsStateCode | "";
  county: string;
  city: string;
  insideCityLimits: YesNo;
  owners: "me" | "others" | "";
  ownerCount: number;
  ownerRelation: (typeof OWNER_RELATIONS)[number] | "";
  mayAddOwners: YesNo;
  stage: (typeof BUSINESS_STAGES)[number] | "";
  registeredAs: (typeof REGISTERED_AS)[number] | "";
  alreadyHave: (typeof EXISTING_SETUP)[number][];
  // Includes the category's own kind once saved; extra kinds for "something else"
  offeringKinds: OfferingKind[];
  // The owner's own words beyond the picked examples
  firstItems: string;
  foodNeedsCold: YesNo;
  makesForKids: YesNo;
  foodContact: YesNo;
  inventorySources: (typeof INVENTORY_SOURCES)[number][];
  servicesLicensed: YesNo;
  channels: Channel[];
  handoff: Handoff[];
  // Kept for profiles saved before handoff was asked
  shipsOrders: YesNo;
  premises: (typeof PREMISES)[number] | "";
  customersVisit: YesNo;
  startupBudget: (typeof BUDGET_RANGES)[number] | "";
  firstYearSales: (typeof SALES_RANGES)[number] | "";
  takesOnDebt: YesNo;
  hiringPlans: (typeof HIRING_PLANS)[number] | "";
  helpKinds: (typeof HELP_KINDS)[number][];
  // Before launchDate; "unsure" now means no date yet
  launchTiming: (typeof LAUNCH_TIMINGS)[number] | "";
  launchDate: string;
  experience: (typeof EXPERIENCE_LEVELS)[number] | "";
  goals: (typeof GOALS)[number][];
}

export const EMPTY_ANSWERS: IntakeAnswers = {
  description: "",
  category: "",
  productTags: [],
  name: "",
  noName: false,
  nameIsLegalName: "",
  state: "",
  county: "",
  city: "",
  insideCityLimits: "",
  owners: "",
  ownerCount: 2,
  ownerRelation: "",
  mayAddOwners: "",
  stage: "",
  registeredAs: "",
  alreadyHave: [],
  offeringKinds: [],
  firstItems: "",
  foodNeedsCold: "",
  makesForKids: "",
  foodContact: "",
  inventorySources: [],
  servicesLicensed: "",
  channels: [],
  handoff: [],
  shipsOrders: "",
  premises: "",
  customersVisit: "",
  startupBudget: "",
  firstYearSales: "",
  takesOnDebt: "",
  hiringPlans: "",
  helpKinds: [],
  launchTiming: "",
  launchDate: "",
  experience: "",
  goals: [],
};

// Groups of a few questions each, in order. "place" and "sell" are read by the Today page.
export const STEPS = ["sell", "status", "place", "owners", "name", "channels", "details", "premises", "money", "help", "timing"] as const;
export type StepId = (typeof STEPS)[number];

// Channels where orders may go out by mail, for profiles saved before handoff was asked
export const SHIPPING_CHANNELS: readonly Channel[] = ["own_website", "marketplace", "social_media", "wholesale"];

export const FOLLOW_UPS = [
  "insideCityLimits",
  "ownerRelation",
  "mayAddOwners",
  "nameIsLegalName",
  "registeredAs",
  "alreadyHave",
  "foodNeedsCold",
  "makesForKids",
  "foodContact",
  "inventorySources",
  "servicesLicensed",
  "handoff",
  "shipsOrders",
  "customersVisit",
  "helpKinds",
] as const;
export type FollowUp = (typeof FOLLOW_UPS)[number];

// The category's kind plus any extra kinds picked
export function kindsOf(a: Pick<IntakeAnswers, "category" | "offeringKinds">): OfferingKind[] {
  const kind = categoryFor(a.category)?.kind;
  return [...new Set([...(kind ? [kind] : []), ...a.offeringKinds])];
}

const sellsGoods = (a: IntakeAnswers) => kindsOf(a).some((kind) => kind !== "services");

// Whether a follow-up question is asked, given the answers it depends on
export function asks(field: FollowUp, a: IntakeAnswers): boolean {
  const kinds = kindsOf(a);
  switch (field) {
    case "insideCityLimits":
      return Boolean(a.city.trim());
    case "ownerRelation":
      return a.owners === "others";
    case "mayAddOwners":
      return a.owners === "me";
    case "nameIsLegalName":
      return !a.noName && Boolean(a.name.trim()) && a.owners !== "others";
    case "registeredAs":
      return a.stage === "registered";
    case "alreadyHave":
      return a.stage === "selling_informally" || a.stage === "registered";
    case "foodNeedsCold":
      return kinds.includes("food");
    case "makesForKids":
      return kinds.includes("handmade") || kinds.includes("resale");
    case "foodContact":
      return kinds.includes("handmade");
    case "inventorySources":
      return kinds.includes("resale");
    case "servicesLicensed":
      return kinds.includes("services");
    case "handoff":
      return sellsGoods(a);
    case "shipsOrders":
      // Only older answers that predate the handoff question
      return !a.handoff.length && a.channels.some((channel) => SHIPPING_CHANNELS.includes(channel)) && Boolean(a.shipsOrders);
    case "customersVisit":
      return a.premises === "home";
    case "helpKinds":
      return a.hiringPlans === "first_year" || a.hiringPlans === "right_away";
  }
}

// Steps shown for these answers; "details" only when one of its questions applies
export function stepsFor(a: IntakeAnswers): StepId[] {
  const details = (["foodNeedsCold", "makesForKids", "foodContact", "inventorySources", "servicesLicensed"] as const).some((field) =>
    asks(field, a),
  );
  return STEPS.filter((step) => step !== "details" || details);
}

// Answers filled in from other answers until the owner confirms them by continuing
export type Mark = "ai" | "default";
export type Marks = Partial<Record<keyof IntakeAnswers, Mark>>;

function impliedBy(a: IntakeAnswers): Partial<IntakeAnswers> {
  return {
    foodNeedsCold: hasFlag(a.category, a.productTags, "cold") ? "yes" : undefined,
    makesForKids: hasFlag(a.category, a.productTags, "kids") ? "yes" : undefined,
    foodContact: hasFlag(a.category, a.productTags, "food_contact") ? "yes" : undefined,
    inventorySources: hasFlag(a.category, a.productTags, "secondhand") ? ["secondhand"] : undefined,
    customersVisit: a.handoff.includes("pickup_home") ? "yes" : undefined,
  };
}

// Fills an unanswered question when another answer starts to imply it, and takes back unconfirmed ones that no longer follow.
// Answers the owner gave themselves, including clearing one, are never changed.
export function withDefaults(a: IntakeAnswers, marks: Marks, previous: IntakeAnswers = EMPTY_ANSWERS): { answers: IntakeAnswers; marks: Marks } {
  const next = { ...a };
  const nextMarks = { ...marks };
  const before = impliedBy(previous);
  for (const [field, value] of Object.entries(impliedBy(a)) as [keyof IntakeAnswers, IntakeAnswers[keyof IntakeAnswers] | undefined][]) {
    const current = next[field];
    const empty = Array.isArray(current) ? current.length === 0 : current === "";
    const newlyImplied = JSON.stringify(value) !== JSON.stringify(before[field]);
    if (value !== undefined && (nextMarks[field] === "default" || (empty && newlyImplied))) {
      Object.assign(next, { [field]: value });
      nextMarks[field] = "default";
    } else if (value === undefined && nextMarks[field] === "default") {
      Object.assign(next, { [field]: Array.isArray(current) ? [] : "" });
      delete nextMarks[field];
    }
  }
  return { answers: next, marks: nextMarks };
}

// Fields AI may suggest, and the step that shows each one
export const SUGGESTIBLE: Partial<Record<keyof IntakeAnswers, StepId>> = {
  category: "sell",
  offeringKinds: "sell",
  state: "place",
  owners: "owners",
  stage: "status",
  registeredAs: "status",
  channels: "channels",
  premises: "premises",
};

export type SuggestibleField = keyof typeof SUGGESTIBLE;

// Fills only unanswered questions, and follow-ups only where they're asked; returns which it filled
export function applySuggestion(
  a: IntakeAnswers,
  s: IntakeSuggestion,
): { answers: IntakeAnswers; applied: SuggestibleField[] } {
  const fills: Partial<IntakeAnswers> = {};
  if (s.category && !a.category) fills.category = s.category;
  if (s.state && !a.state) fills.state = s.state;
  if (s.owners && !a.owners) fills.owners = s.owners;
  if (s.stage && !a.stage) fills.stage = s.stage;
  const kind = categoryFor(fills.category ?? a.category)?.kind;
  // Models can repeat a pick; the profile allows each once
  const extraKinds = [...new Set(s.offeringKinds)].filter((k) => k !== kind);
  if (extraKinds.length && !a.offeringKinds.length) fills.offeringKinds = extraKinds;
  if (s.channels.length && !a.channels.length) fills.channels = [...new Set(s.channels)];
  if (s.premises && !a.premises) fills.premises = s.premises;
  const filled = { ...a, ...fills };
  if (s.registeredAs && !a.registeredAs && asks("registeredAs", filled)) fills.registeredAs = s.registeredAs;
  return { answers: { ...a, ...fills }, applied: Object.keys(fills) as SuggestibleField[] };
}

// What the owner typed beyond the picked examples, joined after them
function sellsText(a: IntakeAnswers): string {
  return [examplesText(a.category, a.productTags), a.firstItems.trim()].filter(Boolean).join(", ").slice(0, 300);
}

function shipsFromHandoff(handoff: readonly Handoff[]): YesNo {
  if (handoff.some((method) => method === "ship_in_state" || method === "ship_out_of_state")) return "yes";
  return handoff.includes("unsure") ? "unsure" : "no";
}

// Unvalidated: the server checks the result against businessProfileSchema
export function answersToProfile(a: IntakeAnswers) {
  const followUp = <T extends string>(field: FollowUp, value: T | "") => (asks(field, a) && value ? value : null);
  const followUps = <T extends string>(field: FollowUp, value: T[]) => (asks(field, a) ? value : []);
  const handoff = followUps("handoff", a.handoff);
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
    offeringKinds: kindsOf(a),
    firstItems: sellsText(a),
    foodNeedsCold: followUp("foodNeedsCold", a.foodNeedsCold),
    channels: a.channels,
    shipsOrders: handoff.length ? shipsFromHandoff(handoff) : followUp("shipsOrders", a.shipsOrders),
    premises: a.premises || null,
    customersVisit: followUp("customersVisit", a.customersVisit),
    startupBudget: a.startupBudget || null,
    hiringPlans: a.hiringPlans || null,
    experience: a.experience || null,
    launchTiming: a.launchTiming || null,
    launchDate: a.launchDate || null,
    category: a.category || null,
    productTags: categoryFor(a.category)?.examples.filter((example) => a.productTags.includes(example.id)).map((example) => example.id) ?? [],
    ownerRelation: followUp("ownerRelation", a.ownerRelation),
    mayAddOwners: followUp("mayAddOwners", a.mayAddOwners),
    nameIsLegalName: followUp("nameIsLegalName", a.nameIsLegalName),
    alreadyHave: followUps("alreadyHave", a.alreadyHave),
    handoff,
    makesForKids: followUp("makesForKids", a.makesForKids),
    foodContact: followUp("foodContact", a.foodContact),
    inventorySources: followUps("inventorySources", a.inventorySources),
    servicesLicensed: followUp("servicesLicensed", a.servicesLicensed),
    firstYearSales: a.firstYearSales || null,
    takesOnDebt: a.takesOnDebt || null,
    helpKinds: followUps("helpKinds", a.helpKinds),
    goals: a.goals,
  };
}

export function profileToAnswers(p: BusinessProfile): IntakeAnswers {
  const picked = examplesText(p.category, p.productTags);
  // The saved list starts with the picked examples; only the owner's own words go back in the box
  const typed = !picked ? p.firstItems : p.firstItems === picked ? "" : p.firstItems.startsWith(`${picked}, `) ? p.firstItems.slice(picked.length + 2) : p.firstItems;
  return {
    description: p.description,
    category: p.category ?? "",
    productTags: p.productTags,
    name: p.name ?? "",
    noName: p.name === null,
    nameIsLegalName: p.nameIsLegalName ?? "",
    state: p.location.state,
    county: p.location.county,
    city: p.location.city,
    insideCityLimits: p.location.insideCityLimits ?? "",
    owners: p.owners.count > 1 ? "others" : "me",
    ownerCount: Math.max(2, p.owners.count),
    ownerRelation: p.ownerRelation ?? "",
    mayAddOwners: p.mayAddOwners ?? "",
    stage: p.stage ?? "",
    registeredAs: p.registeredAs ?? "",
    alreadyHave: p.alreadyHave,
    offeringKinds: p.offeringKinds,
    firstItems: typed,
    foodNeedsCold: p.foodNeedsCold ?? "",
    makesForKids: p.makesForKids ?? "",
    foodContact: p.foodContact ?? "",
    inventorySources: p.inventorySources,
    servicesLicensed: p.servicesLicensed ?? "",
    channels: p.channels,
    handoff: p.handoff,
    shipsOrders: p.shipsOrders ?? "",
    premises: p.premises ?? "",
    customersVisit: p.customersVisit ?? "",
    startupBudget: p.startupBudget ?? "",
    firstYearSales: p.firstYearSales ?? "",
    takesOnDebt: p.takesOnDebt ?? "",
    hiringPlans: p.hiringPlans ?? "",
    helpKinds: p.helpKinds,
    launchTiming: p.launchTiming ?? "",
    launchDate: p.launchDate ?? "",
    experience: p.experience ?? "",
    goals: p.goals,
  };
}

// What stops Continue on a step; null when the step is complete enough
export function stepProblem(step: StepId, a: IntakeAnswers): string | null {
  switch (step) {
    case "sell":
      if (!a.category) return "Pick the kind of business closest to yours. “Something else” works too.";
      if (a.category === "resale_shop" && !a.productTags.length && !a.firstItems.trim()) return "Say what kind of shop it is, or pick what you’ll sell.";
      return kindsOf(a).length ? null : "Pick at least one kind of thing you’ll sell.";
    case "name":
      return a.noName || a.name.trim() ? null : "Enter a name, or tick “I haven’t picked a name yet”.";
    case "place":
      return a.state ? null : "Choose your state. Requirements depend on it.";
    case "owners":
      if (!a.owners) return "Choose who owns the business.";
      return a.owners === "others" && (a.ownerCount < 2 || a.ownerCount > MAX_OWNERS)
        ? `Enter between 2 and ${MAX_OWNERS} owners.`
        : null;
    case "channels":
      return a.channels.length ? null : "Pick at least one way you’ll sell.";
    case "timing":
      return !a.launchDate || /^\d{4}-\d{2}-\d{2}$/.test(a.launchDate) ? null : "Enter the date as month, day and year, or tick “I don’t have a date yet”.";
    default:
      return null;
  }
}

// "undecided": the owner chose "not sure" or "not yet", which is an answer, never a "no"; "unanswered": skipped
export type AnswerState = "answered" | "undecided" | "unanswered";

export interface SummaryRow {
  label: string;
  value: string;
  step: StepId;
  // Answers shown in this row, for marking suggestions
  fields: (keyof IntakeAnswers)[];
  followUp?: true;
  state: AnswerState;
  // The owner said "not sure" to at least part of it: an open question, never a "no"
  unsure?: true;
}

const isUnsure = (value: string | readonly string[]) => (Array.isArray(value) ? value.includes("unsure") : value === "unsure");
const stateOf = (value: string, unsure: boolean): AnswerState => (unsure ? "undecided" : value ? "answered" : "unanswered");

// Shown above each kind of open question
export const UNDECIDED_NOTE = "You haven’t decided these yet, and that’s an answer. SnapStart never reads it as “no”: steps that depend on it stay in your plan.";
export const UNANSWERED_NOTE = "You skipped these. We won’t guess: your requirements show what depends on them.";

// How a row's answer reads wherever answers are listed
export function answerText(row: Pick<SummaryRow, "value" | "state">): string {
  return row.value || (row.state === "undecided" ? "Not decided yet" : "Not answered");
}

// Short summaries leave out follow-ups; the review and the business page ask for them
export function summarize(a: IntakeAnswers, options: { followUps?: boolean } = {}): SummaryRow[] {
  const place = [a.city.trim(), countyLabel(a.county), a.state ? STATE_NAMES[a.state] : ""].filter(Boolean).join(", ");
  const category = categoryFor(a.category);
  const extraKinds = kindsOf(a)
    .filter((kind) => kind !== category?.kind)
    .map((kind) => OFFERING_KIND_LABELS[kind]);
  const sells = [category && category.id !== "other" ? category.label : "", ...extraKinds].filter(Boolean).join(", ");
  const yesNo = (value: YesNo) => (value ? YES_NO_LABELS[value] : "");
  const list = <K extends string>(labels: Record<K, string>, values: readonly K[]) => values.map((value) => labels[value]).join(", ");
  const followUp = (field: FollowUp, label: string, value: string, step: StepId): SummaryRow[] =>
    options.followUps && asks(field, a)
      ? [{ label, value, step, fields: [field], followUp: true, state: stateOf(value, isUnsure(a[field])), ...(isUnsure(a[field]) ? { unsure: true as const } : {}) }]
      : [];
  const row = (label: string, value: string, step: StepId, fields: (keyof IntakeAnswers)[], undecided = false): SummaryRow => {
    const unsure = undecided || fields.some((field) => isUnsure(a[field] as string | string[]));
    return { label, value, step, fields, state: stateOf(value, unsure), ...(unsure ? { unsure: true as const } : {}) };
  };

  return [
    row("What you’ll sell", [sells, sellsText(a)].filter(Boolean).join(": "), "sell", ["category", "productTags", "offeringKinds", "firstItems"]),
    ...(options.followUps && a.description.trim() ? [row("In your own words", a.description.trim(), "sell", ["description"])] : []),
    row("Where", place, "place", ["state", "county", "city"]),
    ...followUp("insideCityLimits", "Inside city limits", yesNo(a.insideCityLimits), "place"),
    row("Owners", a.owners === "me" ? "Just you" : a.owners === "others" ? `${a.ownerCount} owners` : "", "owners", ["owners", "ownerCount"]),
    ...followUp("ownerRelation", "Who the owners are", a.ownerRelation ? OWNER_RELATION_LABELS[a.ownerRelation] : "", "owners"),
    ...followUp("mayAddOwners", "Might add a co-owner", yesNo(a.mayAddOwners), "owners"),
    row("Business name", a.noName ? "Not picked yet" : a.name.trim(), "name", ["name", "noName"], a.noName),
    ...followUp("nameIsLegalName", "Name is your own legal name", yesNo(a.nameIsLegalName), "name"),
    row("Where you are now", a.stage ? STAGE_LABELS[a.stage] : "", "status", ["stage"]),
    ...followUp("registeredAs", "Registered as", a.registeredAs ? REGISTERED_AS_LABELS[a.registeredAs] : "", "status"),
    ...followUp("alreadyHave", "Already have", list(EXISTING_SETUP_LABELS, a.alreadyHave), "status"),
    row("How you’ll sell", list(CHANNEL_LABELS, a.channels), "channels", ["channels"]),
    ...followUp("handoff", "How customers get orders", list(HANDOFF_LABELS, a.handoff), "channels"),
    ...followUp("shipsOrders", "Shipping orders", yesNo(a.shipsOrders), "channels"),
    ...followUp("foodNeedsCold", "Food kept cold", yesNo(a.foodNeedsCold), "details"),
    ...followUp("makesForKids", "Made for children", yesNo(a.makesForKids), "details"),
    ...followUp("foodContact", "Items that touch food", yesNo(a.foodContact), "details"),
    ...followUp("inventorySources", "Where your stock comes from", list(INVENTORY_SOURCE_LABELS, a.inventorySources), "details"),
    ...followUp("servicesLicensed", "Work that needs a personal license", yesNo(a.servicesLicensed), "details"),
    row("Where you’ll work", a.premises ? PREMISES_LABELS[a.premises] : "", "premises", ["premises"]),
    ...followUp("customersVisit", "Customers at your home", yesNo(a.customersVisit), "premises"),
    row("Starting budget", a.startupBudget ? BUDGET_LABELS[a.startupBudget] : "", "money", ["startupBudget"]),
    ...(options.followUps
      ? [
          row("First-year sales", a.firstYearSales ? SALES_LABELS[a.firstYearSales] : "", "money", ["firstYearSales"]),
          row("Lease, loan or credit", yesNo(a.takesOnDebt), "money", ["takesOnDebt"]),
        ]
      : []),
    row("Hiring", a.hiringPlans ? HIRING_LABELS[a.hiringPlans] : "", "help", ["hiringPlans"]),
    ...followUp("helpKinds", "Kind of help", list(HELP_KIND_LABELS, a.helpKinds), "help"),
    row(
      "Goal launch date",
      a.launchDate ? formatLaunchDate(a.launchDate) : a.launchTiming === "unsure" ? "No date yet" : a.launchTiming ? LAUNCH_TIMING_LABELS[a.launchTiming] : "",
      "timing",
      a.launchDate ? ["launchDate"] : ["launchDate", "launchTiming"],
    ),
    row("Run a business before", a.experience ? EXPERIENCE_LABELS[a.experience] : "", "timing", ["experience"]),
    ...(options.followUps ? [row("Your goals", list(GOAL_LABELS, a.goals), "timing", ["goals"])] : []),
  ];
}

// "Dec 1, 2026"; a date with no time, so never shifted by time zone
export function formatLaunchDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// Same answers in any pick order compare equal
export function sameAnswers(a: IntakeAnswers, b: IntakeAnswers): boolean {
  const comparable = (answers: IntakeAnswers) =>
    JSON.stringify(Object.entries(answersToProfile(answers)).map(([key, value]) => [key, Array.isArray(value) ? [...value].sort() : value]));
  return comparable(a) === comparable(b);
}

// Confirmed answers, ones filled in for the owner to check, ones not decided yet and skipped ones, kept apart
export function groupRows(rows: SummaryRow[], marks: Marks = {}) {
  const marked = (row: SummaryRow) => row.fields.some((field) => marks[field]);
  const unmarked = rows.filter((row) => !marked(row));
  return {
    check: rows.filter((row) => row.value && marked(row)),
    undecided: unmarked.filter((row) => row.state === "undecided"),
    unanswered: unmarked.filter((row) => row.state === "unanswered"),
    // Both kinds of open question
    open: unmarked.filter((row) => row.state !== "answered"),
    confirmed: unmarked.filter((row) => row.state === "answered"),
  };
}

// Unnamed businesses get their state so owners can tell them apart
export function displayName(profile: BusinessProfile | null): string {
  if (!profile) return "Business with answers to update";
  return profile.name ?? `Unnamed business in ${STATE_NAMES[profile.location.state]}`;
}
