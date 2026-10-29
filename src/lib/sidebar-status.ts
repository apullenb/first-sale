import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { NavStatus } from "@/components/nav-links";
import { getMyBusiness, getMyDetails, getMyPlan, getMySidebarFacts, type MyBusiness } from "@/lib/data/my-business";
import { autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { structureOf } from "@/lib/research/applicability";
import { profileKey } from "@/lib/research/requirements";
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
  const steps = plan?.steps ?? [];
  const work = remainingWork(steps);
  const facts = profile ? autofillFacts(profile, details) : [];
  const toCheck = (saved?.documents ?? []).filter(
    (doc) => doc.role !== "reviewed" && (outdatedFacts(doc.factsUsed, facts).length > 0 || Object.values(doc.answers).some((answer) => answer.state === "suggested")),
  );
  const parts = sidebarStatus({
    business: Boolean(profile),
    research: !saved?.researchKey ? "none" : profile && profileKey(profile) === saved.researchKey ? "current" : "stale",
    structureChosen: Boolean(profile && structureOf(profile, details).structure),
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
    logoVersionsApproved: saved?.logoVersionsApproved ?? false,
    websiteLive: saved?.websiteLive ?? false,
    products: saved?.products ?? 0,
    marketingApproved: saved?.marketingApproved ?? false,
    socialPlatforms: saved?.socialPlatforms ?? [],
    socialHave: saved?.socialHave ?? [],
    marks: new Set(saved?.marks ?? []),
  });
  return { parts, scope: business.id };
}
