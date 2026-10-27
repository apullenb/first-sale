// One-click words and questions for how a brand should feel. Owners pick; they never write a description from scratch.

export const VIBE_GROUPS = {
  "From another time": ["vintage", "retro ’50s diner", "groovy ’70s", "retro ’80s", "’90s throwback", "mid-century modern", "art deco", "old-world", "timeless"],
  "A place": [
    "farmhouse",
    "rustic",
    "western",
    "cabin in the woods",
    "coastal",
    "beach shack",
    "tropical",
    "desert",
    "garden cottage",
    "Southern porch",
    "small-town main street",
    "big-city loft",
    "Parisian café",
    "Scandinavian",
  ],
  "A mood": [
    "cozy",
    "warm",
    "cheerful",
    "playful",
    "whimsical",
    "calm",
    "dreamy",
    "romantic",
    "bold",
    "edgy",
    "adventurous",
    "earthy",
    "wholesome",
    "nostalgic",
    "luxurious",
    "elegant",
    "quirky",
    "sporty",
  ],
  "A look": [
    "neon vibes",
    "minimal",
    "hand-drawn",
    "bright and colorful",
    "soft pastels",
    "dark and moody",
    "black and white",
    "botanical",
    "geometric",
    "grunge",
    "glam",
    "natural and organic",
    "futuristic",
  ],
} as const;

export const VIBES = [
  ...VIBE_GROUPS["From another time"],
  ...VIBE_GROUPS["A place"],
  ...VIBE_GROUPS["A mood"],
  ...VIBE_GROUPS["A look"],
] as const;
export type Vibe = (typeof VIBES)[number];
export const VIBE_LIMITS = { min: 3, max: 8 } as const;

// This-or-that questions; null means either is fine
export const LEANINGS = {
  era: { question: "Old-fashioned or modern?", options: { old: "Old-fashioned", modern: "Modern" }, guidance: { old: "a vintage, well-loved feel", modern: "a clean, current feel" } },
  tone: { question: "Playful or serious?", options: { playful: "Playful", serious: "Serious" }, guidance: { playful: "playful and light-hearted", serious: "serious and trustworthy" } },
  energy: { question: "Quiet or loud?", options: { quiet: "Calm and quiet", loud: "Loud and bold" }, guidance: { quiet: "calm and understated", loud: "loud, bold and eye-catching" } },
  finish: { question: "Handmade or polished?", options: { handmade: "Handmade", polished: "Polished" }, guidance: { handmade: "hand-drawn, crafted lines", polished: "crisp, precise lines" } },
} as const;
export type LeaningKey = keyof typeof LEANINGS;

// Swatches only illustrate the family; the creative director picks the exact colors
export const COLOR_FAMILIES = {
  "earthy browns": ["#7A4B2A", "#B07A4F", "#D9B48F"],
  "forest greens": ["#1F3A2E", "#3E6B48", "#8DB38B"],
  "sage and olive": ["#7D8B5E", "#A3B18A", "#DAD7CD"],
  "cool blues": ["#1D3557", "#457B9D", "#A8DADC"],
  "warm reds and oranges": ["#B23A2E", "#E4572E", "#F3A65A"],
  "sunny yellows": ["#E9B824", "#F6D55C", "#FFF1B5"],
  "soft pastels": ["#F4C2C2", "#C9E4DE", "#D7C9F0"],
  "cream and neutrals": ["#F3EBDD", "#D8C8B0", "#8C7B6B"],
  "black and white": ["#111111", "#777777", "#FFFFFF"],
  "black and gold": ["#111111", "#B08D57", "#E5C882"],
  "jewel tones": ["#0F5257", "#5B2A86", "#9E2B25"],
  "neon brights": ["#FF2E88", "#00E5FF", "#C6FF00"],
} as const;
export type ColorFamily = keyof typeof COLOR_FAMILIES;
export const COLOR_FAMILY_NAMES = Object.keys(COLOR_FAMILIES) as [ColorFamily, ...ColorFamily[]];
export const MAX_COLOR_FAMILIES = 3;
