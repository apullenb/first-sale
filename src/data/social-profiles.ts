import type { MarketingPlatformId } from "@/data/marketing-platforms";
import type { BrandImageKind } from "@/lib/brand/types";

// Profile limits for each account, read on each company's own help pages on the dates below.
// `byHand`: the page only loads in a browser, so it was read there. A null limit means the company doesn't publish one.

export interface ProfileSource {
  label: string;
  url: string;
  checked: string;
  byHand?: true;
}

export interface HandleRule {
  // "Username" or "Handle"
  label: string;
  // Shown before it, like "@"
  prefix: string;
  min: number | null;
  max: number | null;
  // Allowed besides letters and numbers
  extra: string;
  // Not allowed first or last
  notAtEdges: string;
  notAtEnd: string;
  notAllNumbers: boolean;
  // No web addresses, like ".com"
  noWebAddress: boolean;
  // Owner-facing summary of the rules
  rules: string;
  source: ProfileSource;
}

export interface ProfileText {
  label: string;
  max: number | null;
  source: ProfileSource | null;
}

export interface BioRule extends ProfileText {
  // How long SnapStart's drafts aim to be; never over max
  target: number;
  // The platform refuses links here
  noLinks: boolean;
  // The platform refuses phone numbers and email addresses here
  noContact: boolean;
}

export interface SocialProfileFacts {
  id: MarketingPlatformId;
  name: ProfileText & { hint: string };
  handle: HandleRule | null;
  bio: BioRule | null;
  // The brand image made for this platform's cover
  cover: BrandImageKind | null;
  // Rules from the platform's own pages, quoted or closely paraphrased
  rules: string[];
}

const CHECKED = "2026-10-29";

const IG_BIO = { label: "Instagram Help: Add a bio to your Instagram profile", url: "https://help.instagram.com/728994388226960/", checked: CHECKED, byHand: true } as const;
const IG_USERNAME = {
  label: "Instagram Help: when a username is already claimed",
  url: "https://help.instagram.com/513717858639392",
  checked: CHECKED,
  byHand: true,
} as const;
const FB_USERNAME = { label: "Facebook Help: Guidelines for custom usernames", url: "https://www.facebook.com/help/105399436216001", checked: CHECKED } as const;
const FB_NAME = { label: "Facebook Help: Guidelines for Page names", url: "https://www.facebook.com/help/519912414718764", checked: CHECKED } as const;
const FB_BIO = { label: "Facebook Help: Add basic information to your Page", url: "https://www.facebook.com/help/160672070698623", checked: CHECKED } as const;
const TT_USERNAME = { label: "TikTok Support: Changing your username", url: "https://www.tiktok.com/support/faq_detail?id=7581821550156962315", checked: CHECKED, byHand: true } as const;
const TT_NAME = { label: "TikTok Support: Changing your nickname", url: "https://www.tiktok.com/support/faq_detail?id=7581821550014388748", checked: CHECKED, byHand: true } as const;
const TT_BIO = { label: "TikTok Support: Changing account bio", url: "https://www.tiktok.com/support/faq_detail?id=7096681482017692162", checked: CHECKED, byHand: true } as const;
const PINTEREST = { label: "Pinterest Help: Edit your profile", url: "https://help.pinterest.com/en/article/edit-your-profile", checked: CHECKED } as const;
const YT_HANDLE = { label: "YouTube Help: Learn about YouTube handles", url: "https://support.google.com/youtube/answer/11585688", checked: CHECKED } as const;
const YT_INFO = { label: "YouTube Help: Manage your channel’s basic info", url: "https://support.google.com/youtube/answer/2657964", checked: CHECKED } as const;
const LINKEDIN = { label: "LinkedIn Help: Edit your LinkedIn Page", url: "https://www.linkedin.com/help/linkedin/answer/a564346", checked: CHECKED } as const;
const GOOGLE_EDIT = { label: "Google Business Profile Help: Edit your Business Profile", url: "https://support.google.com/business/answer/3039617", checked: CHECKED } as const;
const GOOGLE_RULES = { label: "Google Business Profile Help: Guidelines for representing your business", url: "https://support.google.com/business/answer/3038177", checked: CHECKED } as const;
const NEXTDOOR = { label: "Nextdoor for business: Business Page", url: "https://business.nextdoor.com/en-us/getting-started/business-page", checked: CHECKED } as const;
const YELP = {
  label: "Yelp for Business: “From the Business” guidelines",
  url: "https://biz.yelp.com/support-center/article/What-are-the-guidelines-for-the-From-the-Business-information",
  checked: CHECKED,
} as const;

const BUSINESS_NAME = "Your business name, the same everywhere.";

