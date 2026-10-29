"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/(app)/business/actions";
import { getMyHostConnection, getMyWebsitePlan, listMyPhotoLibrary, saveMyWebsitePlan, updateMyWebsitePlan } from "@/lib/data/my-business";
import { OwnerFacingError } from "@/lib/errors";
import { HostError, type HostingState, hostFor, siteNameFor } from "@/lib/website/hosting";
import { publishTarget } from "@/lib/website/hosting/target";
import { buyLinkProblem, siteDesignSchema } from "@/lib/website/site/design";
import { publishReadiness } from "@/lib/website/site/ready";
import { runWorkflow } from "@/lib/workflow-runner";
import { loadSite, publishCheck, siteFiles, siteSignature } from "./site-data";

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
  if (!(await getMyWebsitePlan())) return { ok: false, message: "Choose where you’ll build your site in step 1 first." };
  if (!(await saveMyWebsitePlan({ design: { ...design, items } }))) return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}

const publishSchema = z.object({ signature: z.string().max(64), real: z.boolean() });

// Puts the site online, or runs a practice publish when no host is connected. Only on the owner's click and confirm.
export async function publishSiteAction(input: unknown): Promise<ActionResult> {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reload the page and try again." };
  const [site, connection] = await Promise.all([loadSite(), getMyHostConnection()]);
  if (!site) return { ok: false, message: NO_BUSINESS };
  const plan = site.plan;
  if (!plan) return { ok: false, message: "Choose where you’ll build your site in step 1 first." };

  // The owner confirmed a practice run or a real publish; a connection made since in another tab doesn't change that
  if (parsed.data.real !== Boolean(connection)) {
    return { ok: false, message: "Your Netlify connection changed since this page loaded. Reload the page, then publish." };
  }
  const readiness = publishReadiness(publishCheck(site));
  if (readiness.blockers.length) return { ok: false, message: `Before publishing: ${readiness.blockers.join(" ")}` };
  // The owner publishes the version they last saw
  const signature = siteSignature(site);
  if (signature !== parsed.data.signature) return { ok: false, message: "Your site changed since this page loaded. Check the preview again, then publish." };

  const result = await runWorkflow("website_publish", null, async () => {
    const bundle = await siteFiles(site);
    if (!bundle) throw new OwnerFacingError("Draft your words in step 3 first.");
    try {
      const host = hostFor(connection);
      const target = publishTarget(host, plan.hosting, siteNameFor(site.name, plan.domain));
      if (typeof target === "string") throw new OwnerFacingError(target);
      const published = await host.publish(bundle.files, {
        ...target,
        // Recorded as not live yet, so a failed upload retries this site instead of making another
        onCreated: async ({ siteId, siteName }) => {
          const made: HostingState = {
            siteId,
            siteName,
            url: `https://${siteName}.netlify.app`,
            adminUrl: null,
            deployId: null,
            state: "failed",
            provider: host.id,
            simulated: false,
            publishedAt: new Date().toISOString(),
            hash: "",
          };
          await saveMyWebsitePlan({ hosting: made });
        },
      });
      const hosting: HostingState = { ...published, provider: host.id, simulated: host.simulated, publishedAt: new Date().toISOString(), hash: signature };
      if (!(await saveMyWebsitePlan({ hosting }))) throw new OwnerFacingError(NO_BUSINESS);
    } catch (error) {
      if (error instanceof HostError && error.reconnect) await saveMyWebsitePlan({ hostConnection: null });
      throw error;
    }
  });
  refresh();
  return result.ok ? { ok: true, value: null } : result;
}

// Asks the host again whether a publish that was still finishing is live now
export async function checkPublishAction(): Promise<ActionResult> {
  const [plan, connection] = await Promise.all([getMyWebsitePlan(), getMyHostConnection()]);
  const hosting = plan?.hosting;
  if (!hosting || hosting.simulated || hosting.state === "ready" || !hosting.deployId) {
    refresh();
    return { ok: true, value: null };
  }
  if (!connection) return { ok: false, message: "Connect Netlify again to check your site." };
  // Only the publish that was checked; a newer one keeps its own state
  const mark = (state: HostingState["state"]) =>
    updateMyWebsitePlan((latest) => (latest?.hosting?.deployId === hosting.deployId ? { hosting: { ...latest.hosting, state } } : null));
  try {
    const host = hostFor(connection);
    await mark((await host.check?.(hosting.deployId)) ?? hosting.state);
  } catch (error) {
    if (error instanceof HostError) {
      if (error.reconnect) await saveMyWebsitePlan({ hostConnection: null });
      // Netlify said the deploy failed, so the owner can publish again
      else await mark("failed");
      refresh();
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Couldn’t reach Netlify just now. Try again in a minute." };
  }
  refresh();
  return { ok: true, value: null };
}

// Forgets the Netlify connection here; the site stays online in the owner's Netlify account
export async function disconnectHostAction(): Promise<ActionResult> {
  const saved = await updateMyWebsitePlan((plan) => (plan?.hostConnected ? { hostConnection: null } : null));
  if (saved === "no_business") return { ok: false, message: NO_BUSINESS };
  refresh();
  return { ok: true, value: null };
}
