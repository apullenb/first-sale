import "server-only";
import { getMyBrandState } from "@/lib/data/my-business";
import { imagePreview, websiteImage } from "@/lib/website/site/media";
import { brandAssetId } from "@/lib/website/look";
import { copyOf } from "@/lib/website/words";
import type { ThemeFacts } from "@/lib/website/site/theme";
import type { LoadedSite } from "./site-data";

async function preview(id: string, photoId: string): Promise<string | undefined> {
  const file = await websiteImage(id, photoId);
  if (!file) return undefined;
  try { return `data:image/webp;base64,${Buffer.from(await imagePreview(file.data, 640)).toString("base64")}`; }
  catch { return undefined; }
}

export async function themeFacts(site: LoadedSite, request: string): Promise<ThemeFacts> {
  const state = await getMyBrandState();
  const brief = state?.brief;
  const logoId = brandAssetId(site.brand?.logos.primary ?? null);
  const images: ThemeFacts["images"] = site.library.map(({ id, title, width, height }) => ({ id, title, width, height, purpose: id === site.design.heroImage?.versionId ? "selected header" : id.startsWith("brand:") ? "brand image" : "library image" }));
  if (logoId && site.brand?.logos.primary) images.unshift({ id: `brand:${logoId}`, title: "Approved business logo", purpose: "logo", width: site.brand.logos.primary.width, height: site.brand.logos.primary.height });
  const candidates = [images.find((image) => image.purpose === "logo"), images.find((image) => image.purpose === "selected header"), images.find((image) => image.purpose !== "logo" && image.width > image.height * 1.2), images.find((image) => image.purpose !== "logo")].filter((image) => image !== undefined);
  await Promise.all([...new Map(candidates.map((image) => [image.id, image])).values()].slice(0, 3).map(async (image) => {
    const photo = site.library.find((photo) => photo.id === image.id);
    image.preview = await preview(image.id, photo?.photoId ?? logoId ?? "");
  }));
  return {
    brief: brief ? { name: brief.name, tagline: brief.tagline, sells: brief.sells, customers: brief.customers, vibes: brief.vibes, leanings: brief.leanings, colors: brief.colors, likedColors: brief.likedColors, avoidColors: brief.avoidColors, story: brief.storyApproved ? brief.story : "" } : null,
    palette: site.brand?.colors ?? [], lettering: site.brand?.lettering, images,
    products: site.products.map((product) => ({ name: product.name, description: product.description, hasPhoto: Boolean(product.photo) })),
    currentTheme: site.design.theme, currentCopy: site.content ? copyOf(site.content) : undefined, request,
  };
}
