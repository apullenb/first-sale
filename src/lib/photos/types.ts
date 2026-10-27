import { z } from "zod";

// Product photos: the owner's upload, the AI check before editing, and the review of each edited version

export const PHOTO_CATEGORIES = ["clothing", "handmade", "food", "other"] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export const PHOTO_LOOKS = ["studio", "white", "boutique", "lifestyle", "seasonal"] as const;
export type PhotoLook = (typeof PHOTO_LOOKS)[number];

export const PHOTO_CROPS = ["square", "portrait", "landscape"] as const;
export type PhotoCrop = (typeof PHOTO_CROPS)[number];

export const PHOTO_PROBLEMS = ["blur", "obstruction", "too_small", "cut_off", "too_dark", "glare", "other"] as const;
export type PhotoProblem = (typeof PHOTO_PROBLEMS)[number];

export const REVIEW_FLAGS = ["text_or_logo", "color", "quantity", "shape", "added_item", "missing_detail", "other"] as const;
export type ReviewFlag = (typeof REVIEW_FLAGS)[number];

const short = (max: number) => z.string().max(max);

export const photoCheckReplySchema = z.object({
  usable: z.boolean(),
  problems: z.array(z.object({ kind: z.enum(PHOTO_PROBLEMS), detail: short(300) })).max(8),
  retakeTips: z.array(short(240)).max(6),
  summary: short(300),
  category: z.enum(PHOTO_CATEGORIES),
  objects: z.array(z.object({ name: z.string().min(1).max(100), likelyForSale: z.boolean() })).max(10),
  keep: z.object({
    colors: z.array(short(100)).max(10),
    materials: z.array(short(100)).max(10),
    // Where lettering or logos are and what they are, not a transcription
    textAndLogos: z.array(short(200)).max(10),
    quantity: short(160),
    details: z.array(short(200)).max(12),
  }),
  question: short(240).nullable(),
});
export type PhotoCheckReply = z.infer<typeof photoCheckReplySchema>;

export interface PhotoCheck extends PhotoCheckReply {
  checkedAt: string;
  // "skipped": no model that can see photos is connected, so the owner answers instead
  method: "ai" | "skipped";
  simulated: boolean;
}

export const photoCompareReplySchema = z.object({
  flags: z.array(z.object({ kind: z.enum(REVIEW_FLAGS), detail: short(300) })).max(10),
});

export interface PhotoReview {
  checkedAt: string;
  // "skipped": a practice preview, or no model that can see photos; "failed": the check errored
  method: "ai" | "skipped" | "failed";
  flags: { kind: ReviewFlag; detail: string }[];
}
