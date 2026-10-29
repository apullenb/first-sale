"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { PLATFORM_DATA } from "@/data/marketing-platforms";
import { PLATFORM_DATA as WEBSITE_PLATFORMS } from "@/data/website-platforms";
import { getModel } from "@/lib/ai";
import type { MarketingRecord } from "@/lib/data/marketing";
import {
  createMyDocument,
  getMyBrand,
  getMyBrandState,
  getMyBusiness,
  getMyMarketing,
  getMyPlan,
  getMyWebsitePlan,
  listMyDocuments,
  listMyPhotoLibrary,
  myAiKey,
  updateMyDocument,
  updateMyMarketing,
} from "@/lib/data/my-business";
import { type PdfBlock, writePdf } from "@/lib/documents/pdf-writer";
import { EMPTY_CONTENT } from "@/lib/documents/types";
import { OwnerFacingError } from "@/lib/errors";
import { completeIntake, intakeKey, type MarketingIntake, marketingIntakeSchema } from "@/lib/marketing/intake";
import { draftMarketingPlan, type MarketingFacts } from "@/lib/marketing/plan";
import { type MarketingPlan, ROLE_LABELS } from "@/lib/marketing/types";
import { buildMarketingSteps, type StepContext } from "@/lib/rules/marketing";
import { runWorkflow } from "@/lib/workflow-runner";

const NO_BUSINESS = "Tell us about your business first.";
const RELOAD = "Your marketing plan changed since this page loaded. Reload the page and try again.";

// The form refreshes the page itself, after writing the plan when the owner asks for that
export async function saveMarketingIntakeAction(input: unknown): Promise<ActionResult> {
  const parsed = marketingIntakeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some answers are missing. Answer each question, then try again." };
  const saved = await updateMyMarketing(() => ({ intake: parsed.data }));
  if (saved === "no_business") return { ok: false, message: NO_BUSINESS };
  return { ok: true, value: null };
}

// The business plan answers that help a marketing plan; costs and funding stay out
const PLAN_ANSWERS = ["customers", "different", "prices", "pricing", "sales_goal", "monthly_goal"];

// What the owner already made in First Sale, which shapes the steps
async function stepContext() {
  const [brand, website, photos] = await Promise.all([getMyBrand(), getMyWebsitePlan(), listMyPhotoLibrary()]);
  const context: StepContext = { hasLogo: Boolean(brand), hasWebsite: Boolean(website?.platform), approvedPhotos: photos.length };
  return { brand, website, context };
}

async function gatherFacts(intake: MarketingIntake): Promise<Omit<MarketingFacts, "profile">> {
  const [documents, brandState, startup, { brand, website, context }] = await Promise.all([listMyDocuments(), getMyBrandState(), getMyPlan(), stepContext()]);
  const businessPlan = documents.find((doc) => doc.generatedKind === "business_plan");
  const brief = brandState?.brief ?? null;
  const required = (startup?.steps ?? []).filter(
    (step) => step.timing === "before_selling" && step.requirementStatus !== "optional" && step.requirementStatus !== "outside_coverage",
  );
  return {
    intake,
    planAnswers: Object.fromEntries(Object.entries(businessPlan?.draft?.inputs ?? {}).filter(([key, value]) => PLAN_ANSWERS.includes(key) && value.trim())),
    brand:
      brief || brand
        ? {
            tagline: brief?.tagline ?? "",
            feel: brief?.vibes ?? [],
            story: brief?.storyApproved ? brief.story : "",
            customers: brief?.customers ?? "",
            hasLogo: Boolean(brand),
          }
        : null,
    website: website?.platform
      ? { platform: WEBSITE_PLATFORMS[website.platform].name, domain: website.domain, wordsApproved: Boolean(website.contentApprovedAt) }
      : null,
    approvedPhotos: context.approvedPhotos,
    startup: required.length ? { done: required.filter((step) => step.status === "done").length, total: required.length } : null,
  };
}

// The page refreshes itself once its progress screen finishes. Steps from an earlier approval stay until this draft is approved.
export async function draftMarketingPlanAction(): Promise<ActionResult> {
  const [business, marketing] = await Promise.all([getMyBusiness(), getMyMarketing()]);
  if (!business?.profile) return { ok: false, message: NO_BUSINESS };
  const intake = completeIntake(marketing?.intake ?? null);
  if (!intake) return { ok: false, message: "Answer the questions first." };
  const profile = business.profile;

  return runWorkflow("marketing_plan", null, async () => {
    const facts = await gatherFacts(intake);
    const plan = await draftMarketingPlan(getModel(), { profile, ...facts }, new Date(), await myAiKey());
    const saved = await updateMyMarketing(() => ({ plan, approvedAt: null }));
    if (saved === "no_business") throw new OwnerFacingError(NO_BUSINESS);
    return null;
  });
}

// draftedAt: the draft the owner read, so a newer one isn't approved unseen
const approveSchema = z.object({ draftedAt: z.string().max(40) });

