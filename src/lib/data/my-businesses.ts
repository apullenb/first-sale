import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/server";
import { businessProfileSchema, MAX_BUSINESSES_PER_OWNER, type BusinessProfile } from "@/lib/domain";
import {
  createBusinessForOwner,
  getBusinessForOwner,
  listBusinessesForOwner,
  updateBusinessProfileForOwner,
} from "./businesses";

// What pages, actions and route handlers call: the owner always comes from the verified session.

const CURRENT_BUSINESS_COOKIE = "first-sale.business";

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

export async function listMyBusinesses(): Promise<MyBusiness[]> {
  const user = await getCurrentUser();
  return (await listBusinessesForOwner(getDb(), user.id)).map(checked);
}

export async function getMyBusiness(businessId: string): Promise<MyBusiness | null> {
  const user = await getCurrentUser();
  const row = await getBusinessForOwner(getDb(), user.id, businessId);
  return row ? checked(row) : null;
}

// Null when the owner is at the business limit
export async function createMyBusiness(input: { profile: BusinessProfile; isDemo?: boolean }) {
  const user = await getCurrentUser();
  return createBusinessForOwner(getDb(), user.id, input, MAX_BUSINESSES_PER_OWNER);
}

export async function updateMyBusinessProfile(businessId: string, profile: BusinessProfile) {
  const user = await getCurrentUser();
  return updateBusinessProfileForOwner(getDb(), user.id, businessId, profile);
}

// The business the owner is working on: the one they last picked, else their first
export async function getCurrentBusiness(): Promise<MyBusiness | null> {
  const chosen = (await cookies()).get(CURRENT_BUSINESS_COOKIE)?.value;
  if (chosen) {
    const business = await getMyBusiness(chosen);
    if (business) return business;
  }
  const [first] = await listMyBusinesses();
  return first ?? null;
}

// Only call from a server action, after checking the owner owns this business
export async function rememberCurrentBusiness(businessId: string) {
  (await cookies()).set(CURRENT_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
