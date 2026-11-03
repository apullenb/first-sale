import "server-only";
import sharp from "sharp";
import { getMyBrandAssetFile, getMyLibraryFile, getMyPhotoFile, getMyPhotoVersionFile, getMyItemPictureFile } from "@/lib/data/my-business";

export async function websiteImage(key: string, photoId: string) {
  if (!key || key.length > 100 || photoId.length > 60) return null;
  const file = key.startsWith("brand:") ? await getMyBrandAssetFile(key.slice(6))
    : key.startsWith("library:") ? await getMyLibraryFile(key.slice(8))
    : key.startsWith("original:") ? await getMyPhotoFile(key.slice(9))
    : key.startsWith("picture:") ? await getMyItemPictureFile(key.slice(8))
    : photoId ? await getMyPhotoVersionFile(photoId, key) : null;
  return file && /^image\/(png|jpeg|webp)$/.test(file.mimeType) ? file : null;
}

export async function imagePreview(bytes: Uint8Array, size: number): Promise<Uint8Array> {
  return sharp(bytes, { limitInputPixels: 50_000_000, pages: 1 }).rotate().resize({ width: size, height: size, fit: "inside", withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
}
