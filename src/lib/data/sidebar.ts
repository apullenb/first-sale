import "server-only";
import { count, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { brandKits, businesses, documents, journeyMarks, marketingPlans, products, researchSnapshots, websitePlans } from "@/db/schema";
import type { BrandPicks } from "@/lib/brand/types";
import type { DraftAnswers } from "@/lib/documents/types";
import { readIntake } from "@/lib/marketing/intake";
import type { HostingState } from "@/lib/website/hosting/types";

// Owner-scoped like businesses.ts. Only the few columns the menu needs, since it loads on every page.

export interface SidebarFacts {
  // The answers the last requirements check ran on, by key; null before the first check
  researchKey: string | null;
  // Just what's needed to spot documents waiting on the owner
  documents: { role: string | null; answers: DraftAnswers; factsUsed: Record<string, string> | null }[];
  logoChosen: boolean;
  logoVersionsApproved: boolean;
  websiteLive: boolean;
  products: number;
  marketingApproved: boolean;
  socialPlatforms: string[];
  // Accounts the owner said they already have
  socialHave: string[];
  marks: string[];
}

export async function getSidebarFactsForOwner(db: Db, ownerId: string): Promise<SidebarFacts | null> {
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  if (!business) return null;
  const [[research], docs, [kit], [site], [marketing], [items], marks] = await Promise.all([
    db.select({ profileKey: researchSnapshots.profileKey }).from(researchSnapshots).where(eq(researchSnapshots.businessId, business.id)).limit(1),
    db.select({ role: documents.role, answers: documents.answers, factsUsed: documents.factsUsed }).from(documents).where(eq(documents.businessId, business.id)),
    db.select({ chosenLogoId: brandKits.chosenLogoId, picks: brandKits.picks }).from(brandKits).where(eq(brandKits.businessId, business.id)),
    db.select({ hosting: websitePlans.hosting }).from(websitePlans).where(eq(websitePlans.businessId, business.id)),
    db.select({ approvedAt: marketingPlans.approvedAt, intake: marketingPlans.intake }).from(marketingPlans).where(eq(marketingPlans.businessId, business.id)),
    db.select({ total: count() }).from(products).where(eq(products.businessId, business.id)),
    db.select({ key: journeyMarks.key }).from(journeyMarks).where(eq(journeyMarks.businessId, business.id)),
  ]);
  const picks: BrandPicks = kit?.picks ?? {};
  const hosting = (site?.hosting ?? null) as HostingState | null;
  let intake: ReturnType<typeof readIntake> = null;
  try {
    intake = readIntake(marketing?.intake);
  } catch {
    // An unreadable intake just means no accounts picked yet
  }
  return {
    researchKey: research?.profileKey ?? null,
    documents: docs,
    logoChosen: Boolean(kit?.chosenLogoId),
    logoVersionsApproved: Boolean(picks.stacked && picks.profile && picks.solid),
    websiteLive: Boolean(hosting && !hosting.simulated && hosting.state !== "failed"),
    products: items?.total ?? 0,
    marketingApproved: Boolean(marketing?.approvedAt),
    socialPlatforms: intake?.include ?? [],
    socialHave: intake?.have ?? [],
    marks: marks.map((mark) => mark.key),
  };
}
