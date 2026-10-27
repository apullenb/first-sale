import type { PlanTaskDraft } from "@/lib/rules/plan";
import { type PdfBlock, writePdf } from "./pdf-writer";

// The startup plan as a printable PDF. Plain code: it only lays out what the plan already says.

type Step = PlanTaskDraft & { status: "todo" | "done" };

export function formatFee(cents: number): string {
  return cents === 0 ? "Free" : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export async function startupPlanPdf(input: { businessName: string; steps: readonly Step[]; now: Date }): Promise<Uint8Array> {
  const blocks: PdfBlock[] = input.steps.map((step, index) => {
    const paragraphs = [step.why];
    if (step.agency) paragraphs.push(`Who handles it: ${step.agency}`);
    if (step.feeCents !== null) paragraphs.push(`Fee: ${formatFee(step.feeCents)}${step.feeCheckedAt ? ` (checked ${day(step.feeCheckedAt)})` : ""}`);
    if (step.deadline) paragraphs.push(`Deadline: ${step.deadline}`);
    if (step.doneWhen) paragraphs.push(`Done when: ${step.doneWhen}`);
    const bullets = [
      ...step.prepare.map((item) => `Have ready: ${item}`),
      ...step.links.map((link) => `${link.confirms ? "Official source" : "Related official page"}: ${link.url}`),
      ...step.uncertainty.map((note) => `Still to check: ${note}`),
    ];
    if (step.verification !== "sourced" && step.whoToCall) bullets.push(`Ask ${step.whoToCall}: ${step.whatToAsk.join(" ")}`);
    return { heading: `${index + 1}. ${step.title}${step.status === "done" ? " (done)" : ""}`, paragraphs, bullets };
  });
  const practice = input.steps.some((step) => step.simulated)
    ? " Practice mode: built-in rules, not real research, suggested some of these steps."
    : "";
  return writePdf({
    title: `Startup plan for ${input.businessName}`,
    subtitle: `Made ${day(input.now.toISOString())} with First Sale`,
    notice: `A plan to help you get started, not legal advice. Steps marked “Still to check” weren’t confirmed on an official page.${practice}`,
    blocks,
    footer: "First Sale startup plan",
  });
}
