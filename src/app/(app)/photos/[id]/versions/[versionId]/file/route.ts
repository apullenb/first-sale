import type { NextRequest } from "next/server";
import { getMyPhotoVersionFile } from "@/lib/data/my-business";
import { notFoundResponse, photoFileName, photoResponse } from "@/lib/photos/download";

// An edited version, byte for byte as the image service returned it
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  if (id.length > 60 || versionId.length > 60) return notFoundResponse();
  const file = await getMyPhotoVersionFile(id, versionId);
  if (!file) return notFoundResponse();
  return photoResponse({ ...file, name: photoFileName(file.title, file) }, request.nextUrl.searchParams.get("view") === "1");
}
