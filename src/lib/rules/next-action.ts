import type { PlanTopic, TaskStatus } from "@/lib/domain";
import type { RequirementStatus } from "@/lib/research/applicability";

// Plain code: what the steps cost.
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

const SIDE: readonly RequirementStatus[] = ["optional", "outside_coverage"];

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
