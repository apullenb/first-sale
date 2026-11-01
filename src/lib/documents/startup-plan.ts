import type { TaskStatus } from "@/lib/domain";
import { STATUS_LABELS } from "@/lib/research/applicability";
import type { PlanTaskDraft } from "@/lib/rules/plan";
import { type PdfBlock, writePdf } from "./pdf-writer";

// The startup plan as a printable PDF. Plain code: it only lays out what the plan already says.

type Step = PlanTaskDraft & { status: TaskStatus };

const PROGRESS: Record<TaskStatus, string> = { todo: "", submitted: " (submitted, waiting to hear back)", done: " (done)" };

export function formatFee(cents: number): string {
  return cents === 0 ? "Free" : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// Rules that may apply but aren't settled yet: printed apart, never as steps
export interface MaybeStep {
  title: string;
  why: string;
  conditions: readonly string[];
}

export function startupPlanBlocks(input: { steps: readonly Step[]; maybe?: readonly MaybeStep[] }): PdfBlock[] {
  const blocks: PdfBlock[] = input.steps.map((step, index) => {
    const paragraphs = [`${STATUS_LABELS[step.requirementStatus ?? "needs_confirmation"]}${step.timing === "later" ? " · Later, not before your first sale" : ""}`, step.why];
    for (const condition of step.conditions ?? []) paragraphs.push(`Depends on: ${condition}`);
    if (step.agency) paragraphs.push(`Who handles it: ${step.agency}`);
    if (step.feeCents !== null) paragraphs.push(`Fee: ${formatFee(step.feeCents)}${step.feeCheckedAt ? ` (checked ${day(step.feeCheckedAt)})` : ""}`);
    if (step.deadline) paragraphs.push(`Deadline: ${step.deadline}`);
    if (step.renewal) paragraphs.push(`Renewal: ${step.renewal.text}${step.renewal.feeCents !== null ? `, ${formatFee(step.renewal.feeCents)}` : ""}`);
    if (step.doneWhen) paragraphs.push(`Done when: ${step.doneWhen}`);
    const bullets = [
      ...step.prepare.map((item) => `Have ready: ${item}`),
      ...step.links.map((link) => `${link.confirms ? "Official source" : "Related official page"}: ${link.url}`),
    ];
    const reason = step.verification === "sourced" ? null : step.notes?.[0]?.background;
    if (reason) paragraphs.push(`Why you need this: ${reason}`);
    return { heading: `${index + 1}. ${step.title}${PROGRESS[step.status]}`, paragraphs, bullets };
  });
  const maybe = input.maybe ?? [];
  if (!maybe.length) return blocks;
  return [
    ...blocks,
    {
      heading: "Waiting on your answers",
      paragraphs: ["These depend on your plans, your business structure or where your business is. Answer in SnapStart and they’re settled."],
    },
    ...maybe.map((each) => ({ heading: each.title, paragraphs: [each.why, ...each.conditions.map((condition) => `Depends on: ${condition}`)].filter(Boolean) })),
  ];
}

export async function startupPlanPdf(input: { businessName: string; steps: readonly Step[]; maybe?: readonly MaybeStep[]; now: Date }): Promise<Uint8Array> {
  const blocks = startupPlanBlocks(input);
  const practice = input.steps.some((step) => step.simulated)
    ? " Practice mode: built-in rules, not real research, suggested some of these steps."
    : "";
  return writePdf({
    title: `Licenses and registrations for ${input.businessName}`,
    subtitle: `Made ${day(input.now.toISOString())} with SnapStart`,
    notice: `A plan to help you get started, not legal advice.${practice}`,
    blocks,
    footer: "SnapStart licenses and registrations",
  });
}
