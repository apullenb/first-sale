import "server-only";
import type { NavStatus } from "@/components/nav-links";
import { getMyBrandStepFacts, getMyBusiness, getMyDetails, getMyPlan, getMyResearch, listMyDocuments, type MyBusiness } from "@/lib/data/my-business";
import { autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { structureOf } from "@/lib/research/applicability";
import { profileKey } from "@/lib/research/requirements";
import { nextActions } from "@/lib/rules/next-action";
import { remainingWork } from "@/lib/rules/progress";
import { sidebarStatus } from "@/lib/rules/section-status";

// Which menu steps are done, waiting or left, from the owner's saved work
export async function getMySidebarStatus(): Promise<{ business: MyBusiness | null; status: NavStatus | null }> {
  const [business, plan, research, details, documents, brand] = await Promise.all([
    getMyBusiness(),
    getMyPlan(),
    getMyResearch(),
    getMyDetails(),
    listMyDocuments(),
    getMyBrandStepFacts(),
  ]);
  if (!business) return { business: null, status: null };
  const profile = business.profile;
  const steps = plan?.steps ?? [];
  const actions = nextActions(steps);
  const work = remainingWork(steps);
  const facts = profile ? autofillFacts(profile, details) : [];
  const toCheck = documents.filter(
    (doc) => doc.role !== "reviewed" && (outdatedFacts(doc.factsUsed, facts).length > 0 || Object.values(doc.answers).some((answer) => answer.state === "suggested")),
  );
  const parts = sidebarStatus({
    business: Boolean(profile),
    research: !research ? "none" : profile && profileKey(profile) === research.profileKey ? "current" : "stale",
    structureChosen: Boolean(profile && structureOf(profile, details).structure),
    plan: {
      exists: steps.length > 0,
      proposal: Boolean(plan?.proposal),
      ready: actions.now.length + actions.decide.length,
      left: work.left.length,
      minutes: work.minutes,
      waiting: work.waiting.length,
    },
    libraryToCheck: toCheck.length,
    logoChosen: brand?.logoChosen ?? false,
    logoVersionsApproved: brand?.logoVersionsApproved ?? false,
    websiteLive: brand?.websiteLive ?? false,
    products: brand?.products ?? 0,
    marketingApproved: brand?.marketingApproved ?? false,
    socialPlatforms: brand?.socialPlatforms ?? [],
    marks: new Set(brand?.marks ?? []),
  });
  return { business, status: { parts, scope: business.id } };
}
