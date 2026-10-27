import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, checklistTasks, researchSnapshots } from "@/db/schema";
import type { TaskStatus } from "@/lib/domain";
import { orderTasks } from "@/lib/rules/checklist";
import { applyPlan, type CurrentTask, diffPlan, type PlanChange, type PlanTaskDraft } from "@/lib/rules/plan";

// Owner-scoped like businesses.ts: the business is always looked up by its owner.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type TaskRow = typeof checklistTasks.$inferSelect;

export interface PlanStep extends CurrentTask {
  position: number;
  evidenceNote: string | null;
  completedAt: Date | null;
}

export interface PlanView {
  steps: PlanStep[];
  // Done steps a later plan dropped, kept as a record
  retired: PlanStep[];
  // Changes from the last re-check waiting for the owner's review
  proposal: { checkedAt: Date; changes: PlanChange[] } | null;
}

export function toStep(row: TaskRow): PlanStep {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    topic: row.topic,
    level: row.level,
    why: row.why,
    agency: row.agency,
    links: row.links,
    prepare: row.prepare,
    feeCents: row.feeCents,
    feeCheckedAt: row.feeCheckedAt?.toISOString() ?? null,
    deadline: row.deadline,
    needsProfessional: row.needsProfessional,
    verification: row.verification,
    uncertainty: row.uncertainty,
    whoToCall: row.whoToCall,
    whatToAsk: row.whatToAsk,
    doneWhen: row.doneWhen,
    prerequisites: row.prerequisites,
    status: row.status,
    retired: row.retired,
    simulated: row.simulated,
    position: row.position,
    evidenceNote: row.evidenceNote,
    completedAt: row.completedAt,
  };
}

// Prerequisites first, then plan order; prerequisites that no longer exist are ignored
export function orderSteps(steps: readonly PlanStep[]): PlanStep[] {
  const sorted = [...steps].sort((a, b) => a.position - b.position);
  const byKey = new Map(sorted.map((step) => [step.key, step]));
  try {
    const nodes = sorted.map((step) => ({ id: step.key, prerequisites: step.prerequisites.filter((key) => byKey.has(key)) }));
    return orderTasks(nodes).map((node) => byKey.get(node.id)!);
  } catch {
    return sorted;
  }
}

async function businessIdFor(db: Db | Tx, ownerId: string, lock = false): Promise<string | null> {
  const query = db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId));
  const [row] = lock ? await query.for("update") : await query;
  return row?.id ?? null;
}

