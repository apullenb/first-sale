import "server-only";
import { and, count, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { brandKits, businesses, documents, journeyMarks, marketingPlans, products, websitePlans } from "@/db/schema";
import { readBrief } from "@/lib/brand/types";
import type { DraftAnswers } from "@/lib/documents/types";
import { readIntake } from "@/lib/marketing/intake";

// Owner-scoped like businesses.ts. Only the few columns the menu needs, since it loads on every page.

export interface SidebarFacts {
  // Just what's needed to spot documents waiting on the owner
  documents: { role: string | null; answers: DraftAnswers; factsUsed: Record<string, string> | null }[];
  logoChosen: boolean;
  brandDescribed: boolean;
  // The demo finish of a SnapStart site, or a connected existing site
  websiteFinished: boolean;
  websiteConnected: boolean;
  products: number;
  // Kinds of the items the owner confirmed, for the step's name
  confirmedKinds: ("product" | "service")[];
  marketingApproved: boolean;
  socialPlatforms: string[];
  // Accounts the owner said they already have
  socialHave: string[];
  marks: string[];
}

export async function getSidebarFactsForOwner(db: Db, ownerId: string): Promise<SidebarFacts | null> {
  const [business] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  if (!business) return null;
  const [docs, [kit], [site], [marketing], [items], marks, kinds] = await Promise.all([
    db.select({ role: documents.role, answers: documents.answers, factsUsed: documents.factsUsed }).from(documents).where(eq(documents.businessId, business.id)),
    db.select({ chosenLogoId: brandKits.chosenLogoId, brief: brandKits.brief }).from(brandKits).where(eq(brandKits.businessId, business.id)),
    db.select({ finished: websitePlans.finished, approvedAt: websitePlans.contentApprovedAt, existingSite: websitePlans.existingSite }).from(websitePlans).where(eq(websitePlans.businessId, business.id)),
    db.select({ approvedAt: marketingPlans.approvedAt, intake: marketingPlans.intake }).from(marketingPlans).where(eq(marketingPlans.businessId, business.id)),
    db.select({ total: count() }).from(products).where(eq(products.businessId, business.id)),
    db.select({ key: journeyMarks.key }).from(journeyMarks).where(eq(journeyMarks.businessId, business.id)),
    db.selectDistinct({ kind: products.kind }).from(products).where(and(eq(products.businessId, business.id), eq(products.status, "confirmed"))),
  ]);
  let intake: ReturnType<typeof readIntake> = null;
  try {
    intake = readIntake(marketing?.intake);
  } catch {
    // An unreadable intake just means no accounts picked yet
  }
  return {
    documents: docs,
    logoChosen: Boolean(kit?.chosenLogoId),
    brandDescribed: Boolean(kit?.brief && readBrief(kit.brief).storyApproved),
    // A finish counts only while the words it checked stay approved
    websiteFinished: Boolean(site?.finished && site.approvedAt),
    websiteConnected: Boolean(site?.existingSite),
    products: items?.total ?? 0,
    confirmedKinds: kinds.map((row) => row.kind),
    marketingApproved: Boolean(marketing?.approvedAt),
    socialPlatforms: intake?.include ?? [],
    socialHave: intake?.have ?? [],
    marks: marks.map((mark) => mark.key),
  };
}
