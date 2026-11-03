import { z } from "zod";
import { MARKETING_PLATFORMS, type MarketingPlatformId } from "@/data/marketing-platforms";

// The owner's name, handle and bio for each account, as drafted and approved. Kept with the marketing record.

// Longest text kept for any field; each platform's own limit is checked in code
export const MAX_FIELD = { name: 100, handle: 60, bio: 1500 } as const;

export const BIO_AUTHORS = ["ai", "practice", "rule", "owner"] as const;
export type BioAuthor = (typeof BIO_AUTHORS)[number];

export interface SocialProfile {
  name: string;
  handle: string;
  bio: string;
  // Who wrote the bio as it stands; "rule" is the plain fallback when a draft had nothing usable
  bioBy: BioAuthor | null;
  // What code changed in an AI draft, for the owner to see
  notes: string[];
  // The owner approved these words; editing clears it
  approvedAt: string | null;
}

export type SocialProfiles = Partial<Record<MarketingPlatformId, SocialProfile>>;

const storedProfileSchema = z.object({
  name: z.string().max(MAX_FIELD.name).catch(""),
  handle: z.string().max(MAX_FIELD.handle).catch(""),
  bio: z.string().max(MAX_FIELD.bio).catch(""),
  bioBy: z.enum(BIO_AUTHORS).nullable().catch(null),
  notes: z.array(z.string()).catch([]),
  approvedAt: z.string().nullable().catch(null),
});

// Saved profiles read leniently: one that can't be read is left out, and the owner starts it again
export function readSocialProfiles(raw: unknown): SocialProfiles {
  if (!raw || typeof raw !== "object") return {};
  const profiles: SocialProfiles = {};
  for (const id of MARKETING_PLATFORMS) {
    const value = (raw as Record<string, unknown>)[id];
    if (!value || typeof value !== "object") continue;
    const parsed = storedProfileSchema.safeParse(value);
    if (parsed.success) profiles[id] = parsed.data;
  }
  return profiles;
}
