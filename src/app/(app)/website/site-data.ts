import "server-only";
import type { BrandFile } from "@/lib/brand/types";
import type { SitePhoto } from "@/lib/website/site/check";
import { libraryFileUrl } from "@/lib/brand/library";
import { getMyBrand, getMyBrandState, listMyPhotos, listMyLibraryFiles, listMyItemPictures, getMyBrandAsset, getMyBusiness, getMyDetails, getMyWebsitePlan, listMyPhotoLibrary, listMyProducts } from "@/lib/data/my-business";
import type { WebsitePlan } from "@/lib/data/website";
import { displayName } from "@/lib/intake/answers";
import { brandAssetId, lookFromBrand } from "@/lib/website/look";
import type { SiteState } from "@/lib/website/site/check";
import { readDesign } from "@/lib/website/site/design";

export { publishCheck, siteSignature } from "@/lib/website/site/check";

// Everything the built site is made from, read for the signed-in owner

export interface LoadedSite extends SiteState {
  plan: WebsitePlan | null;
  library: (SitePhoto & { title: string; src: string })[];
}

// A brand file is practice when it, or the round it came from, was made without the image service
async function practiceFile(file: BrandFile | null): Promise<boolean> {
  const id = brandAssetId(file);
  const asset = id ? await getMyBrandAsset(id) : null;
  return Boolean(asset && (asset.simulated || asset.roundSimulated));
}

export async function loadSite(): Promise<LoadedSite | null> {
  const [business, plan, brand, details, versions, products, originals, files, pictures, brandState] = await Promise.all([
    getMyBusiness(),
    getMyWebsitePlan(),
    getMyBrand(),
    getMyDetails(),
    listMyPhotoLibrary(),
    listMyProducts(),
    listMyPhotos(),
    listMyLibraryFiles(),
    listMyItemPictures(),
    getMyBrandState(),
  ]);
  if (!business?.profile) return null;
  const [logo, hero, icon] = await Promise.all([
    practiceFile(brand?.logos.primary ?? null),
    practiceFile(brand?.images.websiteHero ?? null),
    practiceFile(brand?.logos.profile ?? null),
  ]);
  const library: LoadedSite["library"] = [
    ...versions.map((photo) => ({ ...photo, src: `/photos/${photo.photoId}/versions/${photo.id}/file?view=1` })),
    ...originals.map((photo) => ({ id: `original:${photo.id}`, photoId: photo.id, title: photo.title, width: photo.width, height: photo.height, simulated: false, src: `/photos/${photo.id}/file?view=1` })),
    ...files.map((file) => ({ ...file, id: `library:${file.id}`, photoId: file.id, simulated: false, src: libraryFileUrl(file.id) })),
    ...pictures.filter((picture) => picture.approvedAt).map((picture) => ({ ...picture, id: `picture:${picture.id}`, photoId: picture.id, width: 1, height: 1, title: products.find((product) => product.id === picture.productId)?.name ?? "Product photo", src: `/products/pictures/${picture.id}/file?view=1` })),
    ...(brandState?.assets ?? []).filter((asset) => !["logo", "stacked", "profile", "solid"].includes(asset.kind)).map((asset) => ({ ...asset, id: `brand:${asset.id}`, photoId: asset.id, title: asset.title ?? asset.kind.replaceAll("_", " "), src: `/brand/files/${asset.id}?view=1` })),
  ];
  const photoFor = (product: typeof products[number]) => {
    const ref = product.photo;
    const id = !ref ? null : ref.source === "version" ? ref.versionId : ref.source === "original" ? `original:${ref.photoId}` : ref.source === "library" ? `library:${ref.fileId}` : `picture:${ref.pictureId}`;
    const photo = library.find((photo) => photo.id === id);
    return photo ? { photoId: photo.photoId, versionId: photo.id } : null;
  };
  const detail = (key: string) => details.find((each) => each.key === key)?.value.trim() || null;
  const design = readDesign(plan?.design, lookFromBrand(brand).primary);
  if (!design.heroImage && design.showHero) {
    const chosenHero = brandAssetId(brand?.images.websiteHero ?? null);
    const hero = library.find((photo) => photo.id === `brand:${chosenHero}`) ?? library.find((photo) => (photo.id.startsWith("brand:") || photo.id.startsWith("library:")) && photo.width > photo.height * 1.2);
    if (hero) design.heroImage = { photoId: hero.photoId, versionId: hero.id };
  }
  return {
    profile: business.profile,
    plan,
    platform: plan?.platform ?? null,
    approved: Boolean(plan?.contentApprovedAt),
    name: displayName(business.profile),
    content: plan?.content ?? null,
    design,
    brand,
    brandPractice: { logo, hero, icon },
    library,
    products: products.map((product) => ({ id: product.id, name: product.name, description: product.description, photo: photoFor(product), priceCents: product.priceCents })),
    contact: { email: detail("business_email"), phone: detail("business_phone") },
    // Read after the session, so the page renders at request time
    year: new Date().getUTCFullYear(),
  };
}
