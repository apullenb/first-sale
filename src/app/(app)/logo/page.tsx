import Link from "next/link";
import { Suspense } from "react";
import { chooseLogoAction, clearIdeasAction } from "@/app/(app)/brand/actions";
import { removeUploadedLogoAction } from "@/app/(app)/logo/actions";
import { ActionButton } from "@/components/action-button";
import { AlreadyHave } from "@/components/already-have";
import { Completed, Revisit } from "@/components/completed";
import { ChosenLogo } from "@/components/brand/chosen-logo";
import { IdeasSection } from "@/components/brand/ideas";
import { KitSection } from "@/components/brand/kit";
import { LogoChoices } from "@/components/brand/logo-choices";
import { LogoColors } from "@/components/brand/logo-colors";
import { LogoUpload } from "@/components/brand/logo-upload";
import { BrandNotes } from "@/components/brand/notes";
import { VersionSlots } from "@/components/brand/slots";
import { RunNotice } from "@/components/documents/run-notice";
import { Icon } from "@/components/icons";
import { Kicker, SectionHead } from "@/components/marketing/pieces";
import { PracticeBanner } from "@/components/practice-banner";
import { PRIMARY_LINK, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, Note, PageHead } from "@/components/ui";
import { getImageModel } from "@/lib/ai";
import { briefDefaults } from "@/lib/brand/brief";
import { brandFileUrl } from "@/lib/brand/files";
import { type OwnLogo, ownLogos } from "@/lib/brand/lineage";
import { LOGO_SPECS } from "@/lib/brand/sizes";
import { type BrandBrief, VERSION_KINDS } from "@/lib/brand/types";
import type { AssetSummary, BrandState } from "@/lib/data/brand";
import { getMyBrand, getMyBrandState, getMyBusiness, lastMyRun, listMyDocuments, listMyJourneyMarks } from "@/lib/data/my-business";
import { MAX_UPLOAD_BYTES } from "@/lib/documents/upload";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/logo");
// Ideas, edits and versions each wait on AI calls
export const maxDuration = 300;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function LogoPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex max-w-[1000px] flex-col gap-8">
      <PageHead
        kicker={<Kicker icon="sparkles">Build your brand · Step 2</Kicker>}
        title="Create your logo"
        lead="Logo ideas are drawn from the brand description you approved in step 1 and a few choices about the logo itself. Already have a logo? Upload it instead. Nothing is used until you choose it."
      />
      <Suspense fallback={<p className="text-muted">Loading your logo…</p>}>
        <Logo searchParams={searchParams} />
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

