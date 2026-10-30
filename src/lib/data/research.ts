import "server-only";
import { and, asc, eq, like } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, requirements, researchSnapshots, sources } from "@/db/schema";
import type { BusinessProfile, RequirementDraft, VerificationState } from "@/lib/domain";
import type { FollowUpResult } from "@/lib/research/follow-up";
import type { ResearchResult } from "@/lib/research/requirements";
import { proposePlan, rebuildPlan, type ReplanOutcome } from "./plan";

// Owner-scoped like businesses.ts: the business is always looked up by its owner.

export type ResearchSnapshot = typeof researchSnapshots.$inferSelect & {
  sources: (typeof sources.$inferSelect)[];
  requirements: (typeof requirements.$inferSelect)[];
};

// One snapshot read, so a save landing midway can't mix two runs
export async function getResearchForOwner(db: Db, ownerId: string): Promise<ResearchSnapshot | null> {
  return db.transaction(
    async (tx) => {
      const [row] = await tx
        .select({ snapshot: researchSnapshots })
        .from(researchSnapshots)
        .innerJoin(businesses, eq(businesses.id, researchSnapshots.businessId))
        .where(eq(businesses.ownerId, ownerId))
        .limit(1);
      if (!row) return null;

      const businessId = row.snapshot.businessId;
      const sourceRows = await tx.select().from(sources).where(eq(sources.businessId, businessId));
      const requirementRows = await tx
        .select()
        .from(requirements)
        .where(eq(requirements.businessId, businessId))
        .orderBy(asc(requirements.position));
      return { ...row.snapshot, sources: sourceRows, requirements: requirementRows };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Just what deciding what applies needs: the answers and structure the last check ran on
export interface ResearchBasis {
  checkedAt: Date;
  profileKey: string;
  profile: ResearchSnapshot["profile"];
  structure: string | null;
}

export async function getResearchBasisForOwner(db: Db, ownerId: string): Promise<ResearchBasis | null> {
  const [row] = await db
    .select({ checkedAt: researchSnapshots.checkedAt, profileKey: researchSnapshots.profileKey, profile: researchSnapshots.profile, structure: researchSnapshots.structure })
    .from(researchSnapshots)
    .innerJoin(businesses, eq(businesses.id, researchSnapshots.businessId))
    .where(eq(businesses.ownerId, ownerId))
    .limit(1);
  return row ?? null;
}

// Replaces the owner's last results in one go, unless a run that started later already saved.
// False when the owner has no business.
export async function saveResearchForOwner(
  db: Db,
  ownerId: string,
  research: ResearchResult,
  profileKey: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [business] = await tx
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.ownerId, ownerId))
      .for("update");
    if (!business) return false;

    const [saved] = await tx
      .select({ checkedAt: researchSnapshots.checkedAt })
      .from(researchSnapshots)
      .where(eq(researchSnapshots.businessId, business.id));
    if (saved && saved.checkedAt > research.checkedAt) return true;

    await tx.delete(requirements).where(eq(requirements.businessId, business.id));
    await tx.delete(sources).where(eq(sources.businessId, business.id));

    const snapshot = {
      checkedAt: research.checkedAt,
      profileKey,
      model: research.model,
      simulated: research.simulated,
      searched: research.searched,
      unreadSources: research.unread.map(({ id, title, url, reason }) => ({ key: id, title, url, reason })),
      assumptions: research.assumptions,
      openQuestions: research.openQuestions,
      planProposal: research.plan,
      planReviewedAt: null,
      proposedAt: research.checkedAt,
      profile: research.profile,
      structure: research.structure,
      coverage: research.coverage,
      conflicts: research.conflicts,
      followedUpAt: null,
      offices: [],
    };
    await tx
      .insert(researchSnapshots)
      .values({ businessId: business.id, ...snapshot })
      .onConflictDoUpdate({ target: researchSnapshots.businessId, set: snapshot });

    if (research.pages.length) {
      await tx.insert(sources).values(
        research.pages.map((page) => ({
          businessId: business.id,
          key: page.id,
          url: page.url,
          title: page.title,
          level: page.level,
          government: page.government,
          discovered: page.discovered,
          retrievedAt: new Date(page.retrievedAt),
        })),
      );
    }
    if (research.requirements.length) {
      await tx.insert(requirements).values(
        research.requirements.map((requirement, position) => ({
          businessId: business.id,
          key: requirement.key,
          title: requirement.title,
          topic: requirement.topic,
          whyItApplies: requirement.whyItApplies,
          level: requirement.level,
          agency: requirement.agency,
          sourceIds: requirement.sourceIds,
          evidence: requirement.evidence,
          feeCents: requirement.feeUsd === null ? null : Math.round(requirement.feeUsd * 100),
          deadline: requirement.deadline,
          needsProfessional: requirement.needsProfessional,
          whoToCall: requirement.whoToCall,
          whatToAsk: requirement.whatToAsk,
          gather: requirement.gather,
          doneWhen: requirement.doneWhen,
          dependsOn: requirement.dependsOn,
          verification: requirement.verification,
          problems: requirement.problems,
          position,
          checkedAt: research.checkedAt,
          applicability: requirement.applicability,
          condition: requirement.condition,
          status: requirement.status,
          conditions: requirement.conditions,
          timing: requirement.timing,
          forStructures: requirement.forStructures,
          fitsStructure: requirement.fitsStructure,
          renewal: requirement.renewal,
          renewalFeeCents: requirement.renewalFeeUsd === null ? null : Math.round(requirement.renewalFeeUsd * 100),
          alreadyHave: requirement.alreadyHave,
        })),
      );
    }
    await proposePlan(tx, business.id, research.plan, research.checkedAt);
    return true;
  });
}

