import type { IconName } from "@/components/icons";
import type { StepId, SummaryRow } from "@/lib/intake/answers";

// Setup steps grouped into five chapters, in step order
export const CHAPTERS: readonly { label: string; icon: IconName; steps: readonly StepId[] }[] = [
  { label: "Getting started", icon: "store", steps: ["sell", "status"] },
  { label: "Where", icon: "pin", steps: ["place"] },
  { label: "Owners and name", icon: "users", steps: ["owners", "name"] },
  { label: "How you’ll work", icon: "box", steps: ["channels", "details", "premises"] },
  { label: "Money and goals", icon: "dollar", steps: ["money", "help", "timing"] },
];

export function chapterIndex(step: StepId): number {
  return Math.max(0, CHAPTERS.findIndex((chapter) => chapter.steps.includes(step)));
}

// Summary rows split by chapter, leaving out chapters with none
export function rowsByChapter(rows: SummaryRow[]) {
  return CHAPTERS.map((chapter) => ({ chapter, rows: rows.filter((row) => chapter.steps.includes(row.step)) })).filter((group) => group.rows.length);
}
