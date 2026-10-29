import type { PlanTopic } from "@/lib/domain";
import type { ActionStep } from "./next-action";
import { stepMinutes } from "./progress";

// Plain code: how the owner's remaining time splits by kind of step, and whether it fits before launch day.
// The pace is about an hour of the owner's own time a day; waits on offices are never counted.

export const MINUTES_A_DAY = 60;
// Less spare time than this before launch day reads as tight
export const SPARE_DAYS_ON_TRACK = 7;

export interface TopicTime {
  topic: PlanTopic;
  minutes: number;
}

// Largest first; past `max`, the smallest are summed into the last entry as "rest"
export function minutesByTopic(steps: readonly Pick<ActionStep, "topic">[], max = 3): { parts: TopicTime[]; restMinutes: number } {
  const totals = new Map<PlanTopic, number>();
  for (const step of steps) {
    const topic = step.topic ?? "other";
    totals.set(topic, (totals.get(topic) ?? 0) + stepMinutes(step));
  }
  const sorted = [...totals].map(([topic, minutes]) => ({ topic, minutes })).sort((a, b) => b.minutes - a.minutes);
  if (sorted.length <= max) return { parts: sorted, restMinutes: 0 };
  const parts = sorted.slice(0, max - 1);
  return { parts, restMinutes: sorted.slice(max - 1).reduce((sum, part) => sum + part.minutes, 0) };
}

export interface LaunchPace {
  // Days of work left at about an hour a day
  workDays: number;
  // Days left before launch day after that work; negative when it doesn't fit
  spareDays: number;
  onTrack: boolean;
}

export function launchPace(minutesLeft: number, daysLeft: number): LaunchPace {
  const workDays = Math.ceil(Math.max(0, minutesLeft) / MINUTES_A_DAY);
  const spareDays = daysLeft - workDays;
  return { workDays, spareDays, onTrack: workDays === 0 || spareDays >= SPARE_DAYS_ON_TRACK };
}
