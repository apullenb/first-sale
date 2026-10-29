import "server-only";
import type { BrandFile } from "@/lib/brand/types";
import type { LibraryPhoto } from "@/lib/data/product-photos";
import {
  getMyBrand,
  getMyBrandAsset,
  getMyBrandAssetFile,
  getMyBusiness,
  getMyDetails,
  getMyPhotoVersionFile,
  getMyWebsitePlan,
  listMyPhotoLibrary,
} from "@/lib/data/my-business";
import type { WebsitePlan } from "@/lib/data/website";
import { displayName } from "@/lib/intake/answers";
import { brandAssetId, lookFromBrand } from "@/lib/website/look";
import { type AssetFile, bundleSite, type BundleAssets } from "@/lib/website/site/bundle";
import { photosShown, type SiteState } from "@/lib/website/site/check";
import { readDesign } from "@/lib/website/site/design";
import { copyOf } from "@/lib/website/words";

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
  const [business, plan, brand, details, library] = await Promise.all([getMyBusiness(), getMyWebsitePlan(), getMyBrand(), getMyDetails(), listMyPhotoLibrary()]);
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
    contact: { email: detail("business_email"), phone: detail("business_phone") },
    // Read after the session, so the page renders at request time
    year: new Date().getUTCFullYear(),
  };
}

async function brandAsset(file: BrandFile | null): Promise<AssetFile | null> {
  const id = brandAssetId(file);
  const stored = id ? await getMyBrandAssetFile(id) : null;
  return file && stored ? { mimeType: stored.mimeType, data: stored.data, width: file.width, height: file.height } : null;
}

// The files that go online, read from the owner's saved pictures
export async function siteFiles(site: LoadedSite) {
  if (!site.content) return null;
  const { brand, design } = site;
  const photos: BundleAssets["photos"] = {};
  for (const photo of photosShown(site)) {
    const stored = await getMyPhotoVersionFile(photo.photoId, photo.id);
    if (stored) photos[photo.id] = { mimeType: stored.mimeType, data: stored.data, width: photo.width, height: photo.height };
  }
  const assets: BundleAssets = {
    logo: design.showLogo ? await brandAsset(brand?.logos.primary ?? null) : null,
    favicon: design.showLogo ? await brandAsset(brand?.logos.profile ?? null) : null,
    hero: design.showHero ? await brandAsset(brand?.images.websiteHero ?? null) : null,
    photos,
  };
  return bundleSite({ name: site.name, copy: copyOf(site.content), design, contact: site.contact, year: site.year }, assets);
}
