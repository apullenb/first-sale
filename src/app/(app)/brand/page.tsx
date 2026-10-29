import Link from "next/link";
import { Suspense } from "react";
import { AlreadyHave } from "@/components/already-have";
import { ImagesSection } from "@/components/brand/images";
import { KitSection } from "@/components/brand/kit";
import { LibraryUpload } from "@/components/brand/library-upload";
import { LogoColors } from "@/components/brand/logo-colors";
import { BrandNotes } from "@/components/brand/notes";
import { VersionsSection } from "@/components/brand/versions";
import { RunNotice } from "@/components/documents/run-notice";
import { Icon } from "@/components/icons";
import { Kicker } from "@/components/marketing/pieces";
import { PracticeBanner } from "@/components/practice-banner";
import { PRIMARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, Note, PageHead } from "@/components/ui";
import { getImageModel } from "@/lib/ai";
import { brandFileUrl } from "@/lib/brand/files";
import { getMyBrand, getMyBrandState, getMyBusiness, lastMyRun, listMyDocuments, listMyJourneyMarks } from "@/lib/data/my-business";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/brand");
// Versions and brand pictures each wait on AI calls
export const maxDuration = 300;

export default function BrandPage() {
  return (
    <div className="flex max-w-[1000px] flex-col gap-8">
      <PageHead
        kicker={<Kicker icon="palette">Build your brand · Step 2</Kicker>}
        title="Build your brand"
        lead="From your logo, get the versions you’ll need, your colors and matching pictures for your social pages and website, all in one brand kit. Nothing is used until you approve it."
      />
      <Suspense fallback={<p className="text-muted">Loading your brand…</p>}>
        <Brand />
      </Suspense>
      <Suspense fallback={null}>
        <BrandNotes />
      </Suspense>
    </div>
  );
}

function drawingModel() {
  try {
    return getImageModel();
  } catch {
    return null;
  }
}

async function Brand() {
  const [business, state, marks] = await Promise.all([getMyBusiness(), getMyBrandState(), listMyJourneyMarks()]);
  if (!business || !state) {
    return (
      <Card title="Tell us about your business first" icon="store" id="first-heading">
        <p className="text-muted">Then you can make your logo and brand.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }
  const practice = drawingModel()?.simulated ?? false;
  const chosen = state.assets.find((asset) => asset.id === state.chosenLogoId && asset.kind === "logo") ?? null;
  const mark = marks.find((each) => each.key === "brand") ?? null;
  const already = (
    <AlreadyHave
      markKey="brand"
      label="I already have my brand files"
      help="Mark this step done if you already have your logo versions, colors and pictures. You can also add your files to your Brand Library, so they’re kept together with everything else."
      done={mark ? { url: mark.url, note: mark.note } : null}
    >
      <LibraryUpload groups={["logos", "brand_images", "other"]} initialGroup="logos" maxBytes={MAX_UPLOAD_BYTES} />
      <p className="text-sm text-muted">
        Everything you add is in{" "}
        <Link href="/brand-library" className={TEXT_LINK}>
          your Brand Library
        </Link>
        .
      </p>
    </AlreadyHave>
  );

  if (!chosen) {
    return (
      <>
        <Card title="Create your logo first" icon="sparkles" id="no-logo-heading">
          <p className="text-rule">Your logo versions, colors and pictures are all made from your logo. Get logo ideas made for your business, or upload the logo you already have.</p>
          <Link href="/logo" className={PRIMARY_LINK}>
            Create your logo
            <Icon name="arrow" size="sm" />
          </Link>
        </Card>
        {already}
      </>
    );
  }

  const [versionsRun, imagesRun, kit, documents] = await Promise.all([
    lastMyRun("brand_versions", chosen.id),
    lastMyRun("brand_images", chosen.id),
    getMyBrand(),
    listMyDocuments(),
  ]);
  const guideId = documents.find((doc) => doc.generatedKind === "logo_guide")?.id ?? null;
  const versionsApproved = Boolean(kit?.logos.stacked && kit.logos.profile && kit.logos.solid);
  const uploaded = chosen.origin === "uploaded";

  return (
    <>
      {practice ? <PracticeBanner what="Every version and picture here is a plain text preview, not made by Muse." /> : null}
      {already}

      {uploaded ? (
        <section aria-labelledby="own-logo-heading" className="flex flex-col gap-4">
          <Card title="Your logo’s colors" icon="palette" id="own-logo-heading">
            <LogoColors key={chosen.id} assetId={chosen.id} src={brandFileUrl(chosen.id)} saved={chosen.design?.palette ?? []} />
          </Card>
          <Note icon="info" tone="quiet">
            <p className="font-semibold text-rule">What works differently with a logo you uploaded</p>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
              <li>First Sale never changes your file. Versions and pictures are new files made from it.</li>
              <li>One-click changes, like new colors or lettering, are only for logos drawn here.</li>
              <li>First Sale doesn’t know your logo’s lettering, so the logo guide doesn’t suggest matching fonts.</li>
              {chosen.mimeType === "image/webp" ? <li>The logo guide can’t hold a WebP picture, so it points to your logo file instead. Upload a PNG to have it in the guide.</li> : null}
            </ul>
          </Note>
        </section>
      ) : null}

      {kit ? (
        <div className="flex flex-col gap-3">
          <RunNotice run={versionsRun} what="Making your logo versions" />
          <VersionsSection key={chosen.id} chosen={chosen} name={kit.businessName} assets={state.assets} picks={state.picks} practice={practice} running={versionsRun?.status === "running"} />
        </div>
      ) : null}

      {kit && versionsApproved ? (
        <div className="flex flex-col gap-3">
          <RunNotice run={imagesRun} what="Making your brand pictures" />
          <ImagesSection key={chosen.id} chosenId={chosen.id} name={kit.businessName} assets={state.assets} picks={state.picks} practice={practice} running={imagesRun?.status === "running"} />
        </div>
      ) : null}

      {kit ? <KitSection kit={kit} guideId={guideId} /> : null}
    </>
  );
}
