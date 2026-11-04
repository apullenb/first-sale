import { Suspense } from "react";
import Link from "next/link";
import { PublishFlow } from "@/components/website/publish-flow";
import { PRIMARY_LINK } from "@/components/styles";
import { PLATFORM_DATA, SNAPSTART_SITE_MONTHLY_USD } from "@/data/website-platforms";
import { publishReadiness } from "@/lib/website/site/ready";
import { loadSite, publishCheck, sitePreviewHtml, siteSignature } from "../site-data";

export const metadata = { title: "Publish your website" };
export default function PublishPage() { return <Suspense fallback={<p className="text-muted">Getting your website ready to publish…</p>}><Publish /></Suspense>; }
async function Publish() {
  const site = await loadSite();
  const html = site ? sitePreviewHtml(site) : null;
  if (!site?.plan || !html || site.content?.platform !== "first_sale") return <div className="max-w-[720px] rounded-2xl border border-line bg-surface p-6"><h1 className="text-2xl font-semibold">Build your website first.</h1><p className="my-4 text-muted">Choose SnapStart site, then build a draft. You can publish it once it’s ready.</p><Link className={PRIMARY_LINK} href="/website">Website setup →</Link></div>;
  const signature = siteSignature(site);
  const finished = site.plan.finished;
  const plan = PLATFORM_DATA.first_sale;
  return <PublishFlow name={site.name} html={html} domain={site.plan.domain} signature={signature} checks={publishReadiness(publishCheck(site))} simulated={site.content.simulated || Boolean(site.design.theme?.simulated)} finished={finished ? { at: finished.at, upToDate: finished.signature === signature } : null} hosting={{ name: plan.plans[0].name, monthlyUsd: SNAPSTART_SITE_MONTHLY_USD, includes: plan.includes }} />;
}
