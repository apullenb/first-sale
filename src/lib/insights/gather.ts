import "server-only";
import {
  getMyBrand,
  getMyBrandState,
  getMyBusiness,
  getMyDetails,
  getMyPlan,
  getMyResearch,
  getMyWebsitePlan,
  listMyDocuments,
  listMyPhotoLibrary,
} from "@/lib/data/my-business";
import { buildInputs, type InsightInputs } from "./facts";

// Everything the insights read, for the signed-in owner. Null until they've answered the intake.
export async function gatherMyInsightInputs(): Promise<InsightInputs | null> {
  const [business, details, research, plan, documents, brand, kit, website, photos] = await Promise.all([
    getMyBusiness(),
    getMyDetails(),
    getMyResearch(),
    getMyPlan(),
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
    steps: plan?.steps ?? [],
    planInputs: documents.find((doc) => doc.generatedKind === "business_plan")?.draft?.inputs ?? null,
    brand,
    brandColors: kit?.colors ?? [],
    website,
    approvedPhotos: photos.length,
  });
}
