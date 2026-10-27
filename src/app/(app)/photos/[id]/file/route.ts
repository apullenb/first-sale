import type { NextRequest } from "next/server";
import { getMyPhotoFile } from "@/lib/data/my-business";
import { notFoundResponse, photoFileName, photoResponse } from "@/lib/photos/download";

// The original upload, exactly as stored. Signed-out visitors are sent to log in by getMyPhotoFile.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.length > 60) return notFoundResponse();
  const file = await getMyPhotoFile(id);
  if (!file) return notFoundResponse();
  return photoResponse({ ...file, name: photoFileName(file.title, null) }, request.nextUrl.searchParams.get("view") === "1");
}
