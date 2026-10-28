import type { PlanTopic, TaskStatus } from "@/lib/domain";
import type { RequirementStatus } from "@/lib/research/applicability";

// Plain code: what to do now, what can happen at the same time, what waits, and what it costs.
// Optional steps and rules outside First Sale's coverage never count toward what's needed before selling.

export interface ActionStep {
  key: string;
  title: string;
  topic?: PlanTopic;
  status: TaskStatus;
  requirementStatus: RequirementStatus;
  timing: "before_selling" | "later";
  prerequisites: readonly string[];
  feeCents: number | null;
  renewal: { text: string; feeCents: number | null } | null;
  // The catalog form it's filed with, so two steps on one form are paid once
  formKey?: string | null;
}

export interface NextActions<T extends ActionStep> {
  // Ready, needed before selling: these can all happen at the same time
  now: T[];
  // Ready, but they depend on an answer or decision first
  decide: T[];
  // Submitted, waiting on the office
  submitted: T[];
  waiting: { step: T; on: T[] }[];
  later: T[];
  optional: T[];
  done: T[];
  // The one thing to do next
  first: T | null;
}

const SIDE: readonly RequirementStatus[] = ["optional", "outside_coverage"];

export function nextActions<T extends ActionStep>(steps: readonly T[]): NextActions<T> {
  const byKey = new Map(steps.map((step) => [step.key, step]));
  const result: NextActions<T> = { now: [], decide: [], submitted: [], waiting: [], later: [], optional: [], done: [], first: null };
  for (const step of steps) {
    if (step.status === "done") {
      result.done.push(step);
      continue;
    }
    if (SIDE.includes(step.requirementStatus)) {
      result.optional.push(step);
      continue;
    }
    if (step.status === "submitted") {
      result.submitted.push(step);
      continue;
    }
    // Prerequisites that are gone from the plan don't block; submitted ones still do until approved
    const on = step.prerequisites.flatMap((key) => byKey.get(key) ?? []).filter((prerequisite) => prerequisite.status !== "done");
    if (on.length) result.waiting.push({ step, on });
    else if (step.timing === "later") result.later.push(step);
    else if (step.requirementStatus === "conditional") result.decide.push(step);
    else result.now.push(step);
  }
  result.first = result.now[0] ?? result.decide[0] ?? result.later[0] ?? null;
  return result;
}

export interface CostLine {
  title: string;
  cents: number;
}

export interface Costs {
  // Needed before selling, or later, and confirmed on an official page
  startup: CostLine[];
  startupCents: number;
  // Only if a condition turns out true
  maybe: CostLine[];
  // Renewals, from the second year on; the first year is in the startup fee
  yearly: CostLine[];
  yearlyCents: number;
  // Required steps whose fee no official page stated
  unknown: string[];
}

// Each form's fee counts once, even when two steps share it, from the strongest of them; optional, done and already-paid steps aren't counted
export function planCosts(steps: readonly ActionStep[]): Costs {
  const costs: Costs = { startup: [], startupCents: 0, maybe: [], yearly: [], yearlyCents: 0, unknown: [] };
  const strength = (step: ActionStep) => (step.requirementStatus === "conditional" ? 0 : 2) + (step.feeCents === null ? 0 : 1);
  const best = new Map<string, ActionStep>();
  // A form filed for a finished step is already paid for
  const paid = new Set(steps.filter((step) => step.status === "done" && step.formKey).map((step) => step.formKey));
  for (const step of steps) {
    if (SIDE.includes(step.requirementStatus) || step.status === "done" || (step.formKey && paid.has(step.formKey))) continue;
    const id = step.formKey ?? step.key;
    const held = best.get(id);
    if (!held || strength(step) > strength(held)) best.set(id, step);
  }
  for (const step of best.values()) {
    if (step.feeCents === null) {
      // Deciding on a structure isn't a filing, so it has no fee to find
      if (step.requirementStatus !== "conditional" && step.topic !== "structure") costs.unknown.push(step.title);
    } else if (step.feeCents > 0) {
      (step.requirementStatus === "conditional" ? costs.maybe : costs.startup).push({ title: step.title, cents: step.feeCents });
    }
    if (step.renewal?.feeCents && step.requirementStatus !== "conditional") costs.yearly.push({ title: step.title, cents: step.renewal.feeCents });
  }
  costs.startupCents = costs.startup.reduce((sum, line) => sum + line.cents, 0);
  costs.yearlyCents = costs.yearly.reduce((sum, line) => sum + line.cents, 0);
  return costs;
}
