"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { listMyPhotoLibrary, saveMyWebsitePlan, updateMyWebsitePlan } from "@/lib/data/my-business";
import { buyLinkProblem, siteDesignSchema } from "@/lib/website/site/design";
import { finishStands } from "@/lib/website/site/finish";
import { publishReadiness } from "@/lib/website/site/ready";
import { EXISTING_PLATFORMS } from "@/lib/website/types";
import { siteAddress } from "@/lib/website/existing-site";
import { loadSite, publishCheck, siteSignature } from "./site-data";

const NO_BUSINESS = "Tell us about your business first.";

// The owner's look, parts shown, and each item's price, photo and buy link
export async function saveSiteDesignAction(input: unknown): Promise<ActionResult> {
  const parsed = siteDesignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Something in your design didn’t save. Check the prices and links, then try again." };
  const design = parsed.data;
  for (const item of design.items) {
    const problem = buyLinkProblem(item.buyUrl);
    if (problem) return { ok: false, message: `${item.name}: ${problem}` };
  }
  // Only photos the owner approved in their library
  const library = await listMyPhotoLibrary();
  const items = design.items.map((item) =>
    item.photo && !library.some((photo) => photo.id === item.photo!.versionId && photo.photoId === item.photo!.photoId) ? { ...item, photo: null } : item,
  );
  const next = { ...design, items };
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
  const saved = await updateMyWebsitePlan((plan) => (plan?.existingSite ? { existingSite: null } : null));
  if (saved === "no_business") return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}
