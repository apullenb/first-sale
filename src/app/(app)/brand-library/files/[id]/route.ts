import type { NextRequest } from "next/server";
import { brandFileResponse } from "@/lib/brand/serve";
import { getMyLibraryFile } from "@/lib/data/my-business";
import { notFoundResponse } from "@/lib/photos/download";

// A picture the owner added to their Brand Library, byte for byte as uploaded
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.length > 60) return notFoundResponse();
  const file = await getMyLibraryFile(id);
  if (!file) return notFoundResponse();
  return brandFileResponse({ name: file.title, mimeType: file.mimeType, data: file.data }, request.nextUrl.searchParams.get("view") === "1");
}