// Saves the follow-up look onto the check it followed, then rebuilds the plan from it.
// "stale" when a newer check replaced that one meanwhile.
export async function saveFollowUpForOwner(
  db: Db,
  ownerId: string,
  checkedAt: Date,
  result: FollowUpResult,
  profile: BusinessProfile,
  details: readonly { key: string; value: string }[],
  now = new Date(),
): Promise<ReplanOutcome | "stale"> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!business) return "no_business";
    const [snapshot] = await tx.select().from(researchSnapshots).where(eq(researchSnapshots.businessId, business.id));
    if (!snapshot) return "no_research";
    if (snapshot.checkedAt.getTime() !== checkedAt.getTime()) return "stale";

    // A second follow-up replaces the first one's pages
    await tx.delete(sources).where(and(eq(sources.businessId, business.id), like(sources.key, "fu-%")));
    if (result.pages.length) {
      await tx.insert(sources).values(
        result.pages.map((page) => ({
          businessId: business.id,
          key: page.id,
          url: page.url,
          title: page.title,
          level: page.level,
          government: page.government,
          discovered: page.discovered,
          retrievedAt: new Date(page.retrievedAt),
        })),
      );
    }
    const settled = { applicability: "applies" as const, condition: "" };
    for (const confirmed of result.confirmed) {
      await tx
        .update(requirements)
        .set({
          ...settled,
          sourceIds: confirmed.sourceIds,
          evidence: confirmed.evidence,
          feeCents: confirmed.feeUsd === null ? null : Math.round(confirmed.feeUsd * 100),
          deadline: confirmed.deadline,
          verification: "sourced",
          problems: [],
          background: "",
          verdict: "applies",
        })
        .where(and(eq(requirements.businessId, business.id), eq(requirements.key, confirmed.key)));
    }
    for (const note of result.notes) {
      const quoted = note.evidence ? { sourceIds: note.sourceIds, evidence: note.evidence, verification: "sourced" as const, problems: [] } : {};
      await tx
        .update(requirements)
        .set({ ...settled, ...quoted, background: note.background, verdict: note.verdict })
        .where(and(eq(requirements.businessId, business.id), eq(requirements.key, note.key)));
    }
    const answered = new Map(result.answers.map((each) => [each.question, each.answer]));
    const openQuestions = snapshot.openQuestions.map((question) => {
      const answer = answered.get(question.question);
      return answer ? { ...question, answer } : question;
    });
    await tx.update(researchSnapshots).set({ followedUpAt: now, offices: result.offices, openQuestions }).where(eq(researchSnapshots.businessId, business.id));
    return rebuildPlan(tx, business.id, profile, details, now);
  });
}

// A saved requirement in the shape research works with
export function draftOf(row: ResearchSnapshot["requirements"][number]): RequirementDraft & { verification: VerificationState } {
  return {
    key: row.key,
    title: row.title,
    topic: row.topic,
    whyItApplies: row.whyItApplies,
    level: row.level,
    agency: row.agency,
    sourceIds: row.sourceIds,
    evidence: row.evidence,
    feeUsd: row.feeCents === null ? null : row.feeCents / 100,
    deadline: row.deadline,
    needsProfessional: row.needsProfessional,
    whoToCall: row.whoToCall,
    whatToAsk: row.whatToAsk,
    gather: row.gather,
    doneWhen: row.doneWhen,
    dependsOn: row.dependsOn,
    applicability: row.applicability,
    condition: row.condition,
    timing: row.timing,
    forStructures: row.forStructures,
    renewal: row.renewal,
    renewalFeeUsd: row.renewalFeeCents === null ? null : row.renewalFeeCents / 100,
    verification: row.verification,
  };
}
