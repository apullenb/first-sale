import "server-only";
import { count, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { brandKits, businesses, journeyMarks, marketingPlans, products, websitePlans } from "@/db/schema";
import type { BrandPicks } from "@/lib/brand/types";
import { readIntake } from "@/lib/marketing/intake";
import type { HostingState } from "@/lib/website/hosting/types";

// Owner-scoped like businesses.ts. Only the few columns the menu needs, since it loads on every page.

export interface BrandStepFacts {
  logoChosen: boolean;
  logoVersionsApproved: boolean;
  websiteLive: boolean;
  products: number;
  marketingApproved: boolean;
  socialPlatforms: string[];
  marks: string[];
}

export async function getBrandStepFactsForOwner(db: Db, ownerId: string): Promise<BrandStepFacts | null> {
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  if (!business) return null;
  const [[kit], [site], [marketing], [items], marks] = await Promise.all([
    db.select({ chosenLogoId: brandKits.chosenLogoId, picks: brandKits.picks }).from(brandKits).where(eq(brandKits.businessId, business.id)),
    db.select({ hosting: websitePlans.hosting }).from(websitePlans).where(eq(websitePlans.businessId, business.id)),
    db.select({ approvedAt: marketingPlans.approvedAt, intake: marketingPlans.intake }).from(marketingPlans).where(eq(marketingPlans.businessId, business.id)),
    db.select({ total: count() }).from(products).where(eq(products.businessId, business.id)),
    db.select({ key: journeyMarks.key }).from(journeyMarks).where(eq(journeyMarks.businessId, business.id)),
  ]);
  const picks: BrandPicks = kit?.picks ?? {};
  const hosting = (site?.hosting ?? null) as HostingState | null;
  let socialPlatforms: string[] = [];
  try {
    socialPlatforms = readIntake(marketing?.intake)?.include ?? [];
  } catch {
    // An unreadable intake just means no accounts picked yet
  }
  return {
    logoChosen: Boolean(kit?.chosenLogoId),
    logoVersionsApproved: Boolean(picks.stacked && picks.profile && picks.solid),
    websiteLive: Boolean(hosting && !hosting.simulated && hosting.state !== "failed"),
    products: items?.total ?? 0,
    marketingApproved: Boolean(marketing?.approvedAt),
    socialPlatforms,
    marks: marks.map((mark) => mark.key),
  };
}
