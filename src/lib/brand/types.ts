import { z } from "zod";
import { COLOR_FAMILY_NAMES, MAX_COLOR_FAMILIES, VIBE_LIMITS, VIBES } from "./vibes";

// Brand brief, logo ideas, generated files and the brand kit other sections use

export const BRIEF_LIMITS = { name: 60, tagline: 60, sells: 300, customers: 200, colors: 120, symbol: 160, avoid: 200, story: 600, logoLikes: 200 } as const;

export const CONCEPT_KINDS = ["wordmark", "monogram", "emblem", "illustrative", "abstract", "lettermark_symbol"] as const;
export type ConceptKind = (typeof CONCEPT_KINDS)[number];

const leaningsSchema = z.object({
  era: z.enum(["old", "modern"]).nullable(),
  tone: z.enum(["playful", "serious"]).nullable(),
  energy: z.enum(["quiet", "loud"]).nullable(),
  finish: z.enum(["handmade", "polished"]).nullable(),
});
export type Leanings = z.infer<typeof leaningsSchema>;
export const NO_LEANINGS: Leanings = { era: null, tone: null, energy: null, finish: null };

export const brandBriefSchema = z.object({
  // Exactly as it must appear in the logo
  name: z.string().trim().min(1).max(BRIEF_LIMITS.name),
  tagline: z.string().trim().max(BRIEF_LIMITS.tagline),
  sells: z.string().trim().min(1).max(BRIEF_LIMITS.sells),
  customers: z.string().trim().max(BRIEF_LIMITS.customers),
  vibes: z.array(z.enum(VIBES)).min(VIBE_LIMITS.min).max(VIBE_LIMITS.max),
  leanings: leaningsSchema,
  colors: z.array(z.enum(COLOR_FAMILY_NAMES)).max(MAX_COLOR_FAMILIES),
  likedColors: z.string().trim().max(BRIEF_LIMITS.colors),
  avoidColors: z.string().trim().max(BRIEF_LIMITS.colors),
  symbolIdea: z.string().trim().max(BRIEF_LIMITS.symbol),
  avoid: z.string().trim().max(BRIEF_LIMITS.avoid),
  // Kinds of logo the owner wants to see; empty means a mix
  logoKinds: z.array(z.enum(CONCEPT_KINDS)).max(CONCEPT_KINDS.length),
  // Logos they like and why, as taste hints; never copied
  logoLikes: z.string().trim().max(BRIEF_LIMITS.logoLikes),
  // The brand picture: written by AI from the picks, then approved or rewritten by the owner
  story: z.string().trim().max(BRIEF_LIMITS.story),
  // The owner rewrote it, so it isn't AI's or practice text any more
  storyByOwner: z.boolean(),
  storyApproved: z.boolean(),
});
export type BrandBrief = z.infer<typeof brandBriefSchema>;

// Briefs saved before a field existed still read, with that field empty
const storedBriefSchema = z.object({
  name: z.string().catch(""),
  tagline: z.string().catch(""),
  sells: z.string().catch(""),
  customers: z.string().catch(""),
  vibes: z.array(z.enum(VIBES)).catch([]),
  leanings: leaningsSchema.catch(NO_LEANINGS),
  colors: z.array(z.enum(COLOR_FAMILY_NAMES)).catch([]),
  likedColors: z.string().catch(""),
  avoidColors: z.string().catch(""),
  symbolIdea: z.string().catch(""),
  avoid: z.string().catch(""),
  logoKinds: z.array(z.enum(CONCEPT_KINDS)).catch([]),
  logoLikes: z.string().catch(""),
  story: z.string().catch(""),
  storyByOwner: z.boolean().catch(false),
  storyApproved: z.boolean().catch(false),
});

