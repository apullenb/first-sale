import type { PhotoCategory, PhotoCrop, PhotoLook, PhotoProblem, ReviewFlag } from "./types";

// Owner-facing choices, and the scene each look asks for

export const DEFAULT_LOOK: PhotoLook = "studio";
export const DEFAULT_CROP: PhotoCrop = "square";

export const LOOKS: Record<PhotoLook, { label: string; hint: string; scene: (season: string) => string }> = {
  studio: {
    label: "Soft studio",
    hint: "A clean backdrop with soft, even light.",
    scene: () => "a clean, seamless studio backdrop in a light neutral tone, lit with soft, even, diffused light",
  },
  white: {
    label: "White background",
    hint: "Plain white, the usual look for an online store.",
    scene: () => "a plain, evenly lit white background with no props",
  },
  boutique: {
    label: "Warm boutique",
    hint: "Warm neutral tones, like a display in a small shop.",
    scene: () =>
      "a warm, neutral boutique setting: a softly lit surface in warm neutral tones such as linen, light wood or stone, with at most one or two simple props",
  },
  lifestyle: {
    label: "Lifestyle scene",
    hint: "A styled setting that suits what you sell.",
    scene: () => "a tasteful, realistic setting that suits this product, where it would naturally be used or displayed, with only a few simple props",
  },
  seasonal: {
    label: "Seasonal",
    hint: "A promotional setting for the time of year.",
    scene: (season) => `a tasteful ${season} promotional setting with a few simple seasonal props`,
  },
};

// Size sets the shape only; the image service decides the pixel size
export const CROPS: Record<PhotoCrop, { label: string; ratio: string; size: string }> = {
  square: { label: "Square", ratio: "1:1", size: "1024x1024" },
  portrait: { label: "Portrait", ratio: "4:5", size: "1024x1280" },
  landscape: { label: "Landscape", ratio: "4:3", size: "1280x960" },
};

export const CATEGORIES: Record<PhotoCategory, string> = {
  clothing: "Clothing or accessories",
  handmade: "Something handmade",
  food: "Food or drink",
  other: "Something else",
};

export const PROBLEM_LABELS: Record<PhotoProblem, string> = {
  blur: "Blurry",
  obstruction: "Something is in the way",
  too_small: "Too small",
  cut_off: "Cut off at the edge",
  too_dark: "Too dark",
  glare: "Glare",
  other: "Hard to see",
};

export const FLAG_LABELS: Record<ReviewFlag, string> = {
  text_or_logo: "Lettering or logo",
  color: "Color",
  quantity: "How many",
  shape: "Shape or size",
  added_item: "Something added",
  missing_detail: "Missing detail",
  other: "Other difference",
};

// Northern-hemisphere US seasons, by month
export function seasonFor(date: Date): string {
  const month = date.getUTCMonth();
  if (month === 11) return "winter holiday";
  if (month <= 1) return "winter";
  if (month <= 4) return "spring";
  if (month <= 7) return "summer";
  return "autumn";
}
