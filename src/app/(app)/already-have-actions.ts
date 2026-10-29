"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { MARKETING_PLATFORMS } from "@/data/marketing-platforms";
import { clearMyJourneyMark, setMyJourneyMark } from "@/lib/data/my-business";
import { MARK_KEYS } from "@/lib/rules/section-status";

const KEYS = new Set<string>([...MARK_KEYS, ...MARKETING_PLATFORMS.map((platform) => `social:${platform}`)]);
const keySchema = z.string().refine((key) => KEYS.has(key));
const markSchema = z.object({
  key: keySchema,
  // Only web links; anything else is left out
  url: z
    .string()
    .trim()
    .max(500)
    .transform((url) => url || null)
    .pipe(z.url({ protocol: /^https?$/ }).nullable()),
  note: z
    .string()
    .trim()
    .max(500)
    .transform((note) => note || null),
});

const NO_BUSINESS = "Your business wasn’t found. Reload the page and try again.";

// "I already have this": the step counts as done, with the owner's link or note
export async function setAlreadyHaveAction(input: unknown): Promise<ActionResult> {
  const parsed = markSchema.safeParse(input);
  if (!parsed.success) {
    const badUrl = parsed.error.issues.some((issue) => issue.path[0] === "url");
    return { ok: false, message: badUrl ? "That link doesn’t look like a web address. Check it, or leave it empty." : "That step wasn’t found. Reload the page and try again." };
  }
  if (!(await setMyJourneyMark(parsed.data))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

export async function clearAlreadyHaveAction(input: unknown): Promise<ActionResult> {
  const parsed = keySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That step wasn’t found. Reload the page and try again." };
  await clearMyJourneyMark(parsed.data);
  refresh();
  return { ok: true, value: null };
}
