import type { AssetKind, BrandImageKind, VersionKind } from "./types";

// Shapes we ask Muse Image for, and the exact sizes made by code.
// Muse Image sets the aspect ratio only, up to 16:1 (dev.meta.ai/docs/image-generation, checked 2026-11-03), so brand images
// are placed at their exact size on the server (fit.ts) and platform sizes made in the browser.

export const CHECKED = "2026-10-27";
export const CHECKED_TEXT = new Date(`${CHECKED}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export interface Export {
  label: string;
  width: number;
  height: number;
  type: "image/png" | "image/jpeg";
  // The platform's file size limit, if it has one
  maxBytes?: number;
  note?: string;
}

// A box in fractions of an image's width and height
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// A box over the image, shown when the owner asks what gets cropped
export interface Guide extends Box {
  label: string;
  tone: "keep" | "covered";
}

export interface ImageSpec {
  title: string;
  // Owner-facing: what it's for
  purpose: string;
  // "WxH" sent to Muse Image: the visible area's shape (requestSize)
  size: string;
  // The saved file, made exactly this size in code (fit.ts)
  final: { width: number; height: number };
  // The part most screens show, which the drawn picture fills; code extends it softly to the rest
  visible: Box;
  // Where the logo and everything important go, in fractions of the final picture; inside visible
  safe: Box;
  // Owner-facing: where it's used
  usedOn: string;
  exports: Export[];
  guides: Guide[];
  // Where the numbers come from; null when SnapStart picked them
  source: { name: string; url: string } | null;
  facts: string[];
}

const FACEBOOK = { name: "Facebook Help Center: Page profile picture and cover photo dimensions", url: "https://www.facebook.com/help/125379114252045" };
const YOUTUBE = { name: "YouTube Help: Manage your channel branding", url: "https://support.google.com/youtube/answer/10456525" };
const LINK_SHARE = { name: "Meta for Developers: Images in Link Shares", url: "https://developers.facebook.com/docs/sharing/webmasters/images/" };

// Facebook shows the cover at 16:9 on computers and 2.4:1 on phones; 851 × 315 loads fastest
const FB_FAST_BAND = 16 / 9 / (851 / 315);
const FULL: Box = { x: 0, y: 0, w: 1, h: 1 };
// The full-width 2560 × 423 band YouTube shows on computers
const YT_BAND: Box = { x: 0, y: (1 - 423 / 1440) / 2, w: 1, h: 423 / 1440 };
// YouTube's safe area: the middle 1235 × 338 of 2048 × 1152
const YT_SAFE: Box = { x: (1 - 1235 / 2048) / 2, y: (1 - 338 / 1152) / 2, w: 1235 / 2048, h: 338 / 1152 };
// Inside that band, clear of the profile picture on the left
const FB_SAFE: Box = { x: 0.25, y: (1 - FB_FAST_BAND) / 2, w: 0.7, h: FB_FAST_BAND };
const FB_BAND: Box = { x: 0, y: (1 - FB_FAST_BAND) / 2, w: 1, h: FB_FAST_BAND };
// SnapStart's own margins: website builders crop headers to wide or tall shapes, and some apps crop link previews
const HERO_SAFE: Box = { x: 0.2, y: 0.18, w: 0.6, h: 0.64 };
const PREVIEW_SAFE: Box = { x: 0.2, y: 0.1, w: 0.6, h: 0.8 };
// SnapStart's picks for the optional social, ad and print pictures
const POST_SAFE: Box = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
// Clear of the name, buttons and reply bar apps lay over the top and bottom of a story
const STORY_SAFE: Box = { x: 0.08, y: 0.14, w: 0.84, h: 0.72 };
const STORY_CLEAR: Box = { x: 0, y: 0.14, w: 1, h: 0.72 };
const AD_SAFE: Box = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
// Calm bands at the top and bottom for the owner's own words
const FLYER_SAFE: Box = { x: 0.1, y: 0.25, w: 0.8, h: 0.5 };
const FLYER_PICTURE: Box = { x: 0, y: 0.25, w: 1, h: 0.5 };
const SCENE_SAFE: Box = { x: 0.12, y: 0.12, w: 0.76, h: 0.76 };

const SPECS: Record<BrandImageKind, Omit<ImageSpec, "size">> = {
  facebook_cover: {
    title: "Facebook cover",
    purpose: "The wide picture across the top of your Facebook Page, with your logo.",
    usedOn: "Your Facebook Page",
    visible: FB_BAND,
    final: { width: 1920, height: 1080 },
    safe: FB_SAFE,
    exports: [
      { label: "Full picture (16:9)", width: 1920, height: 1080, type: "image/jpeg", note: "How Facebook shows covers on computers" },
      { label: "851 × 315", width: 851, height: 315, type: "image/jpeg", maxBytes: 100_000, note: "Facebook says this size, under 100 KB, loads fastest" },
    ],
    guides: [
      // The 851 × 315 band sits inside the phone's 2.4:1 band, so it shows everywhere
      { label: "Shows on computers and phones: keep the important parts in this band", ...FB_BAND, tone: "keep" },
      { label: "Roughly where your profile picture covers the left side", x: 0, y: 0.55, w: 0.22, h: 0.45, tone: "covered" },
    ],
    source: FACEBOOK,
    facts: [
      "On computers the cover shows at 16:9; on phones at 2.4:1, so the top and bottom get cut off.",
      "It must be at least 400 × 150 pixels. Facebook says an 851 × 315 JPG under 100 KB loads fastest.",
      "Your profile picture covers part of the left side.",
    ],
  },
  youtube_banner: {
    title: "YouTube banner",
    purpose: "The banner across the top of your YouTube channel.",
    usedOn: "Your YouTube channel",
    visible: YT_BAND,
    final: { width: 2560, height: 1440 },
    safe: YT_SAFE,
    exports: [{ label: "2560 × 1440", width: 2560, height: 1440, type: "image/jpeg", maxBytes: 6_000_000, note: "YouTube’s recommended size, 6 MB or smaller" }],
    guides: [
      { label: "Shows on computers: the full-width band", ...YT_BAND, tone: "keep" },
      { label: "Safe on every device: keep your logo here", ...YT_SAFE, tone: "keep" },
    ],
    source: YOUTUBE,
    facts: [
      "YouTube recommends 2560 × 1440 pixels (at least 2048 × 1152) and a file of 6 MB or smaller.",
      "Only the middle 1235 × 338 (at 2048 × 1152) is safe for your logo: the rest gets cropped on phones and computers.",
      "Computers show a full-width band 2560 × 423 across the middle. SnapStart draws the picture for that band and extends it softly above and below, for TVs.",
    ],
  },
  website_hero: {
    title: "Website header picture",
    purpose: "A wide picture for the top of your home page, with your logo and calm space for your headline.",
    usedOn: "The top of your website’s home page",
    visible: FULL,
    final: { width: 1920, height: 1080 },
    safe: HERO_SAFE,
    exports: [{ label: "1920 × 1080", width: 1920, height: 1080, type: "image/jpeg" }],
    guides: [{ label: "Shows in most website layouts: keep your logo and the important parts here", ...HERO_SAFE, tone: "keep" }],
    source: null,
    facts: ["There’s no standard size for website pictures. SnapStart makes a 16:9 picture, a shape most website builders handle well."],
  },
  link_preview: {
    title: "Link preview",
    purpose: "The picture that shows when someone shares a link to your website on Facebook and other apps.",
    usedOn: "Links to your website shared in apps and messages",
    visible: FULL,
    final: { width: 1200, height: 630 },
    safe: PREVIEW_SAFE,
    exports: [{ label: "1200 × 630", width: 1200, height: 630, type: "image/png", maxBytes: 8_000_000, note: "Facebook’s recommended size, 8 MB or smaller" }],
    guides: [{ label: "Some apps show a smaller crop: keep your logo here", ...PREVIEW_SAFE, tone: "keep" }],
    source: LINK_SHARE,
    facts: ["Meta recommends at least 1200 × 630 pixels, close to a 1.91:1 shape, so the whole picture shows without cropping."],
  },
  instagram_post: {
    title: "Instagram post",
    purpose: "A tall picture for an Instagram post, with your logo.",
    usedOn: "Posts on your Instagram account",
    visible: FULL,
    final: { width: 1080, height: 1350 },
    safe: POST_SAFE,
    exports: [{ label: "1080 × 1350 (4:5)", width: 1080, height: 1350, type: "image/jpeg" }],
    guides: [{ label: "Keep your logo and the important parts here, away from the edges", ...POST_SAFE, tone: "keep" }],
    source: null,
    facts: ["SnapStart makes a 4:5 portrait picture, a shape Instagram posts commonly use. Check Instagram’s own help before you post, as apps change their sizes."],
  },
  instagram_story: {
    title: "Instagram story or reel cover",
    purpose: "A full-screen phone picture for a story, or the cover of a reel, with your logo.",
    usedOn: "Stories and reel covers on Instagram and Facebook",
    visible: STORY_CLEAR,
    final: { width: 1080, height: 1920 },
    safe: STORY_SAFE,
    exports: [{ label: "1080 × 1920 (9:16)", width: 1080, height: 1920, type: "image/jpeg" }],
    guides: [
      { label: "Keep your logo and the important parts here", ...STORY_SAFE, tone: "keep" },
      { label: "Your name and the app’s buttons can cover the top", x: 0, y: 0, w: 1, h: STORY_SAFE.y, tone: "covered" },
      { label: "The reply bar and buttons can cover the bottom", x: 0, y: STORY_SAFE.y + STORY_SAFE.h, w: 1, h: 1 - STORY_SAFE.y - STORY_SAFE.h, tone: "covered" },
    ],
    source: null,
    facts: [
      "SnapStart makes a 9:16 picture that fills a phone screen.",
      "SnapStart keeps the top and bottom 14% plain, because apps lay your name, buttons and the reply bar over them.",
    ],
  },
  ad_square: {
    title: "Facebook ad",
    purpose: "A square picture for Facebook and Instagram ads, with your logo. You write the ad’s words in the ad itself.",
    usedOn: "Ads on Facebook, Instagram and other apps",
    visible: FULL,
    final: { width: 1080, height: 1080 },
    safe: AD_SAFE,
    exports: [{ label: "1080 × 1080 (square)", width: 1080, height: 1080, type: "image/jpeg" }],
    guides: [{ label: "Keep your logo and the important parts here, away from the edges", ...AD_SAFE, tone: "keep" }],
    source: null,
    facts: ["SnapStart makes a square picture, a shape most ad tools accept. Check the ad tool’s own sizes before you buy an ad."],
  },
  flyer: {
    title: "Flyer picture",
    purpose: "A tall picture for a printed flyer, with calm space at the top and bottom where you add your own words.",
    usedOn: "Printed flyers, posters and handouts",
    visible: FLYER_PICTURE,
    final: { width: 2550, height: 3300 },
    safe: FLYER_SAFE,
    exports: [{ label: "2550 × 3300 (letter, 300 dpi)", width: 2550, height: 3300, type: "image/jpeg", note: "8.5 × 11 inches at 300 dots per inch" }],
    guides: [
      { label: "Your logo and the picture go here", ...FLYER_SAFE, tone: "keep" },
      { label: "Calm space for your own headline", x: 0, y: 0, w: 1, h: FLYER_SAFE.y, tone: "covered" },
      { label: "Calm space for your own details", x: 0, y: FLYER_SAFE.y + FLYER_SAFE.h, w: 1, h: 1 - FLYER_SAFE.y - FLYER_SAFE.h, tone: "covered" },
    ],
    source: null,
    facts: [
      "SnapStart makes a letter-size picture: 8.5 × 11 inches at 300 dots per inch is 2550 × 3300 pixels.",
      "It has no words besides your logo. Add your own headline, prices and details in the calm space at the top and bottom.",
    ],
  },
  product_scene: {
    title: "Product scene",
    purpose: "Your kind of products styled in a setting, as if on the shelf or in use, with your logo.",
    usedOn: "Your website, posts and product pages",
    visible: FULL,
    final: { width: 1600, height: 1200 },
    safe: SCENE_SAFE,
    exports: [{ label: "1600 × 1200 (4:3)", width: 1600, height: 1200, type: "image/jpeg" }],
    guides: [{ label: "Keep your logo and the products here", ...SCENE_SAFE, tone: "keep" }],
    source: null,
    facts: [
      "There’s no standard size for this picture. SnapStart makes a 4:3 picture that works on websites and in posts.",
      "It shows the kinds of things you sell, with no prices or words besides your logo.",
    ],
  },
};

// Asked for at the visible area's shape when it differs from the file's by more than this
export const REQUEST_SHAPE_GAP = 1.3;
// Muse Image's widest shape
const MAX_RATIO = 16;

// The shape the model draws: the visible area's when it differs a lot from the whole file's
export function requestSize(spec: Pick<ImageSpec, "final" | "visible">): { width: number; height: number } {
  const { final, visible } = spec;
  const width = Math.round(final.width * visible.w);
  const height = Math.round(final.height * visible.h);
  const ratio = width / height;
  const finalRatio = final.width / final.height;
  const differs = Math.max(ratio / finalRatio, finalRatio / ratio) > REQUEST_SHAPE_GAP;
  if (!differs || ratio > MAX_RATIO || ratio < 1 / MAX_RATIO) return { ...final };
  return { width, height };
}

export const IMAGE_SPECS = Object.fromEntries(
  Object.entries(SPECS).map(([kind, spec]) => {
    const asked = requestSize(spec);
    return [kind, { ...spec, size: `${asked.width}x${asked.height}` }];
  }),
) as Record<BrandImageKind, ImageSpec>;

export interface LogoSpec {
  title: string;
  purpose: string;
  size: string;
  exports: Export[];
}

export const LOGO_SPECS: Record<"logo" | VersionKind, LogoSpec> = {
  logo: { title: "Main logo", purpose: "Your logo, for your website, signs and labels.", size: "1536x1024", exports: [] },
  stacked: { title: "Stacked", purpose: "The symbol above your name, for square spaces.", size: "1024x1024", exports: [] },
  profile: {
    title: "Icon (profile picture)",
    purpose: "Just the symbol, for social media profile pictures, which are cropped to a circle, and your website’s tab icon.",
    size: "1024x1024",
    exports: [{ label: "320 × 320", width: 320, height: 320, type: "image/png", note: "Facebook’s best-quality profile picture size" }],
  },
  solid: { title: "One-color", purpose: "The whole logo in one color, for stamps, stickers, embroidery and printing.", size: "1536x1024", exports: [] },
};

export function sizeFor(kind: AssetKind): string {
  return kind in IMAGE_SPECS ? IMAGE_SPECS[kind as BrandImageKind].size : LOGO_SPECS[kind as "logo" | VersionKind].size;
}

export const PROFILE_FACTS = {
  source: FACEBOOK,
  facts: ["Facebook crops Page profile pictures to a circle and suggests 320 × 320 pixels.", "YouTube shows channel pictures at 98 × 98 pixels (YouTube Help: Manage your channel branding)."],
};

export const USPTO = { name: "USPTO: Search our trademark database", url: "https://www.uspto.gov/trademarks/search" };
