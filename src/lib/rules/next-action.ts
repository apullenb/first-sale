import type { PlanTopic, TaskStatus } from "@/lib/domain";
import type { RequirementStatus } from "@/lib/research/applicability";
import { type StepKind, stepKindOf } from "./step-kind";

// Plain code: what the steps cost.
// Optional steps and rules outside SnapStart's coverage never count toward what's needed before selling.

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
  forStructures?: readonly string[];
  kind?: StepKind;
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
  // Required steps that may cost something and whose fee no official page stated
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
      // A decision or a rule to follow has no fee to find
      const kind = step.kind ?? stepKindOf(step);
      if (step.requirementStatus !== "conditional" && kind !== "decision" && kind !== "compliance") costs.unknown.push(step.title);
    } else if (step.feeCents > 0) {
      (step.requirementStatus === "conditional" ? costs.maybe : costs.startup).push({ title: step.title, cents: step.feeCents });
    }
    if (step.renewal?.feeCents && step.requirementStatus !== "conditional") costs.yearly.push({ title: step.title, cents: step.renewal.feeCents });
  }
  costs.startupCents = costs.startup.reduce((sum, line) => sum + line.cents, 0);
  costs.yearlyCents = costs.yearly.reduce((sum, line) => sum + line.cents, 0);
  return costs;
}

// Never "Free": a $0 total can still have costs no one has confirmed
export function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;
}

export interface CostWords {
  // "Known fees: $25"
  known: string;
  // "4 costs still unconfirmed", or null when every fee is known
  unconfirmed: string | null;
  total: string;
}

// Confirmed fees only, and no total while any fee is unknown
export function costWords(costs: Pick<Costs, "startupCents" | "unknown">): CostWords {
  const open = costs.unknown.length;
  return {
    known: `Known fees: ${dollars(costs.startupCents)}`,
    unconfirmed: open ? `${open} ${open === 1 ? "cost" : "costs"} still unconfirmed` : null,
    total: open
      ? "Your total startup cost isn’t known yet"
      : costs.startupCents
        ? `Total known startup fees: ${dollars(costs.startupCents)}`
        : "No startup fees found on official pages",
  };
}
