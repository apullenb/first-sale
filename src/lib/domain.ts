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

export const PREMISES = ["home", "rented_space", "shared_kitchen", "market_stall", "online_only"] as const;

// Filled in step by step during intake, so most fields can still be empty.
export const businessProfileSchema = z.object({
  name: z.string(),
  description: z.string(),
  location: z.object({
    state: z.enum(US_STATE_CODES).nullable(),
    county: z.string().nullable(),
    city: z.string().nullable(),
  }),
  owners: z.object({ count: z.number().int().min(1), notes: z.string() }),
  offerings: z.array(
    z.object({ name: z.string(), kind: z.enum(["product", "service"]), notes: z.string() }),
  ),
  channels: z.array(z.enum(SELLING_CHANNELS)),
  premises: z.enum(PREMISES).nullable(),
  startupBudgetUsd: z.number().nonnegative().nullable(),
  hiringPlans: z.string(),
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