export const PROFILE_FACTS: Record<MarketingPlatformId, SocialProfileFacts | null> = {
  instagram: {
    id: "instagram",
    name: { label: "Name", max: null, source: null, hint: BUSINESS_NAME },
    handle: {
      label: "Username",
      prefix: "@",
      min: null,
      max: null,
      extra: "._",
      notAtEdges: "",
      notAtEnd: "",
      notAllNumbers: false,
      noWebAddress: false,
      rules: "Letters, numbers, periods and underscores. If the name is taken, Instagram suggests adding periods, numbers, underscores or abbreviations.",
      source: IG_USERNAME,
    },
    bio: { label: "Bio", max: 150, source: IG_BIO, target: 150, noLinks: false, noContact: false },
    cover: null,
    rules: ["You can write a bio of up to 150 characters, and anyone can see it."],
  },
  facebook: {
    id: "facebook",
    name: { label: "Page name", max: null, source: FB_NAME, hint: "Your business name. Facebook doesn’t allow slogans, descriptions or all capital letters in Page names." },
    handle: {
      label: "Username",
      prefix: "@",
      min: 5,
      max: null,
      extra: ".",
      notAtEdges: "",
      notAtEnd: "",
      notAllNumbers: false,
      noWebAddress: true,
      rules: "At least 5 characters: letters, numbers and periods. No endings like .com.",
      source: FB_USERNAME,
    },
    bio: { label: "Bio", max: null, source: FB_BIO, target: 150, noLinks: false, noContact: false },
    cover: "facebook_cover",
    rules: ["Page names can’t include descriptions or slogans, and can’t be all capital letters except for acronyms.", "A new Page may not be able to add a username right away."],
  },
  google_business: {
    id: "google_business",
    name: {
      label: "Business name",
      max: null,
      source: GOOGLE_RULES,
      hint: "Exactly as it appears on your signs, cards and other branding. Google may suspend a profile with extra words in the name.",
    },
    handle: null,
    bio: { label: "Description", max: 750, source: GOOGLE_EDIT, target: 400, noLinks: true, noContact: false },
    cover: null,
    rules: ["The description can be up to 750 characters.", "No links of any kind, and don’t focus on prices, sales or special offers.", "Google reviews changes before they show."],
  },
  tiktok: {
    id: "tiktok",
    name: { label: "Name", max: 30, source: TT_NAME, hint: BUSINESS_NAME },
    handle: {
      label: "Username",
      prefix: "@",
      min: 2,
      max: 24,
      extra: "._",
      notAtEdges: "",
      notAtEnd: ".",
      notAllNumbers: false,
      noWebAddress: false,
      rules: "2 to 24 letters, numbers, underscores and periods, not ending in a period.",
      source: TT_USERNAME,
    },
    bio: { label: "Bio", max: 80, source: TT_BIO, target: 80, noLinks: false, noContact: false },
    cover: null,
    rules: ["Your username can be changed once every 30 days, and your name once every 7 days.", "Bios can’t be longer than 80 characters."],
  },
  pinterest: {
    id: "pinterest",
    name: { label: "Business name", max: null, source: null, hint: BUSINESS_NAME },
    handle: {
      label: "Username",
      prefix: "@",
      min: 3,
      max: 30,
      extra: "_",
      notAtEdges: "",
      notAtEnd: "",
      notAllNumbers: true,
      noWebAddress: false,
      rules: "3 to 30 letters, numbers and underscores. No spaces or punctuation, and not just numbers.",
      source: PINTEREST,
    },
    bio: { label: "About", max: 500, source: PINTEREST, target: 300, noLinks: false, noContact: false },
    cover: null,
    rules: ["Your bio can be up to 500 characters."],
  },
  youtube: {
    id: "youtube",
    name: { label: "Channel name", max: null, source: YT_INFO, hint: BUSINESS_NAME },
    handle: {
      label: "Handle",
      prefix: "@",
      min: 3,
      max: 30,
      extra: "_-.·",
      notAtEdges: "_-.·",
      notAtEnd: "",
      notAllNumbers: false,
      noWebAddress: true,
      rules: "3 to 30 letters and numbers. Underscores, hyphens and periods are fine, but not first or last. It can’t look like a web address or phone number.",
      source: YT_HANDLE,
    },
    bio: { label: "Description", max: null, source: YT_INFO, target: 300, noLinks: false, noContact: false },
    cover: "youtube_banner",
    rules: ["You can change your channel name and handle twice in 14 days."],
  },
  nextdoor: {
    id: "nextdoor",
    name: { label: "Business name", max: null, source: null, hint: BUSINESS_NAME },
    handle: null,
    bio: { label: "About your business", max: null, source: NEXTDOOR, target: 300, noLinks: false, noContact: false },
    cover: null,
    rules: ["You must be an owner, employee or other authorized representative of the business."],
  },
  yelp: {
    id: "yelp",
    name: { label: "Business name", max: null, source: null, hint: BUSINESS_NAME },
    handle: null,
    bio: { label: "Specialties", max: 1500, source: YELP, target: 400, noLinks: true, noContact: true },
    cover: null,
    rules: [
      "Specialties can be up to 1,500 characters.",
      "Yelp rejects keyword lists, lots of punctuation or capital letters, contact details shown elsewhere on the page, and asking for reviews.",
    ],
  },
  linkedin: {
    id: "linkedin",
    name: { label: "Page name", max: null, source: null, hint: BUSINESS_NAME },
    handle: null,
    bio: { label: "Tagline", max: null, source: LINKEDIN, target: 120, noLinks: false, noContact: false },
    cover: null,
    rules: ["You need a personal LinkedIn account. Pages can’t be made in the Android app."],
  },
  // No profile to fill in: the list lives in whichever email tool the owner picks
  email_list: null,
};

// Every page the limits came from, for tests and the page footer
export function profileSources(facts: SocialProfileFacts): ProfileSource[] {
  const all = [facts.name.source, facts.handle?.source ?? null, facts.bio?.source ?? null].filter((source): source is ProfileSource => source !== null);
  return all.filter((source, index) => all.findIndex((each) => each.url === source.url) === index);
}
