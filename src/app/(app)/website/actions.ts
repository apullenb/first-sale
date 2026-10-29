"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getModel } from "@/lib/ai";
import {
  createMyDocument,
  getMyBusiness,
  getMyDetails,
  getMyWebsitePlan,
  listMyDocuments,
  myAiKey,
  saveMyWebsitePlan,
  updateMyDocument,
  updateMyWebsitePlan,
} from "@/lib/data/my-business";
import { DETAILS, type DetailKey, displayDetail, looksLikeIdNumber } from "@/lib/details";
import { knownNumbers } from "@/lib/documents/business-plan";
import { writePdf } from "@/lib/documents/pdf-writer";
import { EMPTY_CONTENT } from "@/lib/documents/types";
import { OwnerFacingError } from "@/lib/errors";
import { copyFlags, copyOf, draftWebsite, factsMessage, websiteCopySchema } from "@/lib/website/content";
import { checkDomain, normalizeDomain } from "@/lib/website/domains";
import { PLATFORMS, type WebsiteContent } from "@/lib/website/types";
import { PLATFORM_DATA } from "@/data/website-platforms";
import { runWorkflow } from "@/lib/workflow-runner";

const NO_BUSINESS = "Tell us about your business first.";

export async function choosePlatformAction(platform: unknown): Promise<ActionResult> {
  const parsed = z.enum(PLATFORMS).nullable().safeParse(platform);
  if (!parsed.success) return { ok: false, message: "Pick one of the options." };
  // A demo finish belongs to the First Sale site
  const patch = parsed.data === "first_sale" ? { platform: parsed.data } : { platform: parsed.data, finished: null };
  if (!(await saveMyWebsitePlan(patch))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

// Per owner, so the shared registry doesn't throttle everyone's checks
const RECHECK_AFTER_MS = 10 * 60_000;
const CHECK_WINDOW_MS = 2 * 60_000;
const CHECKS_PER_WINDOW = 8;
// Newest first, repeats included so they count
const MAX_CHECKS = 20;

// Asks the official .com/.net registry whether a web address is registered
export async function checkDomainAction(input: unknown): Promise<ActionResult> {
  const domain = typeof input === "string" ? normalizeDomain(input) : null;
  if (!domain) return { ok: false, message: "Type a web address ending in .com or .net, like yourbusiness.com. Letters, numbers and dashes only." };
  const age = (checkedAt: string) => Date.now() - Date.parse(checkedAt);
  const earlier = (await getMyWebsitePlan())?.domainChecks ?? [];
  if (earlier.some((each) => each.domain === domain && each.status !== "unknown" && age(each.checkedAt) < RECHECK_AFTER_MS)) {
    return { ok: true, value: null };
  }
  // A placeholder holds this check's place in the count, so checks sent at once can't all get through
  const placeholder = { domain, status: "unknown" as const, checkedAt: new Date().toISOString() };
  const reserved = await updateMyWebsitePlan((plan) => {
    const checks = plan?.domainChecks ?? [];
    if (checks.filter((each) => age(each.checkedAt) < CHECK_WINDOW_MS).length >= CHECKS_PER_WINDOW) return null;
    return { domainChecks: [placeholder, ...checks].slice(0, MAX_CHECKS) };
  });
  if (reserved === "no_business") return { ok: false, message: NO_BUSINESS };
  if (reserved === "unchanged") {
    return { ok: false, message: "You’ve checked a lot of addresses in the last couple of minutes. Wait a minute, then try again." };
  }
  const check = await checkDomain(domain);
  await updateMyWebsitePlan((plan) => ({
    domainChecks: (plan?.domainChecks ?? []).map((each) => (each.domain === domain && each.checkedAt === placeholder.checkedAt ? check : each)),
  }));
  refresh();
  return check.status === "unknown"
    ? { ok: false, message: "We couldn’t reach the registry just now. Try again in a minute." }
    : { ok: true, value: null };
}

export async function chooseDomainAction(input: unknown): Promise<ActionResult> {
  if (input === null) {
    if (!(await saveMyWebsitePlan({ domain: null }))) return { ok: false, message: NO_BUSINESS };
    refresh();
    return { ok: true, value: null };
  }
  const domain = typeof input === "string" ? normalizeDomain(input) : null;
  const plan = await getMyWebsitePlan();
  const check = plan?.domainChecks.find((each) => each.domain === domain);
  if (!domain || !check) return { ok: false, message: "Check the web address first." };
  if (check.status === "taken") return { ok: false, message: "Someone already owns that web address. Try another." };
  if (check.status !== "available") return { ok: false, message: "We couldn’t check that web address. Check it again first." };
  if (!(await saveMyWebsitePlan({ domain }))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

// Only what belongs on a public site; owner names, home addresses and tax choices stay out
const PUBLIC_DETAILS: DetailKey[] = ["business_email", "business_phone", "business_purpose"];

async function publicDetails() {
  return (await getMyDetails())
    .filter((detail) => PUBLIC_DETAILS.includes(detail.key))
    .map((detail) => ({ label: DETAILS[detail.key].label, value: displayDetail(detail.key, detail.value) }));
}

// Costs, funding, goals and help needed stay private
const PUBLIC_PLAN_ANSWERS = ["customers", "different", "prices"];

async function planAnswers(): Promise<Record<string, string>> {
  const plan = (await listMyDocuments()).find((doc) => doc.generatedKind === "business_plan");
  return Object.fromEntries(Object.entries(plan?.draft?.inputs ?? {}).filter(([key]) => PUBLIC_PLAN_ANSWERS.includes(key)));
}

export async function draftWebsiteAction(): Promise<ActionResult> {
  const [business, plan] = await Promise.all([getMyBusiness(), getMyWebsitePlan()]);
  if (!business?.profile) return { ok: false, message: NO_BUSINESS };
  if (!plan?.platform) return { ok: false, message: "Pick where you’ll build your site first." };
  const profile = business.profile;
  const platform = plan.platform;

  const result = await runWorkflow("website_copy", null, async () => {
    const content = await draftWebsite(getModel(), { profile, platform, details: await publicDetails(), planAnswers: await planAnswers() }, new Date(), await myAiKey());
    if (!(await saveMyWebsitePlan({ content, contentApprovedAt: null }))) throw new OwnerFacingError(NO_BUSINESS);
  });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}

// draftedAt: which draft the edits belong to, so a newer draft isn't overwritten
const saveSchema = z.object({ copy: websiteCopySchema, approve: z.boolean(), draftedAt: z.string().max(40) });

// The owner's edits. Approving also saves a printable copy of the words to Documents.
export async function saveWebsiteCopyAction(input: unknown): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some of the text is too long. Shorten it and try again." };
  const [business, plan] = await Promise.all([getMyBusiness(), getMyWebsitePlan()]);
  if (!business?.profile || !plan?.content) return { ok: false, message: "Draft your website words first." };
  const copy = copyOf(parsed.data.copy);
  if (looksLikeIdNumber(JSON.stringify(copy))) return { ok: false, message: "Leave Social Security and tax id numbers off your website." };

  // A flagged number stays flagged until it's changed or removed
  const known = knownNumbers(
    factsMessage({ profile: business.profile, platform: plan.content.platform, details: await publicDetails(), planAnswers: await planAnswers() }),
  );
  const flags = copyFlags(copy, known).filter((flag) => plan.content!.flags.includes(flag));
  const now = new Date();
  const content = { ...plan.content, ...copy, flags };
  const approvedAt = parsed.data.approve ? now : null;
  // Checked again under the lock, so a draft or platform change made meanwhile isn't overwritten
  let problem = null as string | null;
  const saved = await updateMyWebsitePlan((latest) => {
    if (latest?.content?.generatedAt !== parsed.data.draftedAt) problem = "Your words were drafted again since this page loaded. Reload the page to see them.";
    else if (approvedAt && latest.platform !== content.platform) problem = "These words were written for a different platform. Draft them again before approving.";
    return problem ? null : { content, contentApprovedAt: approvedAt };
  });
  if (saved === "no_business") return { ok: false, message: NO_BUSINESS };
  if (problem) return { ok: false, message: problem };
  // Approval stands only once the printable copy is in Documents
  if (approvedAt) {
    const pdf = await saveWebsitePdf(content, now);
    if (!pdf.ok) {
      await updateMyWebsitePlan((latest) => (latest?.contentApprovedAt?.getTime() === approvedAt.getTime() ? { contentApprovedAt: null } : null));
      refresh();
      return pdf;
    }
  }
  refresh();
  return { ok: true, value: null };
}

async function saveWebsitePdf(content: WebsiteContent, now: Date): Promise<ActionResult> {
  const bytes = await websitePdf(content, PLATFORM_DATA[content.platform].name, now);
  const title = `Website words${content.simulated ? " (practice)" : ""}`;
  const existing = (await listMyDocuments()).find((doc) => doc.generatedKind === "website_copy");
  if (existing) {
    const updated = await updateMyDocument(existing.id, { title, data: bytes, mimeType: "application/pdf" });
    return updated ? { ok: true, value: null } : { ok: false, message: "Your business wasn’t found. Reload the page and try again." };
  }
  const created = await createMyDocument({
    title,
    origin: "generated",
    generatedKind: "website_copy",
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

async function websitePdf(content: WebsiteContent, platformName: string, now: Date) {
  return writePdf({
    title: "Your website words",
    subtitle: `Approved ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })} · for ${platformName}`,
    notice: content.simulated ? "Practice draft: written by built-in rules, not by the AI service." : undefined,
    blocks: [
      { heading: "Home page", paragraphs: [content.headline, content.subheadline, content.intro] },
      { heading: "About", paragraphs: [content.about] },
      { heading: "What we sell", entries: content.offerings.map((item) => ({ label: item.name, value: item.description })) },
      { heading: "How to buy", paragraphs: [content.howToBuy] },
      { heading: "Contact", paragraphs: [content.contact] },
      { heading: "Questions and answers", entries: content.faq.map((entry) => ({ label: entry.question, value: entry.answer })) },
      { heading: "Search results", entries: [{ label: "Title", value: content.seoTitle }, { label: "Description", value: content.seoDescription }] },
    ],
    footer: "Website words made with First Sale",
  });
}

const stepSchema = z.object({ key: z.string().max(60), done: z.boolean() });

export async function setSetupStepAction(input: unknown): Promise<ActionResult> {
  const parsed = stepSchema.safeParse(input);
  const plan = await getMyWebsitePlan();
  const platform = plan?.platform;
  if (!parsed.success || !platform || !PLATFORM_DATA[platform].setupSteps.some((step) => step.key === parsed.data.key)) {
    return { ok: false, message: "That step wasn’t found. Reload the page and try again." };
  }
  const { key, done } = parsed.data;
  const saved = await updateMyWebsitePlan((latest) => {
    const steps = new Set(latest?.setupDone ?? []);
    if (done) steps.add(key);
    else steps.delete(key);
    return { setupDone: [...steps] };
  });
  if (saved === "no_business") return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}
