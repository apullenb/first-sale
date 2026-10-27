import "server-only";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/server";
import { businessProfileSchema, type BusinessProfile } from "@/lib/domain";
import { profileKey, type ResearchResult } from "@/lib/research/requirements";
import { createBusinessForOwner, getBusinessForOwner, updateBusinessProfileForOwner } from "./businesses";
import { getResearchForOwner, type ResearchSnapshot, saveResearchForOwner } from "./research";

// What pages, actions and route handlers call: the owner always comes from the verified session.

export interface MyBusiness {
  id: string;
  isDemo: boolean;
  createdAt: Date;
  // Null when the stored answers don't match the current schema; the owner re-answers them
  profile: BusinessProfile | null;
}

function checked(row: { id: string; isDemo: boolean; createdAt: Date; profile: unknown }): MyBusiness {
  const parsed = businessProfileSchema.safeParse(row.profile);
  return { id: row.id, isDemo: row.isDemo, createdAt: row.createdAt, profile: parsed.success ? parsed.data : null };
}

// Null until the owner finishes the intake
export async function getMyBusiness(): Promise<MyBusiness | null> {
  const user = await getCurrentUser();
  const row = await getBusinessForOwner(getDb(), user.id);
  return row ? checked(row) : null;
}

// Null when the owner already has a business
export async function createMyBusiness(input: { profile: BusinessProfile; isDemo?: boolean }) {
  const user = await getCurrentUser();
  return createBusinessForOwner(getDb(), user.id, input);
}

export async function updateMyBusinessProfile(profile: BusinessProfile) {
  const user = await getCurrentUser();
  return updateBusinessProfileForOwner(getDb(), user.id, profile);
}

// The last requirements research, or null if it hasn't run
export async function getMyResearch(): Promise<ResearchSnapshot | null> {
  const user = await getCurrentUser();
  return getResearchForOwner(getDb(), user.id);
}

// Saved with the answers it ran on, so the page can tell when they've changed since
export async function saveMyResearch(research: ResearchResult, profile: BusinessProfile) {
  const user = await getCurrentUser();
  return saveResearchForOwner(getDb(), user.id, research, profileKey(profile));
}