async function Logo({ searchParams }: { searchParams: SearchParams }) {
  const [params, business, state, marks] = await Promise.all([searchParams, getMyBusiness(), getMyBrandState(), listMyJourneyMarks()]);
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
  const chosen = state.assets.find((asset) => asset.id === state.chosenLogoId && asset.kind === "logo") ?? null;
  const brief = briefDefaults(business.profile, state.brief);
  const banner = practice ? <PracticeBanner what="Logo ideas here are placeholders and every logo is a plain text preview, not made by Muse." /> : null;

  if (chosen && params.ideas !== "new") {
    return (
      <>
        {banner}
        <ChosenView chosen={chosen} state={state} brief={brief} practice={practice} />
      </>
    );
  }

  const latestRound = state.rounds[0] ?? null;
  const [ideasRun, drawRun] = await Promise.all([lastMyRun("brand_ideas", null), latestRound ? lastMyRun("brand_draw", latestRound.id) : null]);
  const storyReady = Boolean(brief.story.trim() && brief.storyApproved);
  const blocked = !storyReady
    ? "Approve your brand description in step 1 first. Your logo ideas are drawn from it."
    : !image?.generate
      ? "Logo drawing isn’t turned on for SnapStart yet."
      : ideasRun?.status === "running"
        ? "Logo ideas are being written right now. This page will update when they’re ready."
        : null;
  const mark = marks.find((each) => each.key === "logo") ?? null;

  const alreadyHave = (
    <AlreadyHave
      markKey="logo"
      label="I already have a logo"
      help="Upload your logo, and SnapStart uses it for your logo versions, brand images and website. Or just mark this step done if you’d rather keep your logo files elsewhere."
      done={mark ? { url: mark.url, note: mark.note } : null}
    >
      <LogoUpload businessName={brief.name} maxBytes={MAX_UPLOAD_BYTES} replacing={false} />
      <OwnLogoList logos={ownLogos(state.assets, null)} hasPicks={false} titled />
    </AlreadyHave>
  );
  const making = (
    <>
      <BrandDescription brief={brief} ready={storyReady} />

      <RunNotice run={ideasRun} what="Writing logo ideas" />
      <LogoChoices
        number={2}
        initial={{ name: brief.name, tagline: brief.tagline, logoKinds: brief.logoKinds, symbolIdea: brief.symbolIdea, logoLikes: brief.logoLikes }}
        practice={practice}
        blocked={blocked}
        hasIdeas={state.rounds.length > 0}
      />

      {state.rounds.length ? (
        <div className="flex flex-col gap-3">
          <RunNotice run={drawRun} what="Drawing your logos" />
          <IdeasSection
            number={3}
            rounds={state.rounds}
            assets={state.assets}
            chosenLogoId={chosen?.id ?? null}
            practice={practice}
            drawing={new Set(drawRun?.status === "running" && latestRound ? [latestRound.id] : [])}
            ownerTagline={brief.tagline}
            pickedFamilies={brief.colors}
          />
          {state.rounds.length > 1 ? (
            <ActionButton
              action={clearIdeasAction}
              label={chosen?.origin === "generated" && chosen.conceptId ? "Remove the ideas I didn’t choose" : "Remove all ideas"}
              pendingLabel="Removing…"
              variant="danger"
              confirm={
                chosen?.origin === "generated" && chosen.conceptId
                  ? "Remove every round of ideas except the one with your chosen logo? This can’t be undone."
                  : "Remove all your logo ideas? This can’t be undone."
              }
            />
          ) : null}
        </div>
      ) : null}
    </>
  );

  // Marked "I already have a logo" without one chosen here: that's the decision, and making one here waits behind Revisit
  if (mark && !chosen && params.ideas !== "new") {
    return (
      <>
        {banner}
        <Completed eyebrow="Your logo" title="You already have a logo">
          {alreadyHave}
        </Completed>
        <Revisit label="Revisit this step" summary="Make logo ideas here after all, or upload your logo so SnapStart can use it.">
          {making}
        </Revisit>
      </>
    );
  }

  return (
    <>
      {banner}
      {chosen ? (
        <Note icon="info" tone="quiet">
          <p className="text-rule">
            You’re making new logo ideas. Your current logo stays in use until you choose a different one.{" "}
            <Link href="/logo" className={TEXT_LINK}>
              Back to my logo
            </Link>
          </p>
        </Note>
      ) : null}

      {chosen ? null : alreadyHave}

      {making}
    </>
  );
}

// Step 1's approved description, read-only here; it guides every idea
function BrandDescription({ brief, ready }: { brief: BrandBrief; ready: boolean }) {
  return (
    <section aria-labelledby="brand-description-heading" className="flex flex-col gap-4">
      <SectionHead id="brand-description-heading" number={1} title="Your brand" lead="From Build your brand. Every logo idea is drawn to fit it." />
      <Card bodyClassName="gap-3">
        {ready ? (
          <>
            <blockquote className="border-l-[3px] border-accent-ring py-1 pl-4 font-display text-[21px] leading-snug sm:text-[22px]">{brief.story}</blockquote>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-2">
                You approved this description.
              </span>
              {brief.vibes.length ? <span>Feel: {brief.vibes.join(", ")}</span> : null}
              <Link href="/brand" className={`${TEXT_LINK} inline-flex min-h-11 items-center`}>
                Change<span className="sr-only"> your brand description</span>
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-rule">
              {brief.story.trim()
                ? "Your brand description isn’t approved yet. Approve it, or change it, in step 1, and your logo ideas are drawn from it."
                : "You haven’t described your brand yet. Pick a few words for how your business should feel in step 1, and approve the description. Your logo ideas are drawn from it."}
            </p>
            <Link href="/brand" className={SECONDARY_LINK}>
              Go to step 1: Build your brand
              <Icon name="arrow" size="sm" />
            </Link>
          </div>
        )}
      </Card>
    </section>
  );
}

