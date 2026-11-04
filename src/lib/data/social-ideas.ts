import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, socialIdeas } from "@/db/schema";
import type { IdeaSet } from "@/lib/social/ideas";

// Owner-scoped daily post ideas: the newest set shows, older ones only keep topics from repeating

const RECENT_DAYS = 7;

async function businessOf(db: Db, ownerId: string) {
  const [row] = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  return row?.id ?? null;
}

export interface IdeaHistory {
  latest: IdeaSet | null;
  recentTopics: string[];
}

export async function ideaHistoryForOwner(db: Db, ownerId: string): Promise<IdeaHistory> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return { latest: null, recentTopics: [] };
  const rows = await db
    .select({ day: socialIdeas.day, ideas: socialIdeas.ideas, read: socialIdeas.read, simulated: socialIdeas.simulated })
    .from(socialIdeas)
    .where(eq(socialIdeas.businessId, businessId))
    .orderBy(desc(socialIdeas.day))
    .limit(RECENT_DAYS);
  return { latest: rows[0] ?? null, recentTopics: rows.flatMap((row) => row.ideas.map((idea) => idea.topic)) };
}

// First set for a day wins, so two tabs opening at once don't replace each other's ideas
export async function saveIdeasForOwner(db: Db, ownerId: string, set: IdeaSet): Promise<IdeaSet | null> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return null;
  await db.insert(socialIdeas).values({ businessId, day: set.day, ideas: set.ideas, read: [], simulated: set.simulated }).onConflictDoNothing();
  const [row] = await db
    .select({ day: socialIdeas.day, ideas: socialIdeas.ideas, read: socialIdeas.read, simulated: socialIdeas.simulated })
    .from(socialIdeas)
    .where(and(eq(socialIdeas.businessId, businessId), eq(socialIdeas.day, set.day)));
  return row ?? null;
}

export async function markIdeaReadForOwner(db: Db, ownerId: string, day: string, index: number): Promise<number[] | null> {
  const businessId = await businessOf(db, ownerId);
  if (!businessId) return null;
  const where = and(eq(socialIdeas.businessId, businessId), eq(socialIdeas.day, day));
  const [row] = await db.select({ ideas: socialIdeas.ideas, read: socialIdeas.read }).from(socialIdeas).where(where);
  if (!row || index < 0 || index >= row.ideas.length) return null;
  if (row.read.includes(index)) return row.read;
  const read = [...row.read, index].sort((a, b) => a - b);
  await db.update(socialIdeas).set({ read }).where(where);
  return read;
}
