import "server-only";
import {
  getMyBrand,
  getMyBrandState,
  getMyBusiness,
  getMyDetails,
  getMyPaperwork,
  getMyResearch,
  getMyWebsitePlan,
  listMyDocuments,
  listMyPhotoLibrary,
} from "@/lib/data/my-business";
import { stillToSettle } from "@/lib/rules/paperwork";
import { buildInputs, type InsightInputs } from "./facts";

// Everything the insights read, for the signed-in owner. Null until they've answered the intake.
export async function gatherMyInsightInputs(): Promise<InsightInputs | null> {
  const [business, details, research, paper, documents, brand, kit, website, photos] = await Promise.all([
    getMyBusiness(),
    getMyDetails(),
    getMyResearch(),
    getMyPaperwork(),
    listMyDocuments(),
    getMyBrandState(),
    getMyBrand(),
    getMyWebsitePlan(),
    listMyPhotoLibrary(),
  ]);
  if (!business?.profile) return null;
  return buildInputs({
    profile: business.profile,
    details,
    research,
    // Steps that apply, with what applies now, then rules still to settle, marked as maybes
    steps: [
      ...(paper?.basis ? paper.view.tasks : []).map((task) => ({ ...task.step, requirementStatus: task.requirementStatus, conditions: task.conditions })),
      ...(paper?.basis ? stillToSettle(paper.view) : []).map((standing) => ({ ...standing.step, requirementStatus: standing.requirementStatus, mayApply: true })),
    ],
    planInputs: documents.find((doc) => doc.generatedKind === "business_plan")?.draft?.inputs ?? null,
    brand,
    brandColors: kit?.colors ?? [],
    website,
    approvedPhotos: photos.length,
  });
}
