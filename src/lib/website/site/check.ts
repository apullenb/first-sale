import { createHash } from "node:crypto";
import type { BrandKit } from "@/lib/brand/types";
import type { BusinessProfile } from "@/lib/domain";
import { brandAssetId } from "@/lib/website/look";
import type { PlatformId, WebsiteContent } from "@/lib/website/types";
import { copyOf } from "@/lib/website/words";
import { itemFor, type SiteDesign, type SiteProduct, shows, withProducts } from "./design";
import type { PublishCheck } from "./ready";

// The owner's saved site, as the page and the demo finish read it

export interface SitePhoto {
  // Version id
  id: string;
  photoId: string;
  width: number;
  height: number;
  simulated: boolean;
}

export interface SiteState {
  profile: BusinessProfile;
  platform: PlatformId | null;
  approved: boolean;
  name: string;
  content: WebsiteContent | null;
  design: SiteDesign;
  brand: BrandKit | null;
  // Each brand file's own practice flag, since the kit's covers every file in it
  brandPractice: { logo: boolean; hero: boolean; icon: boolean };
  library: SitePhoto[];
  // Saved on Add your products; they join the site's items
  products: SiteProduct[];
  contact: { email: string | null; phone: string | null };
  year: number;
}

// The words and design as the site shows them, with saved products added
export function shownSite(site: SiteState): { content: WebsiteContent | null; design: SiteDesign } {
  if (!site.content) return { content: null, design: site.design };
  const shown = withProducts(copyOf(site.content), site.products, site.design);
  return { content: { ...site.content, offerings: shown.copy.offerings }, design: shown.design };
}

// Approved photos the site shows, in item order
export function photosShown(site: SiteState): SitePhoto[] {
  const { library } = site;
  const { content, design } = shownSite(site);
  if (!content || !shows(design, "offerings")) return [];
  const shown = content.offerings.flatMap((offering) => {
    const ref = itemFor(design, offering.name)?.photo;
    const photo = ref ? library.find((each) => each.id === ref.versionId && each.photoId === ref.photoId) : undefined;
    return photo ? [photo] : [];
  });
  return [...new Map(shown.map((photo) => [photo.id, photo])).values()];
}

export function publishCheck(site: SiteState): PublishCheck {
  const { brand, brandPractice } = site;
  const { content, design } = shownSite(site);
  return {
    platform: site.platform,
    named: Boolean(site.profile.name?.trim()),
    content,
    approved: site.approved,
    design,
    contact: site.contact,
    practiceBrand: Boolean(
      (design.showLogo && ((brand?.logos.primary && brandPractice.logo) || (brand?.logos.profile && brandPractice.icon))) ||
        (design.showHero && brand?.images.websiteHero && brandPractice.hero),
    ),
    practicePhotos: photosShown(site).filter((photo) => photo.simulated).length,
  };
}

// Changes whenever anything on the site does. Saved pictures never change, so their ids stand for their bytes.
export function siteSignature(site: SiteState): string {
  const { brand } = site;
  const { content, design } = shownSite(site);
  const input = {
    name: site.name,
    copy: content ? copyOf(content) : null,
    design,
    logo: design.showLogo ? brandAssetId(brand?.logos.primary ?? null) : null,
    icon: design.showLogo ? brandAssetId(brand?.logos.profile ?? null) : null,
    hero: design.showHero ? brandAssetId(brand?.images.websiteHero ?? null) : null,
    photos: photosShown(site).map((photo) => photo.id),
    contact: site.contact,
    year: site.year,
  };
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32);
}
