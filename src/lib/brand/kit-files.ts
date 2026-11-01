import { PROFILE_FACTS, USPTO } from "./sizes";

// The logo kit: every file made in the browser from the approved logo and versions, and where each one goes.
// Muse Image sets only the shape and always returns an opaque picture, so sizes and see-through files are made here.

export const KIT_CHECKED = "2026-10-28";

export const KIT_SOURCES = ["primary", "stacked", "profile", "solid"] as const;
export type KitSource = (typeof KIT_SOURCES)[number];

export const KIT_GROUPS = {
  main: { title: "Main logo", purpose: "For your website header, flyers, labels and documents." },
  stacked: { title: "Stacked logo", purpose: "For square and narrow spaces, such as stickers and signs." },
  icon: { title: "Icon", purpose: "Just the symbol, for small spaces." },
  one_color: { title: "One color", purpose: "For stamps, embroidery and printing in one ink, and for dark backgrounds." },
  website: { title: "Website icons", purpose: "The little picture in browser tabs and on phone home screens." },
  social: { title: "Social profile pictures", purpose: "Square pictures that sites crop to a circle." },
} as const;
export type KitGroup = keyof typeof KIT_GROUPS;

export interface Citation {
  name: string;
  url: string;
  checked: string;
}

const GOOGLE_FAVICON: Citation = {
  name: "Google Search Central: Define a favicon to show in search results",
  url: "https://developers.google.com/search/docs/appearance/favicon-in-search",
  checked: KIT_CHECKED,
};
const WEB_MANIFEST: Citation = { name: "web.dev: Add a web app manifest", url: "https://web.dev/articles/add-manifest", checked: KIT_CHECKED };
const APPLE_TOUCH: Citation = {
  name: "Apple: Configuring Web Applications (Safari Web Content Guide)",
  url: "https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html",
  checked: KIT_CHECKED,
};
const FACEBOOK: Citation = { ...PROFILE_FACTS.source, checked: "2026-10-27" };
const YOUTUBE: Citation = { name: "YouTube Help: Manage your channel branding", url: "https://support.google.com/youtube/answer/10456525", checked: KIT_CHECKED };

export interface KitRecipe {
  id: string;
  group: KitGroup;
  label: string;
  // Owner-facing: where to use it
  use: string;
  source: KitSource;
  // Exact pixel size; null keeps the artwork's own size
  size: { width: number; height: number } | null;
  background: "white" | "transparent" | "dark";
  color: "original" | "ink" | "white";
  // Crop to the artwork, with this share of the side left empty all round; null keeps the whole picture
  trim: number | null;
  format: "png" | "ico";
  icoSizes?: number[];
  // Download name, before the extension
  file: string;
  citation?: Citation;
}

const square = (side: number) => ({ width: side, height: side });

export const KIT_RECIPES: KitRecipe[] = [
  { id: "main-clear", group: "main", label: "See-through background", use: "Sits on any color or photo: websites, Canva, documents.", source: "primary", size: null, background: "transparent", color: "original", trim: 0.06, format: "png", file: "logo - see-through" },
  { id: "main-white", group: "main", label: "White background", use: "For places that don’t take see-through files.", source: "primary", size: null, background: "white", color: "original", trim: 0.1, format: "png", file: "logo - white background" },
  { id: "stacked-clear", group: "stacked", label: "See-through background", use: "Square spaces on any background.", source: "stacked", size: null, background: "transparent", color: "original", trim: 0.06, format: "png", file: "stacked logo - see-through" },
  { id: "stacked-white", group: "stacked", label: "White background", use: "For places that don’t take see-through files.", source: "stacked", size: null, background: "white", color: "original", trim: 0.1, format: "png", file: "stacked logo - white background" },
  { id: "icon-clear", group: "icon", label: "See-through, 1024 × 1024", use: "Your symbol on its own, on any background.", source: "profile", size: square(1024), background: "transparent", color: "original", trim: 0.08, format: "png", file: "icon - see-through 1024x1024" },
  { id: "icon-white", group: "icon", label: "White background, 1024 × 1024", use: "Your symbol on its own, for places that need a solid square.", source: "profile", size: square(1024), background: "white", color: "original", trim: 0.12, format: "png", file: "icon - white background 1024x1024" },
  { id: "solid-ink", group: "one_color", label: "Dark, see-through", use: "Printing in one ink, stamps and embroidery.", source: "solid", size: null, background: "transparent", color: "ink", trim: 0.06, format: "png", file: "one color - dark see-through" },
  { id: "solid-white", group: "one_color", label: "White, see-through", use: "On dark backgrounds and photos.", source: "solid", size: null, background: "transparent", color: "white", trim: 0.06, format: "png", file: "one color - white see-through" },
  { id: "solid-on-dark", group: "one_color", label: "White on a dark background", use: "A ready-made dark version, on your darkest color, or near-black if all your colors are light.", source: "solid", size: null, background: "dark", color: "white", trim: 0.12, format: "png", file: "one color - white on dark" },
  {
    id: "favicon",
    group: "website",
    label: "favicon.ico (16, 32, 48 and 96 pixels)",
    use: "The icon in browser tabs. Most website builders have a “favicon” setting for it.",
    source: "profile",
    size: square(48),
    background: "transparent",
    color: "original",
    trim: 0.04,
    format: "ico",
    icoSizes: [16, 32, 48, 96],
    file: "favicon",
    citation: GOOGLE_FAVICON,
  },
  { id: "touch-180", group: "website", label: "Home-screen icon for iPhone, 180 × 180", use: "Shown when someone adds your website to an iPhone home screen.", source: "profile", size: square(180), background: "white", color: "original", trim: 0.14, format: "png", file: "apple-touch-icon 180x180", citation: APPLE_TOUCH },
  { id: "app-192", group: "website", label: "Home-screen icon, 192 × 192", use: "For Android phones and Chrome.", source: "profile", size: square(192), background: "white", color: "original", trim: 0.14, format: "png", file: "icon 192x192", citation: WEB_MANIFEST },
  { id: "app-512", group: "website", label: "Home-screen icon, 512 × 512", use: "For Android phones and Chrome.", source: "profile", size: square(512), background: "white", color: "original", trim: 0.14, format: "png", file: "icon 512x512", citation: WEB_MANIFEST },
  { id: "facebook-320", group: "social", label: "Facebook, 320 × 320", use: "Facebook’s best-quality Page profile picture size.", source: "profile", size: square(320), background: "white", color: "original", trim: null, format: "png", file: "profile picture - facebook 320x320", citation: FACEBOOK },
  { id: "square-800", group: "social", label: "Square, 800 × 800", use: "A larger square for other sites, such as YouTube. SnapStart picked this size; YouTube shows it at 98 × 98, so check it still reads that small.", source: "profile", size: square(800), background: "white", color: "original", trim: null, format: "png", file: "profile picture - 800x800" },
];

