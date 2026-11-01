import { z } from "zod";

// Business insights: what the model returns, and what's saved after the code checks

export const INSIGHT_PAGES = [
  "business",
  "requirements",
  "structure",
  "checklist",
  "documents",
  "business_plan",
  "logo",
  "brand",
  "website",
  "photos",
] as const;
export type InsightPage = (typeof INSIGHT_PAGES)[number];

export const INSIGHT_SECTIONS = ["strengths", "watch", "tips", "ideas"] as const;
export type InsightSection = (typeof INSIGHT_SECTIONS)[number];

// Schema limits are loose; code trims to the caps in checks.ts
const itemSchema = z.object({
  title: z.string().max(120),
  detail: z.string().max(800),
  // One small next step; required for things to keep an eye on
  action: z.string().max(300),
  link: z.enum(INSIGHT_PAGES).nullable(),
  // A startup-plan step's key, when the item is about one step
  stepKey: z.string().max(80).nullable(),
});
export type InsightReplyItem = z.infer<typeof itemSchema>;

export const insightsReplySchema = z.object({
  opening: z.string().max(500),
  strengths: z.array(itemSchema).max(8),
  watch: z.array(itemSchema).max(8),
  tips: z.array(itemSchema).max(8),
  ideas: z.array(itemSchema).max(8),
});
export type InsightsReply = z.infer<typeof insightsReplySchema>;

export interface InsightLink {
  href: string;
  label: string;
}

export interface Insight {
  // Section plus the title in lower case, so feedback carries over to a refresh that repeats it
  key: string;
  section: InsightSection;
  title: string;
  detail: string;
  action: string | null;
  link: InsightLink | null;
}

// Parts of what SnapStart knows, each hashed so the page can say what changed since
export const FACT_AREAS = ["answers", "plan", "decisions", "business_plan", "brand", "website", "photos"] as const;
export type FactArea = (typeof FACT_AREAS)[number];

export const FACT_AREA_LABELS: Record<FactArea, string> = {
  answers: "your business answers",
  plan: "what applies to you, and your licenses and registrations",
  decisions: "your structure decisions",
  business_plan: "your business plan",
  brand: "your branding",
  website: "your website",
  photos: "your product photos",
};

export interface SavedInsights {
  opening: string;
  items: Insight[];
  generatedAt: string;
  // Practice mode: sample insights from built-in rules
  simulated: boolean;
  basis: Partial<Record<FactArea, string>>;
  // Items the code checks took out
  removed: number;
}

export const INSIGHT_MARKS = ["useful", "dismissed"] as const;
export type InsightMark = (typeof INSIGHT_MARKS)[number];
// By insight key, with the title so a refresh can tell the model what the owner thought
export type InsightFeedback = Record<string, { mark: InsightMark; title: string; at: string }>;

const savedSchema = z.object({
  opening: z.string(),
  items: z.array(
    z.object({
      key: z.string(),
      section: z.enum(INSIGHT_SECTIONS),
      title: z.string(),
      detail: z.string(),
      action: z.string().nullable(),
      link: z.object({ href: z.string(), label: z.string() }).nullable(),
    }),
  ),
  generatedAt: z.string(),
  simulated: z.boolean(),
  basis: z.partialRecord(z.enum(FACT_AREAS), z.string()),
  removed: z.number(),
});

const feedbackSchema = z.record(z.string(), z.object({ mark: z.enum(INSIGHT_MARKS), title: z.string(), at: z.string() }));

// Stored JSON from an older shape reads as nothing, rather than breaking the page
export function readSavedInsights(raw: unknown): SavedInsights | null {
  const parsed = savedSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function readFeedback(raw: unknown): InsightFeedback {
  const parsed = feedbackSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}
