import type { BUDGET_RANGES, PlanTopic } from "@/lib/domain";
import type { ActionStep } from "./next-action";

// Plain code: what's left, about how long the owner's own part takes, what's been spent, and where to go next.
// Times are rough hands-on estimates by kind of step; an office's wait is never counted.

const MINUTES: Record<PlanTopic, number> = {
  structure: 20,
  name_registration: 30,
  tax_registration: 30,
  license_permit: 45,
  location_zoning: 30,
  employer: 60,
  other: 20,
};

// The longest one sitting should ask of the owner; anything longer is split into parts
export const MAX_SITTING_MINUTES = 90;
// Answering the quick questions on What applies to you
export const CHECK_MINUTES = 10;
// Answering the questions about your business
export const INTAKE_MINUTES = 15;

export function stepMinutes(step: Pick<ActionStep, "topic">): number {
  return Math.min(MAX_SITTING_MINUTES, MINUTES[step.topic ?? "other"]);
}

const SIDE = ["optional", "outside_coverage"];

// Required before the first sale, like the progress bar counts
export function neededBeforeSelling(step: Pick<ActionStep, "timing" | "requirementStatus">): boolean {
  return step.timing === "before_selling" && !SIDE.includes(step.requirementStatus);
}

export interface Remaining<T> {
  // Not started yet
  left: T[];
  minutes: number;
  // Sent in, waiting on the office
  waiting: T[];
}

export function remainingWork<T extends ActionStep>(steps: readonly T[]): Remaining<T> {
  const needed = steps.filter(neededBeforeSelling);
  const left = needed.filter((step) => step.status === "todo");
  return { left, minutes: left.reduce((sum, step) => sum + stepMinutes(step), 0), waiting: needed.filter((step) => step.status === "submitted") };
}

// "45 min", "1 hr", "1½ hr"; hours round to the nearest half
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.max(5, Math.round(minutes / 5) * 5)} min`;
  const halves = Math.round(minutes / 30);
  const whole = Math.floor(halves / 2);
  return `${whole}${halves % 2 ? "½" : ""} hr`;
}

// Fees on finished steps, each form once; an optional step the owner paid for still counts
export function spentCents(steps: readonly ActionStep[]): number {
  const paid = new Map<string, number>();
  for (const step of steps) {
    if (step.status !== "done" || !step.feeCents) continue;
    const id = step.formKey ?? step.key;
    paid.set(id, Math.max(paid.get(id) ?? 0, step.feeCents));
  }
  return [...paid.values()].reduce((sum, cents) => sum + cents, 0);
}

// The top of the owner's budget range; open-ended or unsure ranges have none
export function budgetCapCents(range: (typeof BUDGET_RANGES)[number] | null): number | null {
  switch (range) {
    case "under_1k":
      return 100_000;
    case "1k_5k":
      return 500_000;
    case "5k_25k":
      return 2_500_000;
    default:
      return null;
  }
}

// Whole days from today to a YYYY-MM-DD date, both as calendar dates; negative once it's passed
export function daysUntil(date: string, today: Date): number {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - start) / 86_400_000);
}
