import { Suspense } from "react";
import Link from "next/link";
import { PracticeBanner } from "@/components/practice-banner";
import { PageHead } from "@/components/ui";
import { Kicker } from "@/components/marketing/pieces";
import { PRIMARY_LINK } from "@/components/styles";
import { PlatformCard } from "@/components/website/platform-card";
import { DomainFinder } from "@/components/website/domain-finder";
import { ExistingSitePanel } from "@/components/website/existing-site";
import { WebsiteSetup } from "@/components/website/website-setup";
import { PLATFORM_DATA } from "@/data/website-platforms";
import { domainIdeas } from "@/lib/website/domains";
import { sectionMetadata } from "@/lib/sections";
import { recommendPlatform } from "@/lib/website/recommend";
import { JobWatch } from "@/components/job-watch";
import { lastMyRun, listMyJourneyMarks } from "@/lib/data/my-business";
import { loadSite, sitePreviewHtml, siteSignature } from "./site-data";

export const metadata = sectionMetadata("/website");
export const maxDuration = 300;
export default function WebsitePage() {
  return <div className="flex max-w-[1040px] flex-col gap-7"><PageHead kicker={<Kicker icon="globe">Build your brand</Kicker>} title="Create your website" lead="Choose how you’ll build it and where it lives. Then design it, check it and publish it." /><Suspense fallback={<p className="text-muted">Loading your website setup…</p>}><Setup /></Suspense></div>;
}
async function Setup() {
  const [site, marks, run] = await Promise.all([loadSite(), listMyJourneyMarks(), lastMyRun("website_copy", null)]);
  if (!site) return <div className="rounded-2xl border border-line bg-surface p-6"><h2 className="text-xl font-semibold">Start with your business.</h2><p className="my-4 text-muted">Your answers and brand give your website its direction.</p><Link href="/business" className={PRIMARY_LINK}>Tell us about your business →</Link></div>;
  const recommendation = recommendPlatform(site.profile);
  const recommended = ["first_sale", "square"].includes(recommendation.platform) ? recommendation.platform : "first_sale";
  const chosen = site.plan?.platform ?? null;
  const preview = chosen === "first_sale" ? sitePreviewHtml(site) : null;
  const finished = site.plan?.finished ? { at: site.plan.finished.at, upToDate: site.plan.finished.signature === siteSignature(site) } : null;
  return <>{site.content?.simulated ? <PracticeBanner what="Your website draft uses offline suggestions." /> : null}{run?.status === "running" ? <JobWatch jobs={[{ workflow: "website_copy", subjectId: null }]} what="Building your website" /> : null}<WebsiteSetup building={run?.status === "running"} chosen={chosen} domain={chosen === "square" ? site.plan?.existingSite?.url ?? null : site.plan?.domain ?? null} hasDraft={Boolean(site.content && site.content.platform === "first_sale")} updatedAt={site.plan?.updatedAt.toISOString() ?? null} name={site.name} products={site.products.length} images={site.library.length} preview={preview} approved={site.approved} finished={finished}
    options={<div className="grid gap-4 sm:grid-cols-2">{(["first_sale", "square", "wix", "shopify"] as const).map((id) => <PlatformCard key={id} platform={PLATFORM_DATA[id]} recommended={id === recommended ? { reasons: [] } : null} chosen={id === chosen} share={null} explanation={null} />)}</div>}
    address={<DomainFinder ideas={domainIdeas(site.profile.name, site.profile.location.city).slice(0, 3)} checks={site.plan?.domainChecks ?? []} chosen={site.plan?.domain ?? null} />}
    square={<ExistingSitePanel connected={site.plan?.existingSite ?? null} marked={marks.find((mark) => mark.key === "website") ?? null} startOpen={!site.plan?.existingSite && !marks.some((mark) => mark.key === "website")} initialPlatform="square" />}
  /></>;
}
