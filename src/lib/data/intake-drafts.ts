import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, intakeDrafts } from "@/db/schema";
import { type BusinessProfile, businessProfileSchema } from "@/lib/domain";
import { intakeAnswersSchema, type IntakeDraftInput } from "@/lib/intake/draft-schema";
import { profileKey } from "@/lib/research/requirements";

// Unfinished intake answers, one per owner. A create draft lives until the business is saved;
// an edit draft until its changes are confirmed or discarded.

export type IntakeDraft = IntakeDraftInput & { updatedAt: Date };

// Null when there's none, or when it no longer fits: a create draft after the business exists,
// or an edit draft whose starting answers were changed elsewhere since
export async function getIntakeDraftForOwner(db: Db, ownerId: string): Promise<IntakeDraft | null> {
  const [row] = await db.select().from(intakeDrafts).where(eq(intakeDrafts.userId, ownerId));
  if (!row) return null;
  const answers = intakeAnswersSchema.safeParse(row.answers);
  if (!answers.success || !(await fits(db, ownerId, row.mode, row.baseKey))) return null;
  return {
    mode: row.mode,
    answers: answers.data,
    marks: row.marks,
    step: row.step as IntakeDraft["step"],
    practice: row.practice,
    baseKey: row.baseKey,
    updatedAt: row.updatedAt,
  };
}

// False when the draft doesn't fit the owner's business (see above), so nothing is saved
export async function saveIntakeDraftForOwner(db: Db, ownerId: string, draft: IntakeDraftInput, now = new Date()): Promise<boolean> {
  const key = await currentKey(db, ownerId);
  if (draft.mode === "create" ? key !== null : key === null || draft.baseKey !== key) return false;
  const row = { mode: draft.mode, answers: draft.answers, marks: draft.marks, step: draft.step, practice: draft.practice, baseKey: draft.baseKey, updatedAt: now };
  await db
    .insert(intakeDrafts)
    .values({ userId: ownerId, ...row })
    .onConflictDoUpdate({ target: intakeDrafts.userId, set: row });
  return true;
}

export async function deleteIntakeDraftForOwner(db: Db, ownerId: string): Promise<void> {
  await db.delete(intakeDrafts).where(eq(intakeDrafts.userId, ownerId));
}

async function fits(db: Db, ownerId: string, mode: "create" | "edit", baseKey: string | null): Promise<boolean> {
  const key = await currentKey(db, ownerId);
  return mode === "create" ? key === null : key !== null && key === baseKey;
}

// Key of the saved answers; null with no business yet
export async function currentKey(db: Db, ownerId: string): Promise<string | null> {
  const [row] = await db.select({ profile: businesses.profile }).from(businesses).where(eq(businesses.ownerId, ownerId));
  if (!row) return null;
  const parsed = businessProfileSchema.safeParse(row.profile);
  // Answers that no longer parse are re-answered from scratch
  return parsed.success ? draftKey(parsed.data) : "unreadable";
}

// The research key plus the launch date, which research ignores but an edit in another tab must not overwrite
export function draftKey(profile: BusinessProfile): string {
  return profile.launchDate ? `${profileKey(profile)}:${profile.launchDate}` : profileKey(profile);
}
