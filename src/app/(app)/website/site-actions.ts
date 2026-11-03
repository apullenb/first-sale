"use server";

import { getWebsiteDesignModel } from "@/lib/ai";
import { myAiKey } from "@/lib/data/my-business";
import { runWorkflow } from "@/lib/workflow-runner";
import { themeFacts } from "./theme-input";
import { designBrandTheme, validateTheme } from "@/lib/website/site/theme";
import { isDemoSession } from "@/lib/auth/server";
import { DEMO_REFUSAL } from "@/lib/demo";
import { refresh } from "next/cache";
import { z } from "zod";
import { websiteCopySchema } from "@/lib/website/content";
import { copyOf } from "@/lib/website/words";
import type { ActionResult } from "@/app/(app)/business/actions";
import { saveMyWebsitePlan, updateMyWebsitePlan } from "@/lib/data/my-business";
import { buyLinkProblem, siteDesignSchema } from "@/lib/website/site/design";
import { finishStands } from "@/lib/website/site/finish";
import { publishReadiness } from "@/lib/website/site/ready";
import { EXISTING_PLATFORMS } from "@/lib/website/types";
import { siteAddress } from "@/lib/website/existing-site";
import { loadSite, publishCheck, siteSignature } from "./site-data";

const NO_BUSINESS = "Tell us about your business first.";

// The owner's look, parts shown, and each item's price, photo and buy link
export async function saveSiteDesignAction(input: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = siteDesignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Something in your design didn’t save. Check the prices and links, then try again." };
  const design = parsed.data;
  for (const item of design.items) {
    const problem = buyLinkProblem(item.buyUrl);
    if (problem) return { ok: false, message: `${item.name}: ${problem}` };
  }
  // Only photos the owner approved in their library
  const site = await loadSite();
  const library = site?.library ?? [];
  if (design.items.some((item) => item.photo && !library.some((photo) => photo.id === item.photo!.versionId && photo.photoId === item.photo!.photoId))) return { ok: false, message: "Choose product photos from your own library." };
  const items = design.items;
  if (design.heroImage && !library.some((photo) => photo.id === design.heroImage!.versionId && photo.photoId === design.heroImage!.photoId)) return { ok: false, message: "Choose a header picture from your own library." };
  const next = { ...design, items, ...(design.theme ? { theme: validateTheme(design.theme) } : {}) };
  let missing = false;
  // A changed design needs finishing again
  const saved = await updateMyWebsitePlan((plan) => {
    if (!plan) {
      missing = true;
      return null;
    }
    const stands = finishStands({ copy: null, approved: true, design: plan.design }, { copy: null, approved: true, design: next });
    return { design: next, ...(stands ? {} : { finished: null }) };
  });
  if (saved === "no_business") return { ok: false, message: NO_BUSINESS };
  if (missing) return { ok: false, message: "Choose where you’ll build your site in step 1 first." };
  refresh();
  return { ok: true, value: null };
}

const finishSchema = z.object({ signature: z.string().max(64) });

