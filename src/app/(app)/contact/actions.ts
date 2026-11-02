"use server";

import { isDemoSession } from "@/lib/auth/server";
import { DEMO_REFUSAL } from "@/lib/demo";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { clearMyJourneyMark, saveMyDetails, setMyJourneyMark } from "@/lib/data/my-business";
import { detailProblem } from "@/lib/details";
import { CONTACT_CHOICES, CONTACT_DETAIL, CONTACT_ITEMS, contactHaveKey, contactLaterKey } from "@/lib/rules/contact-setup";

const NO_BUSINESS = "Your business wasn’t found. Reload the page and try again.";
const UNKNOWN = "That choice wasn’t found. Reload the page and try again.";

const mark = (key: string, note: string | null = null) => setMyJourneyMark({ key, url: null, note });

const haveSchema = z.object({ item: z.enum(CONTACT_ITEMS), value: z.string().max(300) });

// "I have one": saved to Business details, where forms and the website read public contact details
export async function saveContactAction(input: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = haveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: UNKNOWN };
  const { item, value } = parsed.data;
  const key = CONTACT_DETAIL[item];
  const problem = detailProblem(key, value);
  if (problem) return { ok: false, message: problem };
  if (!(await saveMyDetails([{ key, value: value.trim() }]))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

const choiceSchema = z.object({ item: z.enum(CONTACT_ITEMS), choice: z.enum(CONTACT_CHOICES) });

// "Help me set one up" or "Do this later": either way a step stays in the plan until it's done
export async function chooseContactAction(input: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = choiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: UNKNOWN };
  if (!(await mark(contactLaterKey(parsed.data.item), parsed.data.choice))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

// "I already have this", without typing it in
export async function markContactHaveAction(item: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.enum(CONTACT_ITEMS).safeParse(item);
  if (!parsed.success) return { ok: false, message: UNKNOWN };
  if (!(await mark(contactHaveKey(parsed.data)))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

export async function undoContactHaveAction(item: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = z.enum(CONTACT_ITEMS).safeParse(item);
  if (!parsed.success) return { ok: false, message: UNKNOWN };
  await clearMyJourneyMark(contactHaveKey(parsed.data));
  refresh();
  return { ok: true, value: null };
}
