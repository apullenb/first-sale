import Link from "next/link";
import { Suspense } from "react";
import { AlreadyHave } from "@/components/already-have";
import { BrandForm } from "@/components/brand/brand-form";
import { Completed, Revisit } from "@/components/completed";
import { LibraryUpload } from "@/components/brand/library-upload";
import { Icon } from "@/components/icons";
import { Kicker, SectionHead } from "@/components/marketing/pieces";
import { PracticeBanner } from "@/components/practice-banner";
import { PRIMARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { getModel } from "@/lib/ai";
import { briefDefaults } from "@/lib/brand/brief";
import { BRAND_IMAGES_HREF, libraryFileUrl } from "@/lib/brand/library";
import { getMyBrandState, getMyBusiness, listMyJourneyMarks, listMyLibraryFiles } from "@/lib/data/my-business";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/brand");
// Describing the brand waits on an AI call
export const maxDuration = 300;

export default function BrandPage() {
  return (
    <div className="flex max-w-[1000px] flex-col gap-8">
      <PageHead
        kicker={<Kicker icon="palette">Build your brand · Step 1</Kicker>}
        title="Build your brand"
        lead="Say what you sell and how your business should feel, then approve a short description of your brand. It guides your logo in step 2 and every picture after it."
      />
      <Suspense fallback={<p className="text-muted">Loading your brand…</p>}>
        <Brand />
      </Suspense>
    </div>
  );
}

function practiceMode(): boolean {
  try {
    return getModel().simulated;
  } catch {
    return false;
  }
}

async function Brand() {
  const [business, state, marks, files] = await Promise.all([getMyBusiness(), getMyBrandState(), listMyJourneyMarks(), listMyLibraryFiles()]);
  if (!business || !state) {
    return (
      <Card title="Tell us about your business first" icon="store" id="first-heading">
        <p className="text-muted">Then you can describe your brand here.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }
  const practice = practiceMode();
  const mark = marks.find((each) => each.key === "brand") ?? null;
  const pictures = files.filter((file) => file.group === "brand_images");
  const approved = state.brief?.storyApproved && state.brief.story ? state.brief.story : null;
  const alreadyHave = (
    <AlreadyHave
      markKey="brand"
      label="I already have a brand"
      help="Mark this step done if you already know how your business looks and feels, with colors and a style you use. Add brand pictures you have below, so they’re kept with everything else."
      done={mark ? { url: mark.url, note: mark.note } : null}
    />
  );
  const form = <BrandForm initial={briefDefaults(business.profile, state.brief)} practice={practice} />;
  const next = (
    <Link href="/logo" className={`${PRIMARY_LINK} w-fit`}>
      Next: Create your logo
      <Icon name="arrow" size="sm" />
    </Link>
  );

  return (
    <>
      {practice ? <PracticeBanner what="Your brand description here is a practice sample, not written by AI." /> : null}
      {approved ? (
        <>
          <Completed eyebrow="Your brand" title="You approved your brand description">
            <blockquote className="border-l-[3px] border-done/40 py-1 pl-4 font-display text-[21px] leading-snug sm:text-[23px]">{approved}</blockquote>
            {next}
          </Completed>
          <Revisit summary="See your picks and the description again, and change or rewrite it if you want.">{form}</Revisit>
        </>
      ) : mark ? (
        <>
          <Completed eyebrow="Your brand" title="You already have a brand">
            {alreadyHave}
            {next}
          </Completed>
          <Revisit summary="Describe your brand here after all, to guide your logo and pictures.">{form}</Revisit>
        </>
      ) : (
        <>
          {alreadyHave}
          {form}
        </>
      )}

      <section aria-labelledby="own-pictures-heading" className="flex flex-col gap-4">
        <SectionHead
          id="own-pictures-heading"
          number={approved || mark ? undefined : 4}
          icon="image"
          title="Brand pictures you already have"
          lead="Optional. Add pictures you already use, such as a banner, a cover photo or a pattern. They’re kept exactly as you upload them, in your Brand Library’s Brand images group."
        />
        <Card bodyClassName="gap-5">
          <LibraryUpload groups={["brand_images"]} initialGroup="brand_images" maxBytes={MAX_UPLOAD_BYTES} />
          {pictures.length ? (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <p className="font-semibold">Added so far</p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {pictures.map((file) => (
                  <li key={file.id} className="flex flex-col gap-1.5">
                    <a href={libraryFileUrl(file.id)} target="_blank" rel="noopener noreferrer" className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border border-line bg-soft p-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={libraryFileUrl(file.id)} alt={file.title} width={file.width} height={file.height} loading="lazy" className="max-h-full w-auto max-w-full object-contain" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    <span className="text-sm break-words">{file.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-sm text-muted">
            Everything you add is in{" "}
            <Link href={BRAND_IMAGES_HREF} className={TEXT_LINK}>
              your Brand Library
            </Link>
            , where SnapStart also recommends brand images to make from your logo.
          </p>
        </Card>
      </section>
    </>
  );
}