// What each platform's own page says, shown under the group with its sources
export const KIT_FACTS: Partial<Record<KitGroup, { facts: string[]; sources: Citation[] }>> = {
  website: {
    facts: [
      "Google says a favicon must be square, and recommends one larger than 48 × 48 pixels so it looks good everywhere; it reads ICO and PNG files.",
      "web.dev says that for Chrome, a website’s app manifest must list at least a 192 × 192 and a 512 × 512 icon.",
      "Apple’s guide shows a 180 × 180 home-screen icon for iPhone.",
    ],
    sources: [GOOGLE_FAVICON, WEB_MANIFEST, APPLE_TOUCH],
  },
  social: {
    facts: [...PROFILE_FACTS.facts, "YouTube takes JPG, GIF, BMP or PNG files of 15 MB or less."],
    sources: [FACEBOOK, YOUTUBE],
  },
};

export function kitRecipes(available: Record<KitSource, boolean>): KitRecipe[] {
  return KIT_RECIPES.filter((recipe) => available[recipe.source]);
}

// Characters that make folders or that some systems refuse in file names
export function safeFileName(text: string): string {
  return text.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim() || "logo";
}

export function kitFileName(businessName: string, recipe: KitRecipe, simulated: boolean): string {
  return safeFileName([businessName.trim(), recipe.file, simulated ? "practice preview" : null].filter(Boolean).join(" - ")) + `.${recipe.format}`;
}

// A plain-text note for the zip, so the files make sense away from SnapStart
export function kitReadme(input: { businessName: string; recipes: KitRecipe[]; skipped: { recipe: KitRecipe; reason: string }[]; simulated: boolean; colors: { name: string; hex: string }[] }): string {
  const lines = [
    `${input.businessName} logo files`,
    "",
    input.simulated ? "PRACTICE PREVIEW: these files are placeholders, not a logo made by Muse. Don't use them as your logo.\n" : null,
    "Your colors: " + input.colors.map((color) => `${color.name} ${color.hex.toUpperCase()}`).join(", "),
    "",
  ];
  for (const group of Object.keys(KIT_GROUPS) as KitGroup[]) {
    const recipes = input.recipes.filter((recipe) => recipe.group === group);
    if (!recipes.length) continue;
    lines.push(`${KIT_GROUPS[group].title}: ${KIT_GROUPS[group].purpose}`);
    for (const recipe of recipes) {
      const skipped = input.skipped.find((each) => each.recipe.id === recipe.id);
      lines.push(`- ${kitFileName(input.businessName, recipe, input.simulated)}: ${skipped ? `not included. ${skipped.reason}` : recipe.use}`);
    }
    lines.push("");
  }
  lines.push(`Made by SnapStart from your approved logo. Search for similar marks before you print it or spend money on it: ${USPTO.url}`);
  return lines.filter((line): line is string => line !== null).join("\n");
}
