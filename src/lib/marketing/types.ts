import { z } from "zod";
import { MARKETING_PLATFORMS, type MarketingPlatformId, SKILL_AREAS, type SkillArea } from "@/data/marketing-platforms";

// The marketing plan as AI drafts it, as it's stored, and the steps rules build from it.
// Stored plans are read leniently, so sections added later still load older plans.

const line = (max: number) => z.string().max(max);

export const PLATFORM_ROLES = ["main", "support", "later", "suggested"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ROLE_LABELS: Record<PlatformRole, string> = {
  main: "Focus here first",
  support: "Also use",
  later: "Add later",
  suggested: "Worth a look",
};

export const marketingPlanReplySchema = z.object({
  summary: line(700),
  goals: z.array(z.object({ goal: line(200), measure: line(200) })).min(1).max(4),
  audience: z.object({ who: line(400), where: line(400), cares: line(400) }),
  platforms: z
    .array(z.object({ platform: z.enum(MARKETING_PLATFORMS), role: z.enum(PLATFORM_ROLES), why: line(400), cadence: line(200) }))
    .max(MARKETING_PLATFORMS.length),
  themes: z.array(z.object({ title: line(80), idea: line(300), examples: z.array(line(200)).max(4) })).min(1).max(5),
  rhythm: line(500),
  firstActions: z
    .array(
      z.object({
        title: line(120),
        why: line(300),
        area: z.enum(SKILL_AREAS),
        platform: z.enum(MARKETING_PLATFORMS).nullable(),
        how: z.array(line(240)).min(1).max(6),
      }),
    )
    .min(1)
    .max(6),
});
export type MarketingPlanReply = z.infer<typeof marketingPlanReplySchema>;
export type PlanPlatform = MarketingPlanReply["platforms"][number];
export type FirstAction = MarketingPlanReply["firstActions"][number];

export interface MarketingPlan extends MarketingPlanReply {
  version: 1;
  generatedAt: string;
  simulated: boolean;
  // The answers it was written from (intakeKey), to flag it when they change
  intakeKey: string;
  // Dollar amounts the owner didn't give, for them to check
  flags: string[];
}

const storedPlanSchema = marketingPlanReplySchema.extend({
  version: z.literal(1).catch(1),
  generatedAt: z.string(),
  simulated: z.boolean().catch(false),
  intakeKey: z.string().catch(""),
  flags: z.array(z.string()).catch([]),
});

// Null when a stored plan can't be read; the owner writes it again
export function readPlan(raw: unknown): MarketingPlan | null {
  const parsed = storedPlanSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export interface StepLink {
  label: string;
  href: string;
  // Another site, opened in a new tab
  external: boolean;
  // The platform's own help page, rather than the place to do the step
  guide: boolean;
}

export const STEP_KINDS = ["look", "brand_images", "setup", "tidy", "photos", "posts", "search", "action"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export interface MarketingStep {
  // Stable across rebuilds, so ticks carry over
  key: string;
  kind: StepKind;
  title: string;
  why: string;
  area: SkillArea;
  platform: MarketingPlatformId | null;
  // The full walk-through, for owners new to this area
  how: string[];
  // A short checklist, for owners who know it
  short: string[];
  links: StepLink[];
  by: "rule" | "ai";
  // Steps SnapStart couldn't compare with the platform's own guide
  general: boolean;
  // From a plan drafted in practice mode
  practice: boolean;
}

// The step's place on the page, for "go to this step" links
export function stepAnchor(key: string): string {
  return `step-${key.replace(/[^a-z0-9-]/gi, "-")}`;
}

// How much help a step gets, from the owner's answer for its area
export const HAND_HOLDING = ["walkthrough", "guided", "checklist"] as const;
export type HandHolding = (typeof HAND_HOLDING)[number];
