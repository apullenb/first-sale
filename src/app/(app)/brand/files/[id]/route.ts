import type { NextRequest } from "next/server";
import { brandFileName } from "@/lib/brand/files";
import { brandFileResponse } from "@/lib/brand/serve";
import { seeThroughPng } from "@/lib/brand/see-through";
import { getMyBrandAssetFile } from "@/lib/data/my-business";
import { notFoundResponse } from "@/lib/photos/download";

const LOGO_KINDS = new Set(["logo", "stacked", "profile", "solid"]);

// A logo, version or brand image, byte for byte as the image service returned it or the owner uploaded it.
// With clear=1, a logo with its plain background removed (practice previews keep theirs, with the label).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.length > 60) return notFoundResponse();
  const file = await getMyBrandAssetFile(id);
  if (!file) return notFoundResponse();
  const name = file.origin === "uploaded" && file.title ? file.title : brandFileName(file.name, file.kind, file.simulated);
  const inline = request.nextUrl.searchParams.get("view") === "1";
  if (request.nextUrl.searchParams.get("clear") === "1" && LOGO_KINDS.has(file.kind) && !file.simulated && file.mimeType !== "image/svg+xml") {
    const clear = await seeThroughPng(file.data);
    if (clear) return brandFileResponse({ name: `${name.replace(/\.[a-z]+$/i, "")} - see-through`, mimeType: "image/png", data: clear }, inline);
  }
  return brandFileResponse({ ...file, name }, inline);
}
