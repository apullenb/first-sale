import Link from "next/link";
import { Suspense } from "react";
import { clearIdeasAction } from "@/app/(app)/brand/actions";
import { ActionButton } from "@/components/action-button";
import { BriefForm } from "@/components/brand/brief-form";
import { IdeasSection } from "@/components/brand/ideas";
import { ImagesSection } from "@/components/brand/images";
import { KitSection } from "@/components/brand/kit";
import { BrandNotes } from "@/components/brand/notes";
import { VersionsSection } from "@/components/brand/versions";
import { RunNotice } from "@/components/documents/run-notice";
import { PracticeBanner } from "@/components/practice-banner";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK } from "@/components/styles";
import { getImageModel } from "@/lib/ai";
import { briefDefaults } from "@/lib/brand/brief";
import { getMyBrand, getMyBrandState, getMyBusiness, lastMyRun } from "@/lib/data/my-business";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/brand");
// Ideas, drawings, versions and pictures each wait on AI calls
export const maxDuration = 300;

export default function BrandPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Marketing and branding</p>
        <h1 className={PAGE_TITLE}>Branding</h1>
        <p className="text-lg text-muted">
          Pick the words that fit how your business should feel, and see your brand described back to you. Then AI writes logo ideas from it and draws
          them. You choose one, get the versions you’ll need, and make matching pictures for your pages. Nothing is used until you approve it.
        </p>
      </div>
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
  const [business, state] = await Promise.all([getMyBusiness(), getMyBrandState()]);
  if (!business || !state) {
    return (
      <section className={`${CARD} flex flex-col gap-3`}>
        <p>Tell us about your business first. Then you can make your logo here.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
        </Link>
      </section>
    );
  }
  const image = drawingModel();
  const practice = image?.simulated ?? false;
  const latestRound = state.rounds[0] ?? null;
  const chosen = state.assets.find((asset) => asset.id === state.chosenLogoId && asset.kind === "logo") ?? null;
  const [ideasRun, drawRun, versionsRun, imagesRun, kit] = await Promise.all([
    lastMyRun("brand_ideas", null),
    latestRound ? lastMyRun("brand_draw", latestRound.id) : null,
    chosen ? lastMyRun("brand_versions", chosen.id) : null,
    chosen ? lastMyRun("brand_images", chosen.id) : null,
    getMyBrand(),
  ]);
  const ideasRunning = ideasRun?.status === "running";
  const blocked = !image?.generate ? "Logo drawing isn’t turned on for First Sale yet." : ideasRunning ? "Logo ideas are being written right now. This page will update when they’re ready." : null;
  const versionsApproved = Boolean(kit?.logos.stacked && kit.logos.profile && kit.logos.solid);

  return (
    <>
      {practice ? <PracticeBanner what="Logo ideas here are placeholders and every logo or picture is a plain text preview, not made by Muse." /> : null}

      <RunNotice run={ideasRun} what="Writing logo ideas" />
      <BriefForm initial={briefDefaults(business.profile, state.brief)} practice={practice} blocked={blocked} hasIdeas={state.rounds.length > 0} />

      {state.rounds.length ? (
        <div className="flex flex-col gap-3">
          <RunNotice run={drawRun} what="Drawing your logos" />
          <IdeasSection
            rounds={state.rounds}
            assets={state.assets}
            chosenLogoId={chosen?.id ?? null}
            practice={practice}
            drawing={new Set(drawRun?.status === "running" && latestRound ? [latestRound.id] : [])}
          />
          {state.rounds.length > 1 ? (
            <ActionButton
              action={clearIdeasAction}
              label={chosen ? "Remove the ideas I didn’t choose" : "Remove all ideas"}
              pendingLabel="Removing…"
              variant="danger"
              confirm={chosen ? "Remove every round of ideas except the one with your chosen logo? This can’t be undone." : "Remove all your logo ideas? This can’t be undone."}
            />
          ) : null}
        </div>
      ) : null}

      {chosen && kit ? (
        <div className="flex flex-col gap-3">
          <RunNotice run={versionsRun} what="Making your logo versions" />
          <VersionsSection key={chosen.id} chosen={chosen} name={kit.businessName} assets={state.assets} picks={state.picks} practice={practice} running={versionsRun?.status === "running"} />
        </div>
      ) : null}

      {chosen && kit && versionsApproved ? (
        <div className="flex flex-col gap-3">
          <RunNotice run={imagesRun} what="Making your brand pictures" />
          <ImagesSection key={chosen.id} chosenId={chosen.id} name={kit.businessName} assets={state.assets} picks={state.picks} practice={practice} running={imagesRun?.status === "running"} />
        </div>
      ) : null}

      {kit ? <KitSection kit={kit} /> : null}
    </>
  );
}
