import { createHash } from "node:crypto";
import { itemFor, shows } from "./design";
import { renderSite, type SiteImage, type SiteInput } from "./render";

// The files that go online: the page plus copies of the pictures it shows, with paths that work on any host

export interface AssetFile {
  mimeType: string;
  data: Uint8Array;
  width: number;
  height: number;
}

export interface BundleAssets {
  logo: AssetFile | null;
  hero: AssetFile | null;
  favicon: AssetFile | null;
  // By photo version id
  photos: Record<string, AssetFile>;
}

export interface SiteFile {
  path: string;
  body: Uint8Array;
  contentType: string;
}

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

export type BundleInput = Omit<SiteInput, "images" | "highlightNotes">;

export function bundleSite(input: BundleInput, assets: BundleAssets): { files: SiteFile[]; hash: string } {
  const files: SiteFile[] = [];
  const add = (name: string, asset: AssetFile | null): SiteImage | null => {
    const extension = asset ? EXTENSIONS[asset.mimeType] : undefined;
    if (!asset || !extension) return null;
    const path = `assets/${name}.${extension}`;
    files.push({ path, body: asset.data, contentType: asset.mimeType });
    return { src: path, width: asset.width, height: asset.height };
  };

  const { design, copy } = input;
  const photos: Record<string, SiteImage> = {};
  if (shows(design, "offerings")) {
    copy.offerings.forEach((offering, index) => {
      const ref = itemFor(design, offering.name)?.photo;
      if (!ref || photos[ref.versionId]) return;
      const image = add(`item-${index + 1}`, assets.photos[ref.versionId] ?? null);
      if (image) photos[ref.versionId] = image;
    });
  }
  const images = {
    logo: design.showLogo ? add("logo", assets.logo) : null,
    hero: design.showHero ? add("header", assets.hero) : null,
    favicon: design.showLogo ? add("icon", assets.favicon) : null,
    photos,
  };
  const html = renderSite({ ...input, images, highlightNotes: false });
  files.unshift({ path: "index.html", body: new TextEncoder().encode(html), contentType: "text/html; charset=utf-8" });
  return { files, hash: siteHash(files) };
}

export function sha1(data: Uint8Array): string {
  return createHash("sha1").update(data).digest("hex");
}

// Changes whenever any file or path does; the owner publishes the version they last saw
export function siteHash(files: SiteFile[]): string {
  const hash = createHash("sha256");
  for (const file of files) hash.update(`${file.path}\n${sha1(file.body)}\n`);
  return hash.digest("hex").slice(0, 32);
}
