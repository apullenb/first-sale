import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, checklistTasks, requirements, researchSnapshots, sources } from "@/db/schema";
import type { BusinessProfile, TaskStatus } from "@/lib/domain";
import { classify, placeOf, structureOf } from "@/lib/research/applicability";
import { orderTasks } from "@/lib/rules/checklist";
import { applyPlan, buildPlan, type CurrentTask, diffPlan, type PlanTaskDraft, slugKey } from "@/lib/rules/plan";

// Owner-scoped like businesses.ts: the business is always looked up by its owner.

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type TaskRow = typeof checklistTasks.$inferSelect;

export interface PlanStep extends CurrentTask {
  position: number;
  evidenceNote: string | null;
  completedAt: Date | null;
  submittedAt: Date | null;
  submissionNote: string | null;
}

export interface PlanView {
  steps: PlanStep[];
  // Done steps a later plan dropped, kept as a record
  retired: PlanStep[];
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
    requirementStatus: row.requirementStatus,
    conditions: row.conditions,
    timing: row.timing,
    forStructures: row.forStructures,
    renewal: row.renewal,
    jurisdiction: row.jurisdiction,
    alreadyHave: row.alreadyHave,
    question: row.question,
    notes: row.notes,
    contacts: row.contacts,
    ownerAction: row.ownerAction,
    position: row.position,
    evidenceNote: row.evidenceNote,
    completedAt: row.completedAt,
    submittedAt: row.submittedAt,
    submissionNote: row.submissionNote,
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
      const all = rows.map(toStep);
      return {
        steps: orderSteps(all.filter((step) => !step.retired)),
        retired: all.filter((step) => step.retired),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

// Called inside the research save: the new plan applies straight away. Started steps are kept, as a record if dropped.
export async function proposePlan(tx: Tx, businessId: string, proposal: readonly PlanTaskDraft[], now: Date): Promise<void> {
  // Locked, so a step marked done meanwhile waits for this and isn't deleted from under it
  const rows = await tx.select().from(checklistTasks).where(eq(checklistTasks.businessId, businessId)).for("update");
  const current = rows.map(toStep);
  await writePlan(tx, businessId, current, proposal, new Set(diffPlan(current, proposal).map((change) => change.key)), now);
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
      requirementStatus: task.requirementStatus,
      conditions: task.conditions,
      timing: task.timing,
      forStructures: task.forStructures,
      renewal: task.renewal,
      jurisdiction: task.jurisdiction,
      alreadyHave: task.alreadyHave,
      question: task.question ?? "",
      notes: task.notes ?? [],
      contacts: task.contacts ?? null,
      ownerAction: task.ownerAction ?? null,
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

export async function setStepStatusForOwner(
  db: Db,
  ownerId: string,
  input: { stepId: string; status: TaskStatus; note: string | null },
  now = new Date(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const businessId = await businessIdFor(tx, ownerId);
    if (!businessId) return false;
    // Submitted and approved are recorded separately; undoing keeps the owner's notes; retired steps are a record and can't change
    const set =
      input.status === "done"
        ? { status: input.status, evidenceNote: input.note, completedAt: now, updatedAt: now }
        : input.status === "submitted"
          ? { status: input.status, submissionNote: input.note, submittedAt: now, completedAt: null, updatedAt: now }
          : { status: input.status, completedAt: null, submittedAt: null, updatedAt: now };
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

export type ReplanOutcome = "applied" | "unchanged" | "no_research" | "no_business";

// Rebuilds the plan from the saved research with the owner's current answers and decisions, without searching again.
export async function replanForOwner(
  db: Db,
  ownerId: string,
  profile: BusinessProfile,
  details: readonly { key: string; value: string }[],
  now = new Date(),
): Promise<ReplanOutcome> {
  return db.transaction(async (tx) => {
    const businessId = await businessIdFor(tx, ownerId, true);
    if (!businessId) return "no_business";
    return rebuildPlan(tx, businessId, profile, details, now);
  });
}

// The plan from saved research, re-classified with these answers and decisions, applied straight away
export async function rebuildPlan(
  tx: Tx,
  businessId: string,
  profile: BusinessProfile,
  details: readonly { key: string; value: string }[],
  now: Date,
): Promise<ReplanOutcome> {
  const [snapshot] = await tx.select().from(researchSnapshots).where(eq(researchSnapshots.businessId, businessId));
  if (!snapshot) return "no_research";
  const rows = await tx.select().from(requirements).where(eq(requirements.businessId, businessId)).orderBy(asc(requirements.position));
  const read = await tx.select().from(sources).where(eq(sources.businessId, businessId));
  const taskRows = await tx.select().from(checklistTasks).where(eq(checklistTasks.businessId, businessId)).for("update");
  // The page each step's quote was found on, as the current plan recorded it; requirements don't keep it
  const keyOfUrl = new Map(read.map((source) => [source.url, source.key]));
  const confirmedFor = new Map(
    taskRows.map((task) => [task.key, task.links.filter((link) => link.confirms).flatMap((link) => keyOfUrl.get(link.url) ?? [])]),
  );

  const place = placeOf(profile);
  const decision = structureOf(profile, details);
  const checked = rows.map((row) => {
    const requirement = {
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
      problems: row.problems,
      confirmedBy: row.verification === "sourced" ? (confirmedFor.get(slugKey(row.key)) ?? []) : [],
      background: row.background,
      ownerAction: row.ownerAction,
      verdict: row.verdict,
    };
    return { ...requirement, ...classify(requirement, profile, place, decision) };
  });
  const proposal = buildPlan(
    checked,
    read.map((source) => ({ id: source.key, title: source.title, url: source.url, government: source.government, retrievedAt: source.retrievedAt.toISOString() })),
    snapshot.simulated,
    { place, offices: snapshot.offices },
  );
  for (const [index, row] of rows.entries()) {
    const { status, conditions, fitsStructure } = checked[index];
    await tx.update(requirements).set({ status, conditions, fitsStructure }).where(eq(requirements.id, row.id));
  }

  const current = taskRows.map(toStep);
  const changes = diffPlan(current, proposal);
  // Background and contact details never change what applies, so they're refreshed on every step
  const next = new Map(proposal.map((draft) => [draft.key, draft]));
  for (const row of taskRows) {
    const draft = next.get(row.key);
    if (draft && !row.retired) await tx.update(checklistTasks).set({ notes: draft.notes ?? [], contacts: draft.contacts ?? null }).where(eq(checklistTasks.id, row.id));
  }
  await tx
    .update(researchSnapshots)
    .set({ structure: decision.structure, planProposal: proposal, planReviewedAt: now, proposedAt: now })
    .where(eq(researchSnapshots.businessId, businessId));
  if (changes.length === 0) return "unchanged";
  await writePlan(tx, businessId, current, proposal, new Set(changes.map((change) => change.key)), now);
  return "applied";
}
