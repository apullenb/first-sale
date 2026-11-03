import "server-only";
import { z } from "zod";
import { squareRequest, type SquareItem } from "./client";
import { checkPhotoUpload } from "@/lib/photos/upload";
import type { NewPhoto } from "@/lib/data/product-photos";

const MAX_BYTES = 4_000_000;
export function squareImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      (url.hostname === "items-images-sandbox.s3.us-west-2.amazonaws.com" || url.hostname === "square-catalog-sandbox.s3.amazonaws.com" || url.hostname === "square-catalog.s3.amazonaws.com" || url.hostname === "items-images-production.s3.us-west-2.amazonaws.com" || url.hostname === "items-images-staging.s3.us-west-2.amazonaws.com" || url.hostname.endsWith(".editmysite.com")) ? url : null;
  } catch { return null; }
}

export async function retrieveProductPhoto(token: string, item: SquareItem): Promise<NewPhoto | null> {
  const ids = z.array(z.string()).safeParse(item.item_data.image_ids);
  if (!ids.success || !ids.data.length) return null;
  const response = await squareRequest(`/v2/catalog/object/${encodeURIComponent(ids.data[0])}`, token);
  const image = z.object({ object: z.object({ type: z.literal("IMAGE"), image_data: z.object({ url: z.string() }) }) }).safeParse(response);
  if (!image.success) throw new Error("Square’s product photo is unavailable.");
  const url = squareImageUrl(image.data.object.image_data.url);
  if (!url) throw new Error("Square’s product photo has an unsupported address.");
  const download = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!download.ok || !download.body || Number(download.headers.get("content-length")) > MAX_BYTES) throw new Error("Square’s product photo could not be downloaded.");
  const reader = download.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("Square’s product photo is too large.");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const data = Buffer.concat(chunks);
  const check = checkPhotoUpload(data, "square-product.jpg", item.item_data.name);
  if (!check.ok) throw new Error(check.message);
  return { title: check.title, mimeType: check.type, sha256: check.sha256, width: check.width, height: check.height, data };
}
