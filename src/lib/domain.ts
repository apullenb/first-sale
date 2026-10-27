import { z } from "zod";

// US only for now: 50 states plus DC.
export const US_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC",
  "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;
export type UsStateCode = (typeof US_STATE_CODES)[number];

export const JURISDICTION_LEVELS = ["federal", "state", "county", "city"] as const;
export type JurisdictionLevel = (typeof JURISDICTION_LEVELS)[number];

export const SELLING_CHANNELS = [
  "in_person",
  "markets",
  "storefront",
  "own_website",
  "marketplace",
  "social_media",
  "wholesale",
] as const;

export const PREMISES = ["home", "rented_space", "shared_kitchen", "online_only", "unsure"] as const;
export const OFFERING_KINDS = ["food", "handmade", "resale", "services", "other"] as const;
export const BUDGET_RANGES = ["under_1k", "1k_5k", "5k_25k", "over_25k", "unsure"] as const;
export const HIRING_PLANS = ["not_now", "first_year", "right_away"] as const;
export const MAX_OWNERS = 10;
export const YES_NO_UNSURE = ["yes", "no", "unsure"] as const;
export const BUSINESS_STAGES = ["idea", "selling_informally", "registered"] as const;
export const BUSINESS_STRUCTURES = ["sole_proprietorship", "llc", "partnership", "corporation"] as const;
export type BusinessStructure = (typeof BUSINESS_STRUCTURES)[number];
export const REGISTERED_AS = [...BUSINESS_STRUCTURES, "unsure"] as const;
export const EXPERIENCE_LEVELS = ["first_business", "some", "experienced"] as const;
export const LAUNCH_TIMINGS = ["within_1_month", "1_3_months", "3_6_months", "later", "unsure"] as const;

const text = (max: number) => z.string().trim().max(max);

// Pick-many answers: at least one, each option once
const picks = <T extends readonly [string, ...string[]]>(options: T) =>
  z
    .array(z.enum(options))
    .min(1)
    .max(options.length)
    .refine((list) => new Set(list).size === list.length, "Each option can be picked once");

const yesNoUnsure = z.enum(YES_NO_UNSURE).nullable().default(null);

// What intake saves. The state, owners, kinds and channels drive requirements, so they're required.
// Later questions default to null, so answers saved before they existed still load.
export const businessProfileSchema = z.object({
  // Null until the owner picks a name
  name: text(100).min(1).nullable(),
  description: text(1000),
  country: z.literal("US").default("US"),
  location: z.object({
    state: z.enum(US_STATE_CODES),
    county: text(100),
    city: text(100),
    // City rules apply only inside city limits; a mailing address alone doesn't say
    insideCityLimits: yesNoUnsure,
  }),
  owners: z.object({ count: z.number().int().min(1).max(MAX_OWNERS) }),
  stage: z.enum(BUSINESS_STAGES).nullable().default(null),
  // Only when stage is "registered"
  registeredAs: z.enum(REGISTERED_AS).nullable().default(null),
  offeringKinds: picks(OFFERING_KINDS),
  firstItems: text(300),
  // Follow-ups asked only when they matter: food, shipping, customers at home
  foodNeedsCold: yesNoUnsure,
  channels: picks(SELLING_CHANNELS),
  shipsOrders: yesNoUnsure,
  premises: z.enum(PREMISES).nullable(),
  customersVisit: yesNoUnsure,
  startupBudget: z.enum(BUDGET_RANGES).nullable(),
  hiringPlans: z.enum(HIRING_PLANS).nullable(),
  experience: z.enum(EXPERIENCE_LEVELS).nullable().default(null),
  launchTiming: z.enum(LAUNCH_TIMINGS).nullable().default(null),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

// Separate topics in the startup plan: never merged into one step
export const PLAN_TOPICS = [
  "structure",
  "name_registration",
  "tax_registration",
  "license_permit",
  "location_zoning",
  "employer",
  "other",
] as const;
export type PlanTopic = (typeof PLAN_TOPICS)[number];

// Shape the research step asks the model for; sourceIds point at retrieved sources.
export const requirementDraftSchema = z.object({
  // Short id, reused across re-checks so plan progress carries over
  key: z.string().min(1).max(60),
  title: z.string().min(1).max(200),
  topic: z.enum(PLAN_TOPICS),
  whyItApplies: z.string().max(1000),
  level: z.enum(JURISDICTION_LEVELS),
  // The office responsible, such as "Ohio Secretary of State"
  agency: z.string().max(200),
  sourceIds: z.array(z.string()).max(5),
  // Word for word from a cited page; checked in code
  evidence: z.string().max(600).nullable(),
  // Fee and deadline are kept only if they appear in a cited page's text
  feeUsd: z.number().nonnegative().nullable(),
  deadline: z.string().max(200).nullable(),
  needsProfessional: z.boolean(),
  whoToCall: z.string().max(200),
  whatToAsk: z.array(z.string().max(300)).max(6),
  // Information and documents to have ready
  gather: z.array(z.string().max(200)).max(8),
  doneWhen: z.string().max(300),
  // Keys of requirements to finish first
  dependsOn: z.array(z.string().max(60)).max(5),
});
export type RequirementDraft = z.infer<typeof requirementDraftSchema>;

export const VERIFICATION_STATES = ["sourced", "needs_verification"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const TASK_STATUSES = ["todo", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DOCUMENT_ORIGINS = ["upload", "paste", "official_form", "generated"] as const;
export type DocumentOrigin = (typeof DOCUMENT_ORIGINS)[number];
export const GENERATED_KINDS = ["business_plan", "filled_form", "answer_sheet", "startup_plan"] as const;
export type GeneratedKind = (typeof GENERATED_KINDS)[number];
export const DRAFT_KINDS = ["listing", "social_post", "order_reply", "role_description"] as const;
export const DRAFT_STATUSES = ["draft", "approved", "exported"] as const;
export const FULFILLMENT_METHODS = ["pickup", "shipping", "delivery"] as const;
export const ORDER_STATUSES = ["new", "confirmed", "needs_review", "fulfilled", "cancelled"] as const;
// Who did each step, shown on every order's timeline
export const ACTORS = ["rule", "ai", "owner"] as const;
export type Actor = (typeof ACTORS)[number];
