import Link from "next/link";
import { Suspense } from "react";
import { chooseLogoAction, clearIdeasAction } from "@/app/(app)/brand/actions";
import { removeUploadedLogoAction } from "@/app/(app)/logo/actions";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { AlreadyHave } from "@/components/already-have";
import { BriefForm } from "@/components/brand/brief-form";
import { IdeasSection } from "@/components/brand/ideas";
import { LogoUpload } from "@/components/brand/logo-upload";
import { BrandNotes } from "@/components/brand/notes";
import { RunNotice } from "@/components/documents/run-notice";
import { Icon } from "@/components/icons";
import { Done, Kicker } from "@/components/marketing/pieces";
import { PracticeBanner } from "@/components/practice-banner";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, PageHead } from "@/components/ui";
import { getImageModel } from "@/lib/ai";
import { briefDefaults } from "@/lib/brand/brief";
import { brandFileUrl } from "@/lib/brand/files";
import type { AssetSummary } from "@/lib/data/brand";
import { getMyBrandState, getMyBusiness, lastMyRun, listMyJourneyMarks } from "@/lib/data/my-business";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/logo");
// Ideas and drawings each wait on AI calls
export const maxDuration = 300;

export default function LogoPage() {
  return (
    <div className="flex max-w-[1000px] flex-col gap-8">
      <PageHead
        kicker={<Kicker icon="sparkles">Build your brand · Step 1</Kicker>}
        title="Create your logo"
        lead="Pick the words that fit how your business should feel, and see your brand described back to you. Then AI writes logo ideas from it and draws them, and you choose one. Already have a logo? Upload it instead."
      />
      <Suspense fallback={<p className="text-muted">Loading your logo…</p>}>
        <Logo />
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

async function Logo() {
  const [business, state, marks] = await Promise.all([getMyBusiness(), getMyBrandState(), listMyJourneyMarks()]);
  if (!business || !state) {
    return (
      <Card title="Tell us about your business first" icon="store" id="first-heading">
        <p className="text-muted">Then you can make your logo here.</p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }
  const image = drawingModel();
  const practice = image?.simulated ?? false;
  const latestRound = state.rounds[0] ?? null;
  const chosen = state.assets.find((asset) => asset.id === state.chosenLogoId && asset.kind === "logo") ?? null;
  const [ideasRun, drawRun] = await Promise.all([lastMyRun("brand_ideas", null), latestRound ? lastMyRun("brand_draw", latestRound.id) : null]);
  const ideasRunning = ideasRun?.status === "running";
  const blocked = !image?.generate ? "Logo drawing isn’t turned on for First Sale yet." : ideasRunning ? "Logo ideas are being written right now. This page will update when they’re ready." : null;
  const mark = marks.find((each) => each.key === "logo") ?? null;
  const uploads = state.assets.filter((asset) => asset.origin === "uploaded");
  const brief = briefDefaults(business.profile, state.brief);

  return (
    <>
      {practice ? <PracticeBanner what="Logo ideas here are placeholders and every logo is a plain text preview, not made by Muse." /> : null}

      {chosen ? <ChosenLogo chosen={chosen} /> : null}

      {/* A new chosen logo closes the panel: the step is done */}
      <AlreadyHave
        key={chosen?.id ?? "none"}
        markKey="logo"
        label={chosen?.origin === "uploaded" ? "Upload a different logo" : "I already have a logo"}
        help="Upload your logo, and First Sale uses it for your logo versions, brand kit and website. Or just mark this step done if you’d rather keep your logo files elsewhere."
        done={mark ? { url: mark.url, note: mark.note } : null}
      >
        <LogoUpload businessName={brief.name} maxBytes={MAX_UPLOAD_BYTES} replacing={chosen !== null} />
        {uploads.filter((asset) => asset.id !== chosen?.id).length ? <EarlierUploads uploads={uploads.filter((asset) => asset.id !== chosen?.id)} /> : null}
      </AlreadyHave>

      <RunNotice run={ideasRun} what="Writing logo ideas" />
      <BriefForm initial={brief} practice={practice} blocked={blocked} hasIdeas={state.rounds.length > 0} />

      {state.rounds.length ? (
        <div className="flex flex-col gap-3">
          <RunNotice run={drawRun} what="Drawing your logos" />
          <IdeasSection
            rounds={state.rounds}
            assets={state.assets}
            chosenLogoId={chosen?.id ?? null}
            practice={practice}
            drawing={new Set(drawRun?.status === "running" && latestRound ? [latestRound.id] : [])}
            ownerTagline={state.brief?.tagline ?? ""}
            pickedFamilies={state.brief?.colors ?? []}
          />
          {state.rounds.length > 1 ? (
            <ActionButton
              action={clearIdeasAction}
              label={chosen?.origin === "generated" ? "Remove the ideas I didn’t choose" : "Remove all ideas"}
              pendingLabel="Removing…"
              variant="danger"
              confirm={
                chosen?.origin === "generated"
                  ? "Remove every round of ideas except the one with your chosen logo? This can’t be undone."
                  : "Remove all your logo ideas? This can’t be undone."
              }
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

// The pick, and where to go next
function ChosenLogo({ chosen }: { chosen: AssetSummary }) {
  const uploaded = chosen.origin === "uploaded";
  return (
    <Card title="Your chosen logo" icon="check" tone="done" id="chosen-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={brandFileUrl(chosen.id)}
          alt={chosen.simulated ? "Practice preview of your logo" : "Your chosen logo"}
          width={chosen.width}
          height={chosen.height}
          className="h-auto max-h-48 w-full max-w-xs rounded-xl border border-line bg-white object-contain"
        />
        <div className="flex min-w-0 flex-col gap-3">
          <Done>
            <span className="flex flex-wrap items-center gap-2">
              <ActorChip actor="owner" />
              {uploaded ? `You uploaded this logo${chosen.title ? ` (${chosen.title})` : ""}. It’s kept exactly as you sent it.` : "You chose this logo."}
            </span>
          </Done>
          <p className="text-[15px] text-rule">Next, get its versions, colors and matching pictures for your pages.</p>
          <Link href="/brand" className={PRIMARY_LINK}>
            Build your brand
            <Icon name="arrow" size="sm" />
          </Link>
          {uploaded ? (
            <ActionButton
              action={removeUploadedLogoAction.bind(null, chosen.id)}
              label="Remove this logo"
              pendingLabel="Removing…"
              variant="danger"
              confirm="Remove your uploaded logo, with the versions and pictures made from it? This can’t be undone."
            />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

// Logos uploaded before, which the owner can remove
function EarlierUploads({ uploads }: { uploads: AssetSummary[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">Logos you uploaded before</p>
      <ul className="flex flex-col gap-2">
        {uploads.map((asset) => (
          <li key={asset.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-2.5 shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandFileUrl(asset.id)} alt="" width={asset.width} height={asset.height} className="h-12 w-auto max-w-24 rounded border border-line bg-white object-contain" />
            <span className="min-w-0 flex-1 break-words text-[15px]">{asset.title ?? "Uploaded logo"}</span>
            <ActionButton
              action={chooseLogoAction.bind(null, asset.id)}
              label="Use this logo"
              pendingLabel="Choosing…"
              confirm="Use this logo instead? Versions and brand pictures made from your current logo will be cleared from your brand kit."
            />
            <ActionButton action={removeUploadedLogoAction.bind(null, asset.id)} label="Remove" pendingLabel="Removing…" variant="danger" confirm="Remove this uploaded logo? This can’t be undone." />
          </li>
        ))}
      </ul>
    </div>
  );
}