async function ChosenView({ chosen, state, brief, practice }: { chosen: AssetSummary; state: BrandState; brief: BrandBrief; practice: boolean }) {
  const [runs, kit, documents] = await Promise.all([
    Promise.all(VERSION_KINDS.map((kind) => lastMyRun("brand_versions", `${chosen.id}:${kind}`))),
    getMyBrand(),
    listMyDocuments(),
  ]);
  const running = new Set(VERSION_KINDS.filter((_, index) => runs[index]?.status === "running"));
  const guideId = documents.find((doc) => doc.generatedKind === "logo_guide")?.id ?? null;
  const edits = state.assets.filter((asset) => asset.kind === "logo" && asset.sourceId === chosen.id).reverse();
  const before = chosen.sourceId ? (state.assets.find((asset) => asset.id === chosen.sourceId && asset.kind === "logo") ?? null) : null;
  const own = chosen.conceptId === null;
  const name = kit?.businessName ?? brief.name;
  // Edits and the logo before them are in the chosen logo's card already
  const others = ownLogos(state.assets, chosen.id, new Set([...edits.map((edit) => edit.id), ...(before ? [before.id] : [])]));
  const hasPicks = Object.keys(state.picks).length > 0;

  return (
    <>
      <ChosenLogo
        key={chosen.id}
        chosen={chosen}
        edits={edits}
        before={before}
        hasPicks={hasPicks}
        practice={practice}
        businessName={brief.name}
        maxBytes={MAX_UPLOAD_BYTES}
      />

      <section aria-labelledby="versions-heading" className="@container flex flex-col gap-4">
        <SectionHead
          id="versions-heading"
          number={1}
          title="Your logo versions"
          lead={
            practice
              ? "Choose + to make each version from your logo. In practice mode each one is a plain labeled preview. Nothing is used until you choose “Use this”."
              : "Choose + to make each version from your logo. Muse starts from the logo itself so the design stays the same, and AI compares each one with it. Nothing is used until you choose “Use this”."
          }
        />
        {VERSION_KINDS.map((kind, index) => (
          <RunNotice key={kind} run={runs[index]?.status === "failed" ? runs[index] : null} what={`Making the ${LOGO_SPECS[kind].title.toLowerCase()} version`} />
        ))}
        <VersionSlots key={chosen.id} chosenId={chosen.id} name={name} assets={state.assets} picks={state.picks} practice={practice} running={running} />
      </section>

      {own ? (
        <section aria-labelledby="own-logo-heading" className="flex flex-col gap-4">
          <Card title="Your logo’s colors" icon="palette" id="own-logo-heading">
            <LogoColors key={chosen.id} assetId={chosen.id} src={brandFileUrl(chosen.id)} saved={chosen.design?.palette ?? []} />
          </Card>
          <Note icon="info" tone="quiet">
            <p className="font-semibold text-rule">What works differently with a logo you uploaded</p>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
              <li>SnapStart never changes your file. Edits, versions and pictures are new files made from it.</li>
              <li>Quick changes, like new colors or lettering in one click, are only for logos drawn here. “Edit my logo” works on yours: say what to change.</li>
              <li>SnapStart doesn’t know your logo’s lettering, so the logo guide doesn’t suggest matching fonts.</li>
              {chosen.mimeType === "image/webp" ? <li>The logo guide can’t hold a WebP picture, so it points to your logo file instead. Upload a PNG to have it in the guide.</li> : null}
            </ul>
          </Note>
        </section>
      ) : null}

      {kit ? <KitSection kit={kit} guideId={guideId} number={2} /> : null}

      {others.length ? (
        <Card title="Your other logos" icon="clock" id="other-logos-heading">
          <OwnLogoList logos={others} hasPicks={hasPicks} />
        </Card>
      ) : null}
    </>
  );
}

// The owner's uploads and their edits, to use again or remove
function OwnLogoList({ logos, hasPicks, titled = false }: { logos: OwnLogo<AssetSummary>[]; hasPicks: boolean; titled?: boolean }) {
  if (!logos.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {titled ? <p className="font-semibold">Your uploaded logos and edits</p> : null}
      <ul className="flex flex-col gap-2">
        {logos.map(({ file, depth, holdsChosen }) => (
          <li
            key={file.id}
            style={{ marginLeft: `${Math.min(depth, 3) * 1.25}rem` }}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-2.5 shadow-soft"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brandFileUrl(file.id)} alt="" width={file.width} height={file.height} className="h-12 w-auto max-w-24 rounded border border-line bg-white object-contain" />
            <span className="min-w-0 flex-1 text-[15px] break-words">
              {depth ? `Edit: “${file.change ?? ""}”` : (file.title ?? "Uploaded logo")}
              {file.simulated ? <span className="block text-sm text-muted">Practice preview</span> : null}
            </span>
            <ActionButton
              action={chooseLogoAction.bind(null, file.id)}
              label="Use this logo"
              pendingLabel="Choosing…"
              confirm={hasPicks ? "Use this logo instead? Versions and brand images made from your current logo will be cleared from your brand kit." : undefined}
            />
            <ActionButton
              action={removeUploadedLogoAction.bind(null, file.id)}
              label="Remove"
              pendingLabel="Removing…"
              variant="danger"
              confirm={
                holdsChosen
                  ? "The logo you’re using now was made from this one, so removing it also removes the logo you’re using, with every edit, version and picture made from them. This can’t be undone."
                  : `Remove this ${depth ? "edited " : "uploaded "}logo, with the edits and pictures made from it? This can’t be undone.`
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
