import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { NavStatus } from "@/components/nav-links";
import { getMyBusiness, getMyDetails, getMyPlan, getMySidebarFacts, type MyBusiness } from "@/lib/data/my-business";
import { autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { structureOf } from "@/lib/research/applicability";
import { profileKey } from "@/lib/research/requirements";
import { choosesStructure } from "@/lib/rules/plan";
import { remainingWork } from "@/lib/rules/progress";
import { readyPlanSteps, sidebarStatus } from "@/lib/rules/section-status";

// Which menu steps are done, waiting or left. The marks are extra: if they can't be read, the business card still shows.
export async function getMySidebarStatus(): Promise<{ business: MyBusiness | null; status: NavStatus | null }> {
  const business = await getMyBusiness();
  if (!business) return { business: null, status: { parts: {}, scope: null } };
  try {
    return { business, status: await statusFor(business) };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Sidebar steps skipped:", error instanceof Error ? error.name : "unknown error");
    return { business, status: null };
  }
}

async function statusFor(business: MyBusiness): Promise<NavStatus> {
  const [plan, details, saved] = await Promise.all([getMyPlan(), getMyDetails(), getMySidebarFacts()]);
  const profile = business.profile;
  const structureChosen = Boolean(profile && structureOf(profile, details).structure);
  const steps = plan?.steps ?? [];
  // Choosing a structure belongs to Business structure; it still holds up the steps after it
  const work = remainingWork(steps.filter((step) => !choosesStructure(step)));
  const structureWork = remainingWork(steps.filter(choosesStructure));
  const facts = profile ? autofillFacts(profile, details) : [];
  const toCheck = (saved?.documents ?? []).filter(
    (doc) => doc.role !== "reviewed" && (outdatedFacts(doc.factsUsed, facts).length > 0 || Object.values(doc.answers).some((answer) => answer.state === "suggested")),
  );
  const parts = sidebarStatus({
    business: Boolean(profile),
    research: !saved?.researchKey ? "none" : profile && profileKey(profile) === saved.researchKey ? "current" : "stale",
    structureChosen,
    structureStep: { left: structureWork.left.length, minutes: structureWork.minutes },
    plan: {
      exists: steps.length > 0,
      proposal: Boolean(plan?.proposal),
      ready: readyPlanSteps(steps),
      left: work.left.length,
      minutes: work.minutes,
      waiting: work.waiting.length,
    },
    libraryToCheck: toCheck.length,
    logoChosen: saved?.logoChosen ?? false,
    brandDescribed: saved?.brandDescribed ?? false,
    websiteLive: saved?.websiteLive ?? false,
    products: saved?.products ?? 0,
    marketingApproved: saved?.marketingApproved ?? false,
    socialPlatforms: saved?.socialPlatforms ?? [],
    socialHave: saved?.socialHave ?? [],
    marks: new Set(saved?.marks ?? []),
  });
  return { parts, scope: business.id };
}