// Approving builds the steps and saves a printable copy to the library
export async function approveMarketingPlanAction(input: unknown): Promise<ActionResult> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: RELOAD };
  const marketing = await getMyMarketing();
  const intake = completeIntake(marketing?.intake ?? null);
  const plan = marketing?.plan ?? null;
  if (!plan || !intake) return { ok: false, message: "Write your plan first." };
  if (plan.intakeKey !== intakeKey(intake)) return { ok: false, message: "Your answers changed since this plan was written. Write it again first." };

  const { context } = await stepContext();
  const steps = buildMarketingSteps(plan, intake, context);
  const now = new Date();
  let problem: string | null = null;
  let before: Pick<MarketingRecord, "steps" | "stepsDone"> = { steps: [], stepsDone: [] };
  const saved = await updateMyMarketing((latest) => {
    const answers = completeIntake(latest?.intake ?? null);
    if (latest?.plan?.generatedAt !== parsed.data.draftedAt || plan.generatedAt !== parsed.data.draftedAt) problem = RELOAD;
    else if (!answers || intakeKey(answers) !== plan.intakeKey) problem = "Your answers changed since this plan was written. Write it again first.";
    if (problem) return null;
    before = { steps: latest?.steps ?? [], stepsDone: latest?.stepsDone ?? [] };
    // Ticks carry over for steps that are still there
    return { approvedAt: now, steps, stepsDone: before.stepsDone.filter((key) => steps.some((step) => step.key === key)) };
  });
  if (saved === "no_business") return { ok: false, message: NO_BUSINESS };
  if (problem) return { ok: false, message: problem };

  // Approval stands only once the printable copy is in the library; otherwise the earlier steps come back
  const pdf = await savePlanPdf(plan, now);
  if (!pdf.ok) {
    await updateMyMarketing((latest) => (latest?.approvedAt?.getTime() === now.getTime() ? { approvedAt: null, ...before } : null));
    refresh();
    return pdf;
  }
  refresh();
  return { ok: true, value: null };
}

const stepSchema = z.object({ key: z.string().max(80), done: z.boolean() });

export async function setMarketingStepAction(input: unknown): Promise<ActionResult> {
  const parsed = stepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That step wasn’t found. Reload the page and try again." };
  const { key, done } = parsed.data;
  let missing = false;
  const saved = await updateMyMarketing((latest) => {
    if (!latest?.steps.some((step) => step.key === key)) {
      missing = true;
      return null;
    }
    const keys = new Set(latest.stepsDone);
    if (done) keys.add(key);
    else keys.delete(key);
    return { stepsDone: [...keys] };
  });
  if (saved === "no_business") return { ok: false, message: NO_BUSINESS };
  if (missing) return { ok: false, message: "That step wasn’t found. Reload the page and try again." };
  refresh();
  return { ok: true, value: null };
}

async function savePlanPdf(plan: MarketingPlan, now: Date): Promise<ActionResult> {
  const bytes = await planPdf(plan, now);
  const title = `Marketing plan${plan.simulated ? " (practice)" : ""}`;
  const existing = (await listMyDocuments()).find((doc) => doc.generatedKind === "marketing_plan");
  if (existing) {
    const updated = await updateMyDocument(existing.id, { title, data: bytes, mimeType: "application/pdf" });
    return updated ? { ok: true, value: null } : { ok: false, message: "Your business wasn’t found. Reload the page and try again." };
  }
  const created = await createMyDocument({
    title,
    origin: "generated",
    generatedKind: "marketing_plan",
    mimeType: "application/pdf",
    data: bytes,
    sha256: null,
    content: EMPTY_CONTENT,
  });
  if (!created.ok) {
    return {
      ok: false,
      message:
        created.reason === "too_many" || created.reason === "too_large"
          ? "Your document library is full. Delete a document you don’t need, then approve again."
          : "Your business wasn’t found. Reload the page and try again.",
    };
  }
  return { ok: true, value: null };
}

async function planPdf(plan: MarketingPlan, now: Date) {
  const blocks: PdfBlock[] = [
      { heading: "In short", paragraphs: [plan.summary] },
      { heading: "Goals for the first three months", entries: plan.goals.map((goal) => ({ label: goal.goal, value: goal.measure })) },
      { heading: "Who you’re reaching", entries: [{ label: "Who", value: plan.audience.who }, { label: "Where", value: plan.audience.where }, { label: "What they care about", value: plan.audience.cares }] },
      {
        heading: "Where you’ll show up",
        entries: plan.platforms.map((entry) => ({ label: `${PLATFORM_DATA[entry.platform].name} (${ROLE_LABELS[entry.role]})`, value: entry.why, note: entry.cadence || undefined })),
      },
      { heading: "What to post about", entries: plan.themes.map((theme) => ({ label: theme.title, value: [theme.idea, ...theme.examples.map((example) => `- ${example}`)].join("\n") })) },
      { heading: "Your weekly rhythm", paragraphs: [plan.rhythm] },
      { heading: "First things to do", entries: plan.firstActions.map((action) => ({ label: action.title, value: action.why })) },
  ];
  return writePdf({
    title: "Your marketing plan",
    subtitle: `Approved ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`,
    notice: plan.simulated ? "Practice draft: written by built-in rules, not by the AI service." : undefined,
    // Sections the checks emptied are left out
    blocks: blocks.filter((block) => (block.paragraphs ?? []).some((text) => text.trim()) || (block.entries ?? []).length > 0),
    footer: "Marketing plan made with First Sale",
  });
}
