"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { checkLogoUpload, logoWords } from "@/lib/brand/upload";
import { addMyUploadedLogo, deleteMyUploadedLogo } from "@/lib/data/my-business";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";

const UPLOAD_MESSAGES = {
  no_business: "Tell us about your business first.",
  too_many: "You’ve made as many brand files as First Sale can keep. Remove logo ideas you don’t need, then try again.",
  too_large: "Your brand files are taking up all the space First Sale allows. Remove logo ideas you don’t need, then try again.",
} as const;

// The owner's own logo: kept byte for byte and chosen at once. The browser's key makes a retry return the same file.
export async function uploadLogoAction(form: FormData): Promise<ActionResult<string>> {
  const file = form.get("file");
  const words = form.get("words");
  const key = z.uuid().safeParse(form.get("requestKey"));
  if (!(file instanceof File)) return { ok: false, message: "Choose your logo file." };
  if (!key.success) return { ok: false, message: "Reload the page and try again." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "That file is over 4 MB. Save a smaller copy, then upload that." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkLogoUpload(bytes, file.name);
  if (!check.ok) return check;

  const added = await addMyUploadedLogo({
    requestKey: `upload:${key.data}`,
    title: check.title,
    words: logoWords(typeof words === "string" ? words : ""),
    mimeType: check.type,
    sha256: check.sha256,
    width: check.width,
    height: check.height,
    data: bytes,
  });
  if (!added.ok) return { ok: false, message: UPLOAD_MESSAGES[added.reason] };
  refresh();
  return { ok: true, value: added.id };
}

// Removes the upload with its versions and pictures; generated logos aren't removed here
export async function removeUploadedLogoAction(assetId: unknown): Promise<ActionResult> {
  const parsed = z.string().min(1).max(60).safeParse(assetId);
  if (!parsed.success || !(await deleteMyUploadedLogo(parsed.data))) return { ok: false, message: "That logo wasn’t found. Reload the page and try again." };
  refresh();
  return { ok: true, value: null };
}
