import { z } from "zod";
import { MARKETING_PLATFORMS, type SkillArea } from "@/data/marketing-platforms";

// The marketing questions: where to show up, how much the owner already knows, and what they've tried.

export const SKILL_LEVELS = ["new", "some", "confident"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const DONE_ALREADY = [
  "social_accounts",
  "posted",
  "website",
  "email_list",
  "flyers",
  "events",
  "word_of_mouth",
  "reviews",
  "ads",
  "none",
] as const;
export type DoneAlready = (typeof DONE_ALREADY)[number];

export const DONE_LABELS: Record<DoneAlready, string> = {
  social_accounts: "Made social media accounts for it",
  posted: "Posted about it",
  website: "Have a website or online shop",
  email_list: "Collect customer emails",
  flyers: "Flyers, cards or signs",
  events: "Markets, fairs or events",
  word_of_mouth: "Told friends and family",
  reviews: "Asked customers for reviews",
  ads: "Paid for ads",
  none: "Nothing yet",
};

export const MAX_DONE_NOTE = 300;

export interface SkillQuestion {
  area: SkillArea;
  title: string;
  why: string;
  options: Record<SkillLevel, { label: string; description: string }>;
}

export const SKILL_QUESTIONS: SkillQuestion[] = [
  {
    area: "social",
    title: "How familiar are you with social media?",
    why: "It sets how much step-by-step help you get setting up accounts.",
    options: {
      new: { label: "New to it", description: "I rarely use it, or not at all." },
      some: { label: "I use it for myself", description: "I post or scroll, but not for a business." },
      confident: { label: "Comfortable", description: "I’ve run accounts for a business or group." },
    },
  },
  {
    area: "seo",
    title: "How much do you know about SEO?",
    why: "SEO is helping people find you on Google and maps. Your answer sets how much help you get with it.",
    options: {
      new: { label: "What’s SEO?", description: "That’s fine. We’ll explain as we go." },
      some: { label: "I know the basics", description: "I’ve heard of it and know why it matters." },
      confident: { label: "I’ve done it before", description: "I’ve set up listings or tuned a site for search." },
    },
  },
  {
    area: "content",
    title: "How much marketing content have you made?",
    why: "It sets how much help you get making photos, videos and posts.",
    options: {
      new: { label: "None yet", description: "I haven’t made photos, videos or posts to sell things." },
      some: { label: "A little", description: "A few photos or posts, for me or a friend." },
      confident: { label: "A lot", description: "I make photos, videos or writing often." },
    },
  },
];

const platform = z.enum(MARKETING_PLATFORMS);
const unique = <T>(list: T[]) => new Set(list).size === list.length;
const platforms = z.array(platform).max(MARKETING_PLATFORMS.length).refine(unique, "Each platform can be picked once");

export const marketingIntakeSchema = z
  .object({
    include: platforms,
    // Accounts the owner already has; only ones they include
    have: platforms,
    // No interest at all: the plan never suggests these
    exclude: platforms,
    social: z.enum(SKILL_LEVELS),
    seo: z.enum(SKILL_LEVELS),
    content: z.enum(SKILL_LEVELS),
    done: z
      .array(z.enum(DONE_ALREADY))
      .min(1)
      .max(DONE_ALREADY.length)
      .refine(unique, "Each answer can be picked once")
      .refine((list) => !list.includes("none") || list.length === 1, "“Nothing yet” can’t be picked with other answers"),
    doneNote: z.string().trim().max(MAX_DONE_NOTE),
  })
  .refine((intake) => !intake.include.some((id) => intake.exclude.includes(id)), "A platform can’t be both in and out")
  .refine((intake) => intake.have.every((id) => intake.include.includes(id)), "Accounts you have must be ones you include");
export type MarketingIntake = z.infer<typeof marketingIntakeSchema>;

// Saved answers read back leniently, so questions added later don't break older answers
const storedSchema = z.object({
  include: z.array(platform).catch([]),
  have: z.array(platform).catch([]),
  exclude: z.array(platform).catch([]),
  social: z.enum(SKILL_LEVELS).nullable().catch(null),
  seo: z.enum(SKILL_LEVELS).nullable().catch(null),
  content: z.enum(SKILL_LEVELS).nullable().catch(null),
  done: z.array(z.enum(DONE_ALREADY)).catch([]),
  doneNote: z.string().catch(""),
});
export type StoredIntake = z.infer<typeof storedSchema>;

export function readIntake(raw: unknown): StoredIntake | null {
  if (!raw || typeof raw !== "object") return null;
  return storedSchema.parse(raw);
}

// Every question answered, in the current shape
export function completeIntake(stored: StoredIntake | null): MarketingIntake | null {
  const parsed = marketingIntakeSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

// Changes when any answer that shapes the plan changes, so an older plan can be flagged
export function intakeKey(intake: MarketingIntake): string {
  const sorted = (list: readonly string[]) => [...list].sort().join(",");
  return [sorted(intake.include), sorted(intake.have), sorted(intake.exclude), intake.social, intake.seo, intake.content, sorted(intake.done), intake.doneNote].join("|");
}
