import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { businesses, checklistTasks, conditionAnswers } from "@/db/schema";
import type { ConditionAnswer } from "@/lib/research/applicability";
import { questionFor, type SavedAnswer } from "@/lib/rules/paperwork";

// Owner-scoped like businesses.ts. Kept apart from research and the plan, so a re-check never clears them.

export async function listConditionAnswersForOwner(db: Db, ownerId: string): Promise<SavedAnswer[]> {
  return db
    .select({ stepKey: conditionAnswers.stepKey, condition: conditionAnswers.condition, answer: conditionAnswers.answer })
    .from(conditionAnswers)
    .innerJoin(businesses, eq(businesses.id, conditionAnswers.businessId))
    .where(eq(businesses.ownerId, ownerId));
}

export type AnswerOutcome = "saved" | "not_asked" | "no_business";

const normal = (text: string) => text.replace(/\s+/g, " ").trim();

// Only a question the owner's plan asks; null clears the answer. Wording that differs only in spacing is the same question.
export async function setConditionAnswerForOwner(
  db: Db,
  ownerId: string,
  input: { stepKey: string; condition: string; answer: ConditionAnswer | null },
  now = new Date(),
): Promise<AnswerOutcome> {
  return db.transaction(async (tx) => {
    const [business] = await tx.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, ownerId)).for("update");
    if (!business) return "no_business";
    const steps = await tx
      .select({ question: checklistTasks.question, requirementStatus: checklistTasks.requirementStatus, conditions: checklistTasks.conditions })
      .from(checklistTasks)
      .where(and(eq(checklistTasks.businessId, business.id), eq(checklistTasks.key, input.stepKey), eq(checklistTasks.retired, false)));
    const asked = steps.map((step) => questionFor(step)).find((question) => question && normal(question) === normal(input.condition));
    if (!asked) return "not_asked";
    const saved = await tx
      .select({ condition: conditionAnswers.condition })
      .from(conditionAnswers)
      .where(and(eq(conditionAnswers.businessId, business.id), eq(conditionAnswers.stepKey, input.stepKey)));
    const same = saved.filter((row) => normal(row.condition) === normal(asked)).map((row) => row.condition);
    if (same.length) {
      await tx
        .delete(conditionAnswers)
        .where(and(eq(conditionAnswers.businessId, business.id), eq(conditionAnswers.stepKey, input.stepKey), inArray(conditionAnswers.condition, same)));
    }
    if (input.answer !== null) {
      await tx.insert(conditionAnswers).values({ businessId: business.id, stepKey: input.stepKey, condition: asked, answer: input.answer, answeredAt: now });
    }
    return "saved";
  });
}
