import type { NextRequest } from "next/server";
import { getMyItemPictureFile } from "@/lib/data/my-business";
import { notFoundResponse, photoResponse } from "@/lib/photos/download";

// A picture made from an item's description, exactly as stored
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id.length > 60) return notFoundResponse();
  const file = await getMyItemPictureFile(id);
  if (!file) return notFoundResponse();
  const name = `${file.name} - picture${file.simulated ? " - practice preview" : ""}`;
  return photoResponse({ name, mimeType: file.mimeType, data: file.data }, request.nextUrl.searchParams.get("view") === "1");
}
