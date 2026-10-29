import "server-only";
import type { BrandFile } from "@/lib/brand/types";
import type { LibraryPhoto } from "@/lib/data/product-photos";
import { getMyBrand, getMyBrandAsset, getMyBusiness, getMyDetails, getMyWebsitePlan, listMyPhotoLibrary, listMyProducts } from "@/lib/data/my-business";
import type { WebsitePlan } from "@/lib/data/website";
import { displayName } from "@/lib/intake/answers";
import { brandAssetId, lookFromBrand } from "@/lib/website/look";
import type { SiteState } from "@/lib/website/site/check";
import { readDesign } from "@/lib/website/site/design";

export { publishCheck, siteSignature } from "@/lib/website/site/check";

// Everything the built site is made from, read for the signed-in owner

export interface LoadedSite extends SiteState {
  plan: WebsitePlan | null;
  library: LibraryPhoto[];
}

// A brand file is practice when it, or the round it came from, was made without the image service
async function practiceFile(file: BrandFile | null): Promise<boolean> {
  const id = brandAssetId(file);
  const asset = id ? await getMyBrandAsset(id) : null;
  return Boolean(asset && (asset.simulated || asset.roundSimulated));
}

export async function loadSite(): Promise<LoadedSite | null> {
  const [business, plan, brand, details, library, products] = await Promise.all([
    getMyBusiness(),
    getMyWebsitePlan(),
    getMyBrand(),
    getMyDetails(),
    listMyPhotoLibrary(),
    listMyProducts(),
  ]);
  if (!business?.profile) return null;
  const [logo, hero, icon] = await Promise.all([
    practiceFile(brand?.logos.primary ?? null),
    practiceFile(brand?.images.websiteHero ?? null),
    practiceFile(brand?.logos.profile ?? null),
  ]);
  const detail = (key: string) => details.find((each) => each.key === key)?.value.trim() || null;
  return {
    profile: business.profile,
    plan,
    platform: plan?.platform ?? null,
    approved: Boolean(plan?.contentApprovedAt),
    name: displayName(business.profile),
    content: plan?.content ?? null,
    design: readDesign(plan?.design, lookFromBrand(brand).primary),
    brand,
    brandPractice: { logo, hero, icon },
    library,
    products: products.map((product) => ({ id: product.id, name: product.name, description: product.description, priceCents: product.priceCents })),
    contact: { email: detail("business_email"), phone: detail("business_phone") },
    // Read after the session, so the page renders at request time
    year: new Date().getUTCFullYear(),
  };
}
