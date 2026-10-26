import "server-only";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/auth/server";
import type { BusinessProfile } from "@/lib/domain";
import { createBusinessForOwner, getBusinessForOwner, listBusinessesForOwner } from "./businesses";

// What pages, actions and route handlers call: the owner always comes from the verified session.

export async function listMyBusinesses() {
  const user = await getCurrentUser();
  return listBusinessesForOwner(getDb(), user.id);
}

export async function getMyBusiness(businessId: string) {
  const user = await getCurrentUser();
  return getBusinessForOwner(getDb(), user.id, businessId);
}

export async function createMyBusiness(input: { profile: BusinessProfile; isDemo?: boolean }) {
  const user = await getCurrentUser();
  return createBusinessForOwner(getDb(), user.id, input);
}
