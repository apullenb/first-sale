"use server";

import { isDemoSession } from "@/lib/auth/server";
import { DEMO_REFUSAL } from "@/lib/demo";
import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { MARKETING_PLATFORMS, PLATFORM_DATA } from "@/data/marketing-platforms";
import { PROFILE_FACTS } from "@/data/social-profiles";
import { getModel } from "@/lib/ai";
import {
  getMyBrandState,
  getMyBusiness,
  getMyMarketing,
  getMySocialIdeas,
  listMyJourneyMarks,
  listMyProducts,
  markMySocialIdeaRead,
  myAiKey,
  saveMySocialIdeas,
  updateMyMarketing,
} from "@/lib/data/my-business";
import { OwnerFacingError } from "@/lib/errors";
import { STATE_NAMES } from "@/lib/intake/options";
import { completeIntake, SKILL_LEVELS } from "@/lib/marketing/intake";
import { checkBio, checkHandle, checkName, isSetUp, socialAccounts, withPickedAccounts } from "@/lib/rules/social";
import { bioFacts, draftBios } from "@/lib/social/bios";
import { type IdeaInput, type IdeaSet, suggestIdeas } from "@/lib/social/ideas";
import { MAX_FIELD } from "@/lib/social/types";
import { businessSpecifics } from "@/lib/specifics";
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
  if (await isDemoSession()) return DEMO_REFUSAL;
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
  const facts = bioFacts(business.profile, brand?.brief ?? null, await listMyProducts());

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
  if (await isDemoSession()) return DEMO_REFUSAL;
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
  if (await isDemoSession()) return DEMO_REFUSAL;
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

// --- Daily post ideas

const dayInput = z.iso.date();

// The owner's own date may differ from the server's by a day either way
function nearToday(day: string, now = Date.now()) {
  const at = Date.parse(`${day}T12:00:00Z`);
  return Math.abs(at - now) <= 36 * 60 * 60 * 1000;
}

export async function socialIdeasAction(input: unknown): Promise<ActionResult<IdeaSet | null>> {
  const parsed = dayInput.safeParse(input);
  if (!parsed.success || !nearToday(parsed.data)) return { ok: false, message: "Reload the page and try again." };
  const day = parsed.data;
  const history = await getMySocialIdeas();
  if (history.latest?.day === day) return { ok: true, value: history.latest };
  // The demo shows its last set and makes no new ones
  if (await isDemoSession()) return { ok: true, value: history.latest };
  const [business, marketing, products] = await Promise.all([getMyBusiness(), getMyMarketing(), listMyProducts()]);
  if (!business?.profile) return { ok: false, message: NO_BUSINESS };
  const profile = business.profile;
  const intake = marketing?.intake ?? null;
  const platforms = intake ? socialAccounts(intake, marketing?.plan ?? null).map((account) => PLATFORM_DATA[account.id].name) : [];
  const ideaInput: IdeaInput = {
    name: profile.name,
    specifics: businessSpecifics(profile, products),
    city: profile.location.city,
    state: STATE_NAMES[profile.location.state] ?? "",
    description: profile.description,
    platforms,
    recent: history.recentTopics,
  };
  return runWorkflow("social_ideas", day, async () => {
    const set = await suggestIdeas(getModel(), ideaInput, day, await myAiKey());
    const saved = await saveMySocialIdeas(set);
    if (!saved) throw new OwnerFacingError(NO_BUSINESS);
    return saved;
  });
}

const readInput = z.object({ day: dayInput, index: z.number().int().min(0).max(10) });

export async function markSocialIdeaReadAction(input: unknown): Promise<ActionResult<number[]>> {
  // The demo keeps read marks in the browser only
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = readInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const read = await markMySocialIdeaRead(parsed.data.day, parsed.data.index);
  return read ? { ok: true, value: read } : { ok: false, message: "Reload the page and try again." };
}
