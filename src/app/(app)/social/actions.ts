"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { MARKETING_PLATFORMS, PLATFORM_DATA } from "@/data/marketing-platforms";
import { PROFILE_FACTS } from "@/data/social-profiles";
import { getModel } from "@/lib/ai";
import { getMyBrandState, getMyBusiness, getMyMarketing, listMyJourneyMarks, myAiKey, updateMyMarketing } from "@/lib/data/my-business";
import { OwnerFacingError } from "@/lib/errors";
import { completeIntake, SKILL_LEVELS } from "@/lib/marketing/intake";
import { checkBio, checkHandle, checkName, isSetUp, socialAccounts, withPickedAccounts } from "@/lib/rules/social";
import { bioFacts, draftBios } from "@/lib/social/bios";
import { MAX_FIELD } from "@/lib/social/types";
import { runWorkflow } from "@/lib/workflow-runner";

const NO_BUSINESS = "Tell us about your business first.";
const NOT_IN_PLAN = "That account isn’t in your marketing answers. Reload the page and try again.";

// One account's bio again, or a first bio for each account not set up yet. With one account, the name and handle
// the owner has typed so far are kept, saved or not.
const draftSchema = z.object({
  platform: z.enum(MARKETING_PLATFORMS).nullable(),
  typed: z.object({ name: z.string().trim().max(MAX_FIELD.name), handle: z.string().trim().max(MAX_FIELD.handle) }).optional(),
});

export async function draftSocialBiosAction(input: unknown): Promise<ActionResult> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const { platform, typed } = parsed.data;
  const [business, marketing, brand, marks] = await Promise.all([getMyBusiness(), getMyMarketing(), getMyBrandState(), listMyJourneyMarks()]);
  if (!business?.profile) return { ok: false, message: NO_BUSINESS };
  const intake = marketing?.intake ?? null;
  if (!intake) return { ok: false, message: "Pick your accounts first." };
  const accounts = socialAccounts(intake, marketing?.plan ?? null);
  if (platform && !accounts.some((account) => account.id === platform)) return { ok: false, message: NOT_IN_PLAN };
  const social = marketing?.social ?? {};
  const keys = new Set(marks.map((mark) => mark.key));
  const want = accounts
    .filter((account) => PROFILE_FACTS[account.id]?.bio && (platform ? account.id === platform : !social[account.id]?.bio && !isSetUp(account, keys)))
    .map((account) => account.id);
  if (!want.length) return { ok: false, message: "Your bios are written. Edit one to change it, or draft it again." };
  const facts = bioFacts(business.profile, brand?.brief ?? null);

  return runWorkflow("social_bios", null, async () => {
    const drafted = await draftBios(getModel(), facts, want, intake.exclude, await myAiKey());
    const saved = await updateMyMarketing((latest) => {
      const next = { ...(latest?.social ?? {}) };
      for (const id of want) {
        const draft = drafted[id];
        const current = next[id];
        // Written while this ran: the owner's words stay
        if (!draft || (!platform && current?.bio)) continue;
        const kept = platform && typed ? typed : { name: current?.name ?? "", handle: current?.handle ?? "" };
        next[id] = { ...kept, bio: draft.bio, bioBy: draft.by, notes: draft.notes, approvedAt: null };
      }
      return { social: next };
    });
    if (saved === "no_business") throw new OwnerFacingError(NO_BUSINESS);
    return null;
  });
}

const profileSchema = z.object({
  platform: z.enum(MARKETING_PLATFORMS),
  name: z.string().trim().max(MAX_FIELD.name),
  handle: z
    .string()
    .trim()
    .transform((handle) => handle.replace(/^@+/, ""))
    .pipe(z.string().max(MAX_FIELD.handle)),
  bio: z.string().trim().max(MAX_FIELD.bio),
  approve: z.boolean(),
});

// Saves the owner's name, handle and bio; approving checks each against the platform's limits first
export async function saveSocialProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Something is too long. Shorten it and try again." };
  const { platform, name, handle, bio, approve } = parsed.data;
  const facts = PROFILE_FACTS[platform];
  if (!facts) return { ok: false, message: NOT_IN_PLAN };
  if (approve) {
    const problems = [
      ...checkName(name, facts),
      ...(facts.handle ? checkHandle(handle, facts.handle) : []),
      ...(facts.bio ? checkBio(bio, facts.bio, PLATFORM_DATA[platform].name) : []),
    ];
    if (problems.length) return { ok: false, message: problems[0] };
  }

  let missing = false;
  const saved = await updateMyMarketing((latest) => {
    if (!latest?.intake?.include.includes(platform)) {
      missing = true;
      return null;
    }
    const current = latest.social[platform];
    const changed = bio !== (current?.bio ?? "");
    return {
      social: {
        ...latest.social,
        [platform]: {
          name,
          handle: facts.handle ? handle : "",
          bio: facts.bio ? bio : "",
          bioBy: changed ? (bio ? "owner" : null) : (current?.bioBy ?? null),
          notes: changed ? [] : (current?.notes ?? []),
          approvedAt: approve ? new Date().toISOString() : null,
        },
      },
    };
  });
  if (saved === "no_business") return { ok: false, message: NO_BUSINESS };
  if (missing) return { ok: false, message: NOT_IN_PLAN };
  refresh();
  return { ok: true, value: null };
}

const pickSchema = z.object({
  include: z.array(z.enum(MARKETING_PLATFORMS)).min(1).max(MARKETING_PLATFORMS.length),
  social: z.enum(SKILL_LEVELS).nullable(),
});

// Before the marketing questions are answered, the owner can pick accounts here; they're saved with those answers
export async function pickSocialAccountsAction(input: unknown): Promise<ActionResult> {
  const parsed = pickSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick at least one account." };
  let answered = false;
  const saved = await updateMyMarketing((latest) => {
    if (completeIntake(latest?.intake ?? null)) {
      answered = true;
      return null;
    }
    return { intake: withPickedAccounts(latest?.intake ?? null, parsed.data.include, parsed.data.social) };
  });
  if (saved === "no_business") return { ok: false, message: NO_BUSINESS };
  if (answered) return { ok: false, message: "You’ve answered the marketing questions, so change your accounts there." };
  refresh();
  return { ok: true, value: null };
}
