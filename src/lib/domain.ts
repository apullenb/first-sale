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
export const MAX_BUSINESSES_PER_OWNER = 20;

const text = (max: number) => z.string().trim().max(max);

// Pick-many answers: at least one, each option once
const picks = <T extends readonly [string, ...string[]]>(options: T) =>
  z
    .array(z.enum(options))
    .min(1)
    .max(options.length)
    .refine((list) => new Set(list).size === list.length, "Each option can be picked once");

// What intake saves. The state, owners, kinds and channels drive requirements, so they're required.
export const businessProfileSchema = z.object({
  // Null until the owner picks a name
  name: text(100).min(1).nullable(),
  description: text(1000),
  location: z.object({
    state: z.enum(US_STATE_CODES),
    county: text(100),
    city: text(100),
  }),
  owners: z.object({ count: z.number().int().min(1).max(MAX_OWNERS) }),
  offeringKinds: picks(OFFERING_KINDS),
  firstItems: text(300),
  channels: picks(SELLING_CHANNELS),
  premises: z.enum(PREMISES).nullable(),
  startupBudget: z.enum(BUDGET_RANGES).nullable(),
  hiringPlans: z.enum(HIRING_PLANS).nullable(),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

// Shape the research step asks the model for; sourceIds point at retrieved sources.
export const requirementDraftSchema = z.object({
  title: z.string(),
  whyItApplies: z.string(),
  level: z.enum(JURISDICTION_LEVELS),
  sourceIds: z.array(z.string()),
  // Kept only if the amount appears in a fetched page's text
  feeUsd: z.number().nonnegative().nullable(),
  needsProfessional: z.boolean(),
});
export type RequirementDraft = z.infer<typeof requirementDraftSchema>;

export const VERIFICATION_STATES = ["sourced", "needs_verification"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const TASK_STATUSES = ["todo", "done"] as const;
export const DRAFT_KINDS = ["listing", "social_post", "order_reply", "role_description"] as const;
export const DRAFT_STATUSES = ["draft", "approved", "exported"] as const;
export const FULFILLMENT_METHODS = ["pickup", "shipping", "delivery"] as const;
export const ORDER_STATUSES = ["new", "confirmed", "needs_review", "fulfilled", "cancelled"] as const;
// Who did each step, shown on every order's timeline
export const ACTORS = ["rule", "ai", "owner"] as const;
export type Actor = (typeof ACTORS)[number];