// The demo finish: checks the site is ready and records it. Nothing is published or sent anywhere.
export async function finishSiteAction(input: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const site = await loadSite();
  if (!site) return { ok: false, message: NO_BUSINESS };
  if (!site.plan) return { ok: false, message: "Choose where you’ll build your site in step 1 first." };
  const readiness = publishReadiness(publishCheck(site));
  if (readiness.blockers.length) return { ok: false, message: `Before finishing: ${readiness.blockers.join(" ")}` };
  // The owner finishes the version they last saw
  const signature = siteSignature(site);
  if (signature !== parsed.data.signature) return { ok: false, message: "Your site changed since this page loaded. Check the preview again, then finish." };
  if (!(await saveMyWebsitePlan({ finished: { at: new Date().toISOString(), signature } }))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

const connectSchema = z.object({ platform: z.enum(EXISTING_PLATFORMS), url: z.string().max(500) });

// A demo connection to a site the owner already has: only the platform and address, never a password or key
export async function connectExistingSiteAction(input: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = connectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick where your site is built." };
  const url = siteAddress(parsed.data.url);
  if (!url) return { ok: false, message: "Type your site’s address, like risebakery.com." };
  if (!(await saveMyWebsitePlan({ existingSite: { platform: parsed.data.platform, url, connectedAt: new Date().toISOString() } }))) {
    return { ok: false, message: NO_BUSINESS };
  }
  refresh();
  return { ok: true, value: null };
}

export async function disconnectExistingSiteAction(): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const saved = await updateMyWebsitePlan((plan) => (plan?.existingSite ? { existingSite: null } : null));
  if (saved === "no_business") return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

export async function designThemeAction(request: string, draft?: unknown) {
  if (await isDemoSession()) return DEMO_REFUSAL;
  if (typeof request !== "string" || request.length > 1000) return { ok: false as const, message: "Keep your design request under 1,000 characters." };
  let site = await loadSite();
  if (!site || site.platform !== "first_sale") return { ok: false as const, message: "Choose a SnapStart site first." };
  if (draft !== undefined) {
    const parsed = z.object({ copy: websiteCopySchema, design: siteDesignSchema }).safeParse(draft);
    if (!parsed.success) return { ok: false as const, message: "Check your draft before requesting a design." };
    site = { ...site, design: parsed.data.design, content: site.content ? { ...site.content, ...parsed.data.copy } : null };
  }
  let proposal: Awaited<ReturnType<typeof designBrandTheme>> | undefined;
  const result = await runWorkflow("website_theme", null, async () => {
    proposal = await designBrandTheme(getWebsiteDesignModel(), await themeFacts(site, request), await myAiKey());
  });
  return result.ok && proposal ? { ok: true as const, value: proposal } : result.ok ? { ok: false as const, message: "The theme could not be drafted. Try again." } : result;
}

const builderSchema = z.object({ design: siteDesignSchema, copy: websiteCopySchema, revision: z.string().max(60) });

export async function saveWebsiteBuilderAction(input: unknown): Promise<ActionResult> {
  if (await isDemoSession()) return DEMO_REFUSAL;
  const parsed = builderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the page text, prices and links before saving." };
  const site = await loadSite();
  if (!site?.plan || !site.content || site.platform !== "first_sale") return { ok: false, message: "Open your SnapStart website first." };
  const { copy, design, revision } = parsed.data;
  for (const item of design.items) {
    const problem = buyLinkProblem(item.buyUrl);
    if (problem) return { ok: false, message: `${item.name}: ${problem}` };
  }
  const refs = [...design.items.flatMap((item) => item.photo ? [item.photo] : []), ...(design.heroImage ? [design.heroImage] : [])];
  if (refs.some((ref) => !site.library.some((photo) => photo.id === ref.versionId && photo.photoId === ref.photoId))) return { ok: false, message: "An image is no longer in your library. Choose another one before saving." };
  const nextDesign = { ...design, ...(design.theme ? { theme: validateTheme(design.theme) } : {}) };
  let stale = false;
  const result = await updateMyWebsitePlan((latest) => {
    if (!latest?.content || latest.platform !== "first_sale" || latest.updatedAt.toISOString() !== revision) { stale = true; return null; }
    const descriptions = (items: typeof design.items) => items.filter((item) => item.description !== undefined).map(({ name, description }) => ({ name, description }));
    const changedWords = JSON.stringify(copyOf(latest.content)) !== JSON.stringify(copy) || JSON.stringify(descriptions(latest.design?.items ?? [])) !== JSON.stringify(descriptions(design.items)) || JSON.stringify(latest.design?.labels) !== JSON.stringify(design.labels);
    const flags = latest.content.flags.filter((flag) => { const quoted = flag.match(/“([^”]+)”/)?.[1]; return !quoted || JSON.stringify(copy).includes(quoted); });
    return { design: nextDesign, content: { ...latest.content, ...copy, flags }, ...(changedWords ? { contentApprovedAt: null } : {}), finished: null };
  });
  if (result === "no_business") return { ok: false, message: NO_BUSINESS };
  if (stale) return { ok: false, message: "This website was changed in another tab. Reload before saving to keep the newer changes." };
  refresh();
  return { ok: true, value: null };
}
