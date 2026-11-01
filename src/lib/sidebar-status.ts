import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { NavStatus } from "@/components/nav-links";
import { getMyBusiness, getMyPaperwork, getMySidebarFacts, type MyBusiness } from "@/lib/data/my-business";
import { autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { profileKey } from "@/lib/research/requirements";
import { contactStatus } from "@/lib/rules/contact-setup";
import { choosesStructure } from "@/lib/rules/plan";
import { remainingWork } from "@/lib/rules/progress";
import { menuGroups, sidebarStatus, startSteps } from "@/lib/rules/section-status";

// Which menu steps are done, waiting, locked or left. The marks are extra: if they can't be read, the business card still shows.
export async function getMySidebarStatus(): Promise<{ business: MyBusiness | null; status: NavStatus | null }> {
  const business = await getMyBusiness();
  if (!business) {
    const parts = sidebarStatus({ ...NO_FACTS, business: false });
    return { business: null, status: { parts, scope: null, start: startSteps([]), groupOf: {} } };
  }
  try {
    return { business, status: await statusFor(business) };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Sidebar steps skipped:", error instanceof Error ? error.name : "unknown error");
    return { business, status: null };
  }
}

const NO_FACTS = {
  business: false,
  research: "none",
  questionsOpen: 0,
  structureChosen: false,
  structureStep: { left: 0, minutes: 0 },
  groups: [],
  libraryToCheck: 0,
  logoChosen: false,
  brandDescribed: false,
  websiteFinished: false,
  websiteConnected: false,
  products: 0,
  marketingApproved: false,
  socialPlatforms: [],
  socialHave: [],
  marks: new Set<string>(),
} satisfies Parameters<typeof sidebarStatus>[0];

async function statusFor(business: MyBusiness): Promise<NavStatus> {
  const [paper, saved] = await Promise.all([getMyPaperwork(), getMySidebarFacts()]);
  const profile = business.profile;
  const view = paper?.view ?? null;
  // Groups come from a check; before one, the placeholder stands in
  const groups = paper?.basis && view ? view.groups : [];
  const known = profile && paper ? autofillFacts(profile, paper.details) : [];
  const toCheck = (saved?.documents ?? []).filter(
    (doc) => doc.role !== "reviewed" && (outdatedFacts(doc.factsUsed, known).length > 0 || Object.values(doc.answers).some((answer) => answer.state === "suggested")),
  );
  const structureWork = remainingWork((paper?.plan.steps ?? []).filter(choosesStructure));
  const facts = menuGroups(groups);
  const contact = contactStatus((paper?.details ?? []).map((detail) => detail.key), saved?.marks ?? []).step;
  const parts = sidebarStatus({
    business: Boolean(profile),
    research: !paper?.basis ? "none" : profile && profileKey(profile) === paper.basis.profileKey ? "current" : "stale",
    questionsOpen: view?.open.length ?? 0,
    structureChosen: Boolean(paper?.context.decision.structure),
    structureStep: { left: structureWork.left.length, minutes: structureWork.minutes },
    groups: facts,
    libraryToCheck: toCheck.length,
    logoChosen: saved?.logoChosen ?? false,
    brandDescribed: saved?.brandDescribed ?? false,
    websiteFinished: saved?.websiteFinished ?? false,
    websiteConnected: saved?.websiteConnected ?? false,
    products: saved?.products ?? 0,
    marketingApproved: saved?.marketingApproved ?? false,
    socialPlatforms: saved?.socialPlatforms ?? [],
    socialHave: saved?.socialHave ?? [],
    marks: new Set(saved?.marks ?? []),
    contact,
  });
  return {
    parts,
    scope: business.id,
    start: startSteps(facts, contact !== "none"),
    // A part's page, or a task's, highlights its group's menu step
    groupOf: Object.fromEntries([
      ...facts.flatMap((group) => group.hrefs.map((href) => [href, group.href])),
      ...(view?.tasks ?? []).map((task) => {
        const href = groups.find((group) => group.key === task.group)?.href;
        return [`/checklist/${task.step.id}`, facts.find((group) => href && group.hrefs.includes(href))?.href ?? "/start"];
      }),
    ]),
  };
}
