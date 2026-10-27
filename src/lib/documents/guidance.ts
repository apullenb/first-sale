import type { PlanTaskDraft } from "@/lib/rules/plan";
import { formatFee } from "./startup-plan";
import type { Guidance } from "./types";

// Researched guidance comes from the linked plan step, with its own source and date
export function stepGuidance(step: PlanTaskDraft | undefined): Guidance[] {
  if (!step) return [];
  const facts = [
    step.agency ? `Handled by ${step.agency}.` : "",
    step.feeCents !== null && step.feeCheckedAt
      ? `Fee: ${formatFee(step.feeCents)}, as the official page said on ${new Date(step.feeCheckedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}.`
      : "",
    step.deadline ? `Deadline: ${step.deadline}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return step.links
    .filter((link) => link.confirms)
    .map((link) => ({ text: `From your plan step “${step.title}”. ${facts}`.trim(), sourceTitle: link.title, sourceUrl: link.url }));
}

