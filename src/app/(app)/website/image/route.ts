import { createHash } from "node:crypto";
import { imagePreview, websiteImage } from "@/lib/website/site/media";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = await websiteImage(url.searchParams.get("key") ?? "", url.searchParams.get("photo") ?? "");
  if (!file) return new Response("Image not found", { status: 404 });
  const etag = `"${createHash("sha256").update(file.data).digest("hex").slice(0, 32)}"`;
  const headers = { "Cache-Control": "private, max-age=0, must-revalidate", ETag: etag, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  try {
    const bytes = await imagePreview(file.data, 320);
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch { return new Response("Image could not be opened", { status: 422 }); }
}