export async function getPlanForOwner(db: Db, ownerId: string): Promise<PlanView | null> {
  return db.transaction(
    async (tx) => {
      const businessId = await businessIdFor(tx, ownerId);
      if (!businessId) return null;
      const rows = await tx
        .select()
        .from(checklistTasks)
        .where(eq(checklistTasks.businessId, businessId))
        .orderBy(asc(checklistTasks.position));
      const [snapshot] = await tx
        .select({ checkedAt: researchSnapshots.checkedAt, proposal: researchSnapshots.planProposal, reviewedAt: researchSnapshots.planReviewedAt })
        .from(researchSnapshots)
        .where(eq(researchSnapshots.businessId, businessId));

      const all = rows.map(toStep);
      const proposal =
        snapshot?.proposal && !snapshot.reviewedAt
          ? { checkedAt: snapshot.checkedAt, changes: diffPlan(all, snapshot.proposal) }
          : null;
      return {
        steps: orderSteps(all.filter((step) => !step.retired)),
        retired: all.filter((step) => step.retired),
        proposal: proposal && proposal.changes.length ? proposal : null,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Called inside the research save: the first plan applies straight away, and so does one that changes nothing that matters
export async function proposePlan(tx: Tx, businessId: string, proposal: readonly PlanTaskDraft[], now: Date): Promise<void> {
  // Locked, so a step marked done meanwhile waits for this and isn't deleted from under it
  const rows = await tx.select().from(checklistTasks).where(eq(checklistTasks.businessId, businessId)).for("update");
  const current = rows.map(toStep);
  const changes = diffPlan(current, proposal);
  if (current.length > 0 && changes.length > 0) return;
  await writePlan(tx, businessId, current, proposal, new Set(changes.map((change) => change.key)), now);
}

async function writePlan(
  tx: Tx,
  businessId: string,
  current: readonly CurrentTask[],
  proposal: readonly PlanTaskDraft[],
  accepted: ReadonlySet<string>,
  now: Date,
): Promise<void> {
  const { upserts, deleteIds } = applyPlan(current, proposal, accepted);
  if (deleteIds.length) {
    await tx.delete(checklistTasks).where(and(eq(checklistTasks.businessId, businessId), inArray(checklistTasks.id, deleteIds)));
  }
  for (const { id, ...task } of upserts) {
    const values = {
      key: task.key,
      position: task.position,
      title: task.title,
      topic: task.topic,
      level: task.level,
      why: task.why,
      prerequisites: task.prerequisites,
      destinationUrl: task.links[0]?.url ?? null,
      links: task.links,
      agency: task.agency,
      prepare: task.prepare,
      feeCents: task.feeCents,
      feeCheckedAt: task.feeCheckedAt ? new Date(task.feeCheckedAt) : null,
      deadline: task.deadline,
      needsProfessional: task.needsProfessional,
      verification: task.verification,
      uncertainty: task.uncertainty,
      whoToCall: task.whoToCall,
      whatToAsk: task.whatToAsk,
      doneWhen: task.doneWhen,
      retired: task.retired,
      simulated: task.simulated ?? false,
      updatedAt: now,
    };
    if (id) {
      await tx.update(checklistTasks).set(values).where(and(eq(checklistTasks.id, id), eq(checklistTasks.businessId, businessId)));
    } else {
      await tx.insert(checklistTasks).values({ businessId, ...values });
    }
  }
  await tx.update(researchSnapshots).set({ planReviewedAt: now }).where(eq(researchSnapshots.businessId, businessId));
}

export type ReviewOutcome = "applied" | "stale" | "no_proposal" | "no_business";

// Applies the changes the owner ticked; the rest of the current plan stays as it is.
// `checkedAt` is the re-check the owner reviewed, so a newer one can't be applied unseen.
export async function reviewPlanForOwner(
  db: Db,
  ownerId: string,
  input: { checkedAt: Date; acceptedKeys: readonly string[] },
  now = new Date(),
): Promise<ReviewOutcome> {
  return db.transaction(async (tx) => {
    const businessId = await businessIdFor(tx, ownerId, true);
    if (!businessId) return "no_business";
    const [snapshot] = await tx.select().from(researchSnapshots).where(eq(researchSnapshots.businessId, businessId));
    if (!snapshot?.planProposal || snapshot.planReviewedAt) return "no_proposal";
    if (snapshot.checkedAt.getTime() !== input.checkedAt.getTime()) return "stale";

    const rows = await tx.select().from(checklistTasks).where(eq(checklistTasks.businessId, businessId)).for("update");
    await writePlan(tx, businessId, rows.map(toStep), snapshot.planProposal, new Set(input.acceptedKeys), now);
    return "applied";
  });
}

export async function setStepStatusForOwner(
  db: Db,
  ownerId: string,
  input: { stepId: string; status: TaskStatus; note: string | null },
  now = new Date(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const businessId = await businessIdFor(tx, ownerId);
    if (!businessId) return false;
    // Undoing keeps the owner's note; retired steps are a record and can't change
    const set =
      input.status === "done"
        ? { status: input.status, evidenceNote: input.note, completedAt: now, updatedAt: now }
        : { status: input.status, completedAt: null, updatedAt: now };
    const updated = await tx
      .update(checklistTasks)
      .set(set)
      .where(and(eq(checklistTasks.id, input.stepId), eq(checklistTasks.businessId, businessId), eq(checklistTasks.retired, false)))
      .returning();
    return updated.length > 0;
  });
}

export async function getStepForOwner(db: Db, ownerId: string, stepId: string): Promise<{ step: PlanStep; all: PlanStep[] } | null> {
  const businessId = await businessIdFor(db, ownerId);
  if (!businessId) return null;
  const rows = await db.select().from(checklistTasks).where(eq(checklistTasks.businessId, businessId));
  const all = rows.map(toStep);
  const step = all.find((candidate) => candidate.id === stepId);
  return step ? { step, all } : null;
}
