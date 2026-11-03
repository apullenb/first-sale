import { Suspense } from "react";
import Link from "next/link";
import { WebsiteEditor } from "@/components/website/website-editor";
import { PRIMARY_LINK } from "@/components/styles";
import { copyOf } from "@/lib/website/words";
import { publishReadiness } from "@/lib/website/site/ready";
import { loadSite, publishCheck } from "../site-data";

export const metadata = { title: "Website editor" };
export const maxDuration = 300;
export default function EditorPage() { return <Suspense fallback={<p className="text-muted">Opening your website editor…</p>}><Editor /></Suspense>; }
async function Editor() {
  const site = await loadSite();
  if (!site?.plan || site.platform !== "first_sale" || !site.content || site.content.platform !== "first_sale") return <div className="rounded-2xl border border-line bg-surface p-6"><h1 className="text-2xl font-semibold">Let’s start your website.</h1><p className="my-4 text-muted">Choose SnapStart, then build a draft or start directly in the editor.</p><Link className={PRIMARY_LINK} href="/website">Website setup →</Link></div>;
  const view = (file: { url: string; width: number; height: number } | null) => file ? { src: file.url, width: file.width, height: file.height } : null;
  return <WebsiteEditor name={site.name} revision={site.plan.updatedAt.toISOString()} draftedAt={site.content.generatedAt} approved={site.approved} simulated={site.content.simulated} copy={copyOf(site.content)} design={site.design} images={{ logo: view(site.brand?.logos.primary ?? null), hero: view(site.brand?.images.websiteHero ?? null), favicon: view(site.brand?.logos.profile ?? null) }} library={site.library.map(({ id, photoId, title, src, width, height, simulated }) => ({ id, photoId, title, src, width, height, simulated }))} products={site.products} brandColors={site.brand?.colors ?? []} contact={site.contact} domain={site.plan.domain} year={site.year} checks={publishReadiness(publishCheck(site))} />;
}
