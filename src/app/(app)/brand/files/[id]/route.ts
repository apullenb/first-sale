import type { NextRequest } from "next/server";
import { brandFileName } from "@/lib/brand/files";
import { brandFileResponse } from "@/lib/brand/serve";
import { getMyBrandAssetFile } from "@/lib/data/my-business";
import { notFoundResponse } from "@/lib/photos/download";

// A logo, version or brand image, byte for byte as the image service returned it or the owner uploaded it
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.length > 60) return notFoundResponse();
  const file = await getMyBrandAssetFile(id);
  if (!file) return notFoundResponse();
  const name = file.origin === "uploaded" && file.title ? file.title : brandFileName(file.name, file.kind, file.simulated);
  return brandFileResponse({ ...file, name }, request.nextUrl.searchParams.get("view") === "1");
}
