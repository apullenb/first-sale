import type { BusinessProfile } from "@/lib/domain";
import { OFFERING_KIND_LABELS } from "@/lib/intake/options";
import { businessSpecifics, itemsPhrase } from "@/lib/specifics";
import { BRIEF_LIMITS, type BrandBrief, NO_LEANINGS } from "./types";

// The brief starts from what the owner already told us, so they only confirm it

const CUSTOMERS: Record<BusinessProfile["channels"][number], string> = {
  in_person: "people nearby",
  markets: "shoppers at local markets",
  storefront: "customers who visit the shop",
  own_website: "online shoppers",
  marketplace: "online shoppers",
  social_media: "people who follow us on social media",
  wholesale: "local stores that sell our products",
};

export function fromProfile(profile: BusinessProfile | null): Pick<BrandBrief, "name" | "sells" | "customers"> {
  const customers = [...new Set((profile?.channels ?? []).map((channel) => CUSTOMERS[channel]))];
  const kinds = (profile?.offeringKinds ?? []).map((kind) => OFFERING_KIND_LABELS[kind]).join(", ");
  return {
    name: (profile?.name ?? "").slice(0, BRIEF_LIMITS.name),
    sells: (profile?.firstItems.trim() || (profile ? itemsPhrase(businessSpecifics(profile), 6) : "") || profile?.description.trim() || kinds).slice(0, BRIEF_LIMITS.sells),
    customers: customers.length ? capitalize(joinAnd(customers)).slice(0, BRIEF_LIMITS.customers) : "",
  };
}

// A saved brief wins; anything it leaves empty comes from the business profile
export function briefDefaults(profile: BusinessProfile | null, saved: BrandBrief | null): BrandBrief {
  const known = fromProfile(profile);
  if (saved) {
    return { ...saved, name: saved.name || known.name, sells: saved.sells || known.sells, customers: saved.customers || known.customers };
  }
  return {
    ...known,
    tagline: "",
    vibes: [],
    leanings: NO_LEANINGS,
    colors: [],
    likedColors: "",
    avoidColors: "",
    symbolIdea: "",
    avoid: "",
    logoKinds: [],
    logoLikes: "",
    story: "",
    storyByOwner: false,
    storyApproved: false,
  };
}

// Logo ideas wait until the owner has approved their brand description
export function ideasProblem(brief: BrandBrief): string | null {
  if (!brief.story.trim() || !brief.storyApproved) return "First approve your brand description in Build your brand: choose “This feels like my business”.";
  return null;
}

// Answers asked on Create your logo; Build your brand asks the rest. Each page saves only its own.
export const LOGO_FIELDS = ["name", "tagline", "logoKinds", "symbolIdea", "logoLikes"] as const;
export type LogoField = (typeof LOGO_FIELDS)[number];
export type LogoChoices = Pick<BrandBrief, LogoField>;

export function withLogoChoices(saved: BrandBrief, choices: LogoChoices): BrandBrief {
  return { ...saved, name: choices.name, tagline: choices.tagline, logoKinds: choices.logoKinds, symbolIdea: choices.symbolIdea, logoLikes: choices.logoLikes };
}

// The brand page's answers over the saved ones; it sets the name only when none is saved yet
export function withBrandAnswers(saved: BrandBrief, answers: BrandBrief): BrandBrief {
  const next = { ...answers };
  for (const field of LOGO_FIELDS) (next as Record<LogoField, unknown>)[field] = saved[field];
  if (!saved.name.trim()) next.name = answers.name;
  return next;
}

function joinAnd(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