export function readBrief(raw: unknown): BrandBrief {
  return storedBriefSchema.parse(raw && typeof raw === "object" ? raw : {});
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const paletteColorSchema = z.object({ hex, name: z.string().min(1).max(40) });
export type PaletteColor = z.infer<typeof paletteColorSchema>;

// What the creative director returns for one idea; code turns it into the drawing instructions
export const conceptReplySchema = z.object({
  kind: z.enum(CONCEPT_KINDS),
  title: z.string().min(1).max(60),
  idea: z.string().min(1).max(400),
  // What the mark shows; null for a pure wordmark
  symbol: z.string().max(240).nullable(),
  typography: z.string().min(1).max(240),
  palette: z.array(paletteColorSchema).min(1).max(3),
  rationale: z.string().min(1).max(400),
});
export type ConceptReply = z.infer<typeof conceptReplySchema>;

export const conceptsReplySchema = z.object({ concepts: z.array(conceptReplySchema).min(4).max(6) });

export const REFINE_KINDS = ["simpler", "colors", "lettering", "tagline"] as const;
export type RefineKind = (typeof REFINE_KINDS)[number];

// What a one-click change set on a logo; versions, checks, the kit and the guide follow it
export interface BrandDesign {
  palette?: PaletteColor[];
  typography?: string;
  // "" means the logo has no tagline
  tagline?: string;
  // Only on the file a one-click change made
  preset?: RefineKind;
}

// The `model` recorded on versions and edits built in code from the logo's own pixels
export const CODE_MODEL = "first-sale-code";

export const LOGO_KINDS = ["logo", "stacked", "profile", "solid"] as const;
export const VERSION_KINDS = ["stacked", "profile", "solid"] as const;
export type VersionKind = (typeof VERSION_KINDS)[number];
export const IMAGE_KINDS = ["website_hero", "facebook_cover", "youtube_banner", "link_preview"] as const;
export type BrandImageKind = (typeof IMAGE_KINDS)[number];
export const ASSET_KINDS = [...LOGO_KINDS, ...IMAGE_KINDS] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const ASSET_ORIGINS = ["generated", "uploaded"] as const;
export type AssetOrigin = (typeof ASSET_ORIGINS)[number];
// Approved file ids: the version set together, each brand image on its own
export type BrandPicks = Partial<Record<VersionKind | BrandImageKind, string>>;

// What AI read in a file, and what code concluded from it
export interface LetteringCheck {
  status: "matches" | "misspelled" | "extra_words" | "spacing" | "unreadable" | "has_words";
  read: string[];
  // Owner-facing, plain words
  problems: string[];
  // What the check can't see, such as punctuation
  note: string | null;
}

export const DRIFT_KINDS = ["symbol", "lettering", "color", "layout", "extra", "other"] as const;
export type DriftKind = (typeof DRIFT_KINDS)[number];

export interface AssetCheck {
  checkedAt: string;
  // "skipped": practice mode or a model that can't see; "failed": the check itself didn't work;
  // "code": built from the logo's own pixels, so nothing was redrawn to check
  method: "ai" | "skipped" | "failed" | "code";
  lettering: LetteringCheck | null;
  // Versions: how it differs from the chosen logo
  drift: { kind: DriftKind; detail: string }[];
  // Versions and edits code may build: how this one was made, and why
  layout?: { built: "code" | "model"; note: string; confidence: number };
}

export interface BrandFile {
  // Owner-scoped; works in <img> and for download
  url: string;
  width: number;
  height: number;
}

// The approved brand, for other sections such as the website. Null until a logo is chosen.
export interface BrandKit {
  businessName: string;
  // As drawn in the chosen logo; "" for none
  tagline: string;
  colors: PaletteColor[];
  // The logo's lettering direction, in plain words
  lettering: string;
  logos: { primary: BrandFile | null; stacked: BrandFile | null; profile: BrandFile | null; solid: BrandFile | null };
  images: { websiteHero: BrandFile | null; facebookCover: BrandFile | null; youtubeBanner: BrandFile | null; linkPreview: BrandFile | null };
  // Any file here is a practice preview, not made by Muse
  simulated: boolean;
  // The main logo is the owner's own upload, so its colors and lettering come from the owner
  uploaded: boolean;
}
