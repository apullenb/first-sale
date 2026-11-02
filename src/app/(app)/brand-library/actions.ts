"use server";

import { isDemoSession } from "@/lib/auth/server";
import { DEMO_REFUSAL } from "@/lib/demo";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { LIBRARY_GROUPS } from "@/lib/brand/library";
import { checkLibraryUpload } from "@/lib/brand/upload";
import { addMyLibraryFile, deleteMyLibraryFile } from "@/lib/data/my-business";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";

const UPLOAD_MESSAGES = {
  no_business: "Tell us about your business first.",
  too_many: "Your Brand Library is full. Delete pictures you don’t need, then try again.",
  too_large: "Your Brand Library is out of space. Delete pictures you don’t need, then try again.",
} as const;

// A picture the owner adds, kept exactly as uploaded
export async function uploadLibraryFileAction(form: FormData): Promise<ActionResult<string>> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const file = form.get("file");
  const name = form.get("name");
  const group = z.enum(LIBRARY_GROUPS).safeParse(form.get("group"));
  if (!(file instanceof File)) return { ok: false, message: "Choose a picture to upload." };
  if (!group.success) return { ok: false, message: "Choose where it goes in your library." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "That file is over 4 MB. Save a smaller copy, then upload that." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkLibraryUpload(bytes, file.name, typeof name === "string" ? name : "");
  if (!check.ok) return check;

  const added = await addMyLibraryFile({ group: group.data, title: check.title, mimeType: check.type, sha256: check.sha256, width: check.width, height: check.height, data: bytes });
  if (!added.ok) return { ok: false, message: UPLOAD_MESSAGES[added.reason] };
  refresh();
  return { ok: true, value: added.id };
}

// Only the owner's own uploads can be deleted; generated files and product photos are managed on their own pages
export async function deleteLibraryFileAction(fileId: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.string().min(1).max(60).safeParse(fileId);
  if (!parsed.success || !(await deleteMyLibraryFile(parsed.data))) return { ok: false, message: "That picture wasn’t found. It may have been deleted already." };
  refresh();
  return { ok: true, value: null };
}
