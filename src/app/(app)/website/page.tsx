import Link from "next/link";
import { Suspense } from "react";
import { draftWebsiteAction, startWebsiteCopyAction } from "@/app/(app)/website/actions";
import { findMoreOptionsAction } from "@/app/(app)/website/option-actions";
import { ActionButton } from "@/components/action-button";
import { Completed, Revisit } from "@/components/completed";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { Kicker, NextUp, SectionHead } from "@/components/marketing/pieces";
import { MoveOn } from "@/components/move-on";
import { PracticeBanner } from "@/components/practice-banner";
import { RunStatus } from "@/components/run-status";
import { PRIMARY_LINK } from "@/components/styles";
import { Card, Chip, Fold, Note, OutsideLink, PageHead } from "@/components/ui";
import { WebsiteBasics } from "@/components/website/basics";
import { CopyEditor } from "@/components/website/copy-editor";
import { DomainFinder } from "@/components/website/domain-finder";
import { ExistingSitePanel } from "@/components/website/existing-site";
import { MoreOptionsList } from "@/components/website/more-options";
import { PlatformCard } from "@/components/website/platform-card";
import { type ChecklistStep, SetupChecklist } from "@/components/website/setup-checklist";
import { type FinishPanel, type LibraryChoice, SiteStudio } from "@/components/website/site-studio";
import { PLATFORM_DATA, PLATFORM_ORDER } from "@/data/website-platforms";
import { getModel } from "@/lib/ai";
import type { BrandFile } from "@/lib/brand/types";
import { getMyBusiness, lastMyRun, listMyJourneyMarks } from "@/lib/data/my-business";
import { CUT_OFF_MESSAGE } from "@/lib/data/workflow-runs";
import { sectionMetadata } from "@/lib/sections";
import { copyOf, placeholderCount } from "@/lib/website/content";
import { domainIdeas } from "@/lib/website/domains";
import { packageShare } from "@/lib/website/budget";
import { claimConflicts } from "@/lib/website/claims";
import { handoffWords } from "@/lib/website/content";
import { costSummary, firstYearText, usd } from "@/lib/website/costs";
import { foundFacts, isCurrentExplanation, platformFacts } from "@/lib/website/options";
import { type PasteContext, pasteFor } from "@/lib/website/paste";
import { recommendPlatform } from "@/lib/website/recommend";
import { publishReadiness } from "@/lib/website/site/ready";
import type { PlatformId } from "@/lib/website/types";
import { type LoadedSite, loadSite, publishCheck, siteSignature } from "./site-data";
import { claimRecords, shownSite } from "@/lib/website/site/check";

export const metadata = sectionMetadata("/website");
// Drafting the site's words waits on an AI call
export const maxDuration = 300;

export default function WebsitePage() {
  return (
    <div className="flex max-w-[1000px] flex-col gap-8 wrap-break-word">
      <PageHead
        kicker={<Kicker icon="globe">Build your brand · Step 3</Kicker>}
        title="Create your website"
        lead="Build your site here, or connect a Square site you already have."
      />
      <MoveOn from="Build your brand" />
      <Suspense fallback={<p className="text-muted">Loading your website plan…</p>}>
        <WebsitePlanView />
      </Suspense>
    </div>
  );
}

const view = (file: BrandFile | null) => (file ? { src: file.url, width: file.width, height: file.height } : null);
// Brand links open in the browser with ?view=1; without it they download
const download = (file: BrandFile | null) => (file ? file.url.replace(/\?view=1$/, "") : null);

async function WebsitePlanView() {
  const [site, run, optionsRun, marks] = await Promise.all([loadSite(), lastMyRun("website_copy", null), lastMyRun("website_options", null), listMyJourneyMarks()]);

  if (!site) {
    const business = await getMyBusiness();
    return (
      <Card title="Tell us about your business first" icon="store" id="first-heading">
        <p className="text-muted">Your answers decide which option fits you best.</p>
        <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
          {business ? "Update your answers" : "Tell us about your business"}
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }

  const { profile, plan, brand, name } = site;
  const suggested = recommendPlatform(profile);
  const recommendation = suggested.platform === "wix" || suggested.platform === "shopify" ? { platform: "square" as const, reasons: [] } : suggested;
  const chosen = plan?.platform ?? null;
  const ideas = domainIdeas(profile.name, profile.location.city);
  const content = site.content;
  const practice = getModel().simulated;
  const explanations = plan?.explanations ?? {};
  const moreExplanations = Object.fromEntries(
    (plan?.moreOptions?.options ?? []).flatMap((option) => {
      const key = `more:${option.name.toLowerCase()}`;
      const explanation = explanations[key];
      return isCurrentExplanation(explanation, profile, foundFacts(option), practice) ? [[key, explanation]] : [];
    }),
  );
  const builtHere = chosen === "first_sale";
  const mark = marks.find((each) => each.key === "website");
  const existing = plan?.existingSite ?? null;
  const records = { products: site.products, design: site.design, handoff: profile.handoff };
  const cards = (
    <div className="@container">
      <div className="grid gap-x-5 gap-y-5 @3xl:grid-cols-2">
        {PLATFORM_ORDER.map((id) => (
          <PlatformCard
            key={id}
            platform={PLATFORM_DATA[id]}
            recommended={id === recommendation.platform ? { reasons: recommendation.reasons } : null}
            chosen={id === chosen}
            share={packageShare(PLATFORM_DATA[id], profile.startupBudget)}
            explanation={
              isCurrentExplanation(explanations[`platform:${id}`], profile, platformFacts(PLATFORM_DATA[id]), practice) ? explanations[`platform:${id}`] : null
            }
          />
        ))}
      </div>
    </div>
  );
  const next = nextStep({
    chosen,
    content: Boolean(content),
    approved: Boolean(plan?.contentApprovedAt),
    finished: Boolean(plan?.finished),
    existing: Boolean(existing || mark),
    recommended: recommendation.platform,
    profile,
    products: site.products.length,
    left: content ? placeholderCount(content) : 0,
    conflicts: content ? claimConflicts(copyOf(content), claimRecords(site)).length : 0,
  });

  const existingPanel = <ExistingSitePanel connected={existing} marked={mark ? { url: mark.url, note: mark.note } : null} />;
  const steps = (
    <>
      <Fold icon="book" title="New to websites? Start here" summary="The five things you’ll need to be online">
        <WebsiteBasics exampleDomain={ideas[0] ?? "yourbusiness.com"} />
      </Fold>

      <section aria-labelledby="step-choose" className="flex flex-col gap-4">
        <SectionHead id="step-choose" number={1} title="Choose a package">
          <p className="text-muted">Two ways to get online. Choose what works for you.</p>
        </SectionHead>
        {chosen ? (
          <>
            <ChosenSummary platformId={chosen} />
            <Fold icon="layers" title="Compare the packages again" summary="Your choice stays until you change it">
              {cards}
            </Fold>
          </>
        ) : (
          cards
        )}
        <Fold open={Boolean(plan?.moreOptions)} icon="search" title="Want to see other options?" summary="SnapStart can search the web for more builders">
          <div className="@container flex flex-col gap-3">
            <p className="text-rule">These four fit most first websites. To compare others, SnapStart can search the web for more builders, with their prices, pros and cons.</p>
            {optionsRun && (optionsRun.status === "running" || optionsRun.message === CUT_OFF_MESSAGE) ? (
              <RunStatus status={optionsRun.status === "running" ? "running" : "failed"} job={{ workflow: "website_options", subjectId: null }} message={null} what="Searching for more options" />
            ) : null}
            <ActionButton
              action={findMoreOptionsAction}
              label={plan?.moreOptions ? "Search again" : "Find more options"}
              pendingLabel="Searching…"
              pendingStatus="Searching the web for other website builders. This can take a minute."
              variant="ai"
            />
            {plan?.moreOptions ? <MoreOptionsList found={plan.moreOptions} explanations={moreExplanations} /> : null}
          </div>
        </Fold>
      </section>

      {chosen ? (
        <>
          <section aria-labelledby="step-address" className="flex flex-col gap-4">
            <SectionHead
              id="step-address"
              number={2}
              title="Pick a web address"
              lead="Choose an address that matches your business. You can decide later."
            />
            <Card>
              <DomainFinder ideas={ideas} checks={plan?.domainChecks ?? []} chosen={plan?.domain ?? null} />
            </Card>
          </section>

          <section aria-labelledby="step-words" className="flex flex-col gap-4">
            <SectionHead id="step-words" number={3} title="Write your pages">
            </SectionHead>
            <Card bodyClassName="gap-4">
              {run && (run.status === "running" || run.message === CUT_OFF_MESSAGE) ? (
                <RunStatus status={run.status === "running" ? "running" : "failed"} job={{ workflow: "website_copy", subjectId: null }} message={null} what="Writing your website" />
              ) : null}
              {content?.simulated ? <PracticeBanner what="These words were drafted in practice mode." /> : null}
              {content && content.platform !== chosen ? (
                <Note>
                  <p role="status">
                    These words were written for {PLATFORM_DATA[content.platform].name}. Draft them again so they fit how customers buy on {PLATFORM_DATA[chosen].name}.
                  </p>
                </Note>
              ) : null}
              {!content ? <ActionButton action={startWebsiteCopyAction} label="Write my own words" pendingLabel="Opening editor…" /> : null}
              <ActionButton
                action={draftWebsiteAction}
                label={content ? "Draft my website again" : "Draft my website"}
                pendingLabel="Writing your website…"
                pendingStatus="Writing the words for each page from your answers. This can take a minute."
                variant="ai"
                confirm={content ? "This replaces your current words, including your edits. Draft again?" : undefined}
              />
              {content && plan?.contentApprovedAt ? (
                <Fold icon="pencil" title="Your words are approved" summary="Open to read or change them">
                  <CopyEditor copy={copyOf(content)} flags={content.flags} approved signature={content.generatedAt} records={records} />
                </Fold>
              ) : content ? (
                <CopyEditor copy={copyOf(content)} flags={content.flags} approved={false} signature={content.generatedAt} records={records} />
              ) : null}
            </Card>
          </section>

          {builtHere ? (
            content ? (
              <>
                {content.simulated ? <PracticeBanner what="This site uses words drafted in practice mode." /> : null}
                <SiteStudio
                  name={name}
                  draftedAt={content.generatedAt}
                  copy={copyOf(content)}
                  saved={site.design}
                  images={{ logo: view(brand?.logos.primary ?? null), hero: view(brand?.images.websiteHero ?? null), favicon: view(brand?.logos.profile ?? null) }}
                  library={site.library.map(
                    (photo): LibraryChoice => ({
                      versionId: photo.id,
                      photoId: photo.photoId,
                      title: photo.title,
                      src: photo.src,
                      width: photo.width,
                      height: photo.height,
                      simulated: photo.simulated,
                    }),
                  )}
                  brandColors={brand?.colors ?? []}
                  products={site.products}
                  contact={site.contact}
                  year={site.year}
                  domain={plan?.domain ?? null}
                  practiceBrand={site.brandPractice.logo || site.brandPractice.hero || site.brandPractice.icon}
                  stepNumber={4}
                  finish={finishPanel(site)}
                  after={<BuildSteps site={site} platformId="first_sale" />}
                />
              </>
            ) : (
              <section aria-labelledby="step-design" className="flex flex-col gap-4">
                <SectionHead id="step-design" number={4} title="Design it and see it live" />
                <Card>
                  <p className="text-muted">Draft your pages in step 3, and SnapStart builds a live preview of your site here for you to change.</p>
                </Card>
              </section>
            )
          ) : (
            <BuildSteps site={site} platformId={chosen} />
          )}
        </>
      ) : null}
    </>
  );

  // Finished, or already has a site: that leads, and every step waits behind Revisit
  if (next.done) {
    const builtDemo = chosen === "first_sale" && Boolean(plan?.finished);
    return (
      <>
        <Completed
          eyebrow="Your website"
          title={builtDemo ? "Your website is ready" : "You already have a website"}
          lines={[
            ...(chosen ? [{ label: "Package", value: PLATFORM_DATA[chosen].name }] : []),
            ...(plan?.domain ? [{ label: "Web address", value: plan.domain }] : []),
          ]}
        >
          {builtDemo ? <p className="text-[15px] text-rule">Your site is ready to preview. It is not published online.</p> : null}
          {builtDemo ? null : existingPanel}
        </Completed>
        <Revisit label="Revisit your website" summary="Compare packages, change your words or design, or build a site here.">
          {builtDemo ? existingPanel : null}
          {steps}
        </Revisit>
      </>
    );
  }

  return (
    <>
      <NextUp id="next-heading" icon="arrow" kicker="Up next" title={next.title}>
        {next.href ? (
          <a href={next.href} className={`${PRIMARY_LINK} w-fit`}>
            {next.button}
            <Icon name="arrow" size="sm" />
          </a>
        ) : null}
      </NextUp>

      <ExistingSitePanel connected={existing} marked={mark ? { url: mark.url, note: mark.note } : null} />


      {steps}
    </>
  );
}

interface NextState {
  chosen: PlatformId | null;
  content: boolean;
  approved: boolean;
  finished: boolean;
  existing: boolean;
  recommended: PlatformId;
  profile: LoadedSite["profile"];
  products: number;
  // [bracketed] notes and price or ordering conflicts left in the words
  left: number;
  conflicts: number;
}

interface NextAction {
  title: string;
  why: string;
  cost: string;
  needs: string;
  button: string;
  href: string | null;
  done: boolean;
}

const INCLUDED = "Nothing extra: it’s part of SnapStart.";

// The one thing to do next on this page, by plain rules that match the step's done rule
function nextStep(state: NextState): NextAction {
  const plain = { why: "", cost: "", needs: "", button: "", href: null };
  if (state.chosen === "first_sale" && state.finished) return { ...plain, title: "Your site is ready to preview", done: true };
  if (state.existing) return { ...plain, title: "You already have a website", done: true };
  if (!state.chosen) {
    const platform = PLATFORM_DATA[state.recommended];
    const costs = costSummary(platform);
    const share = packageShare(platform, state.profile.startupBudget);
    return {
      title: "Choose where to build your site",
      why: "Where you build decides your monthly bill and how customers order and pay.",
      cost: `We recommend ${platform.name}: ${costs.from ? "from " : ""}${usd(costs.firstYearUsd)}${platform.demoPrice ? " (demo price)" : ""} for the first year.${share ? ` ${share.text}` : ""} A $0 way to test demand is under Your budget.`,
      needs: "Nothing new: your answers already shape the recommendation.",
      button: "Compare the packages",
      href: "#step-choose",
      done: false,
    };
  }
  const name = PLATFORM_DATA[state.chosen].name;
  if (!state.content) {
    const ways = handoffWords(state.profile.handoff);
    return {
      title: "Draft the words for your pages",
      why: "Customers need to see what you sell, your prices, and how to get their order.",
      cost: INCLUDED,
      needs: `${state.products ? `Your ${state.products} saved ${state.products === 1 ? "product" : "products"} and prices` : "Your products and prices (add them on Products so the words use them)"}${ways.length ? `, and how customers get orders: ${ways.join(", ").toLowerCase()}` : ""}.`,
      button: "Go to your pages",
      href: "#step-words",
      done: false,
    };
  }
  if (!state.approved) {
    const todo = [
      state.conflicts ? `settle ${state.conflicts} price or ordering ${state.conflicts === 1 ? "claim" : "claims"} that ${state.conflicts === 1 ? "disagrees" : "disagree"} with your saved facts` : "",
      state.left ? `fill in ${state.left} [bracketed] ${state.left === 1 ? "note" : "notes"}` : "",
    ].filter(Boolean);
    return {
      title: "Check and approve your words",
      why: "Approved words go on your site, and a printable copy is saved to Documents.",
      cost: INCLUDED,
      needs: todo.length ? `A few minutes to ${todo.join(" and ")}.` : "A few minutes to read them through.",
      button: "Review your words",
      href: "#step-words",
      done: false,
    };
  }
  if (state.chosen === "first_sale") {
    return {
      title: "Design your site, then finish it",
      why: "You see your site live and choose its look, photos, prices and buy links.",
      cost: firstYearText(PLATFORM_DATA.first_sale),
      needs: "Your approved words. Your logo and photos are optional.",
      button: "Open the design step",
      href: "#step-design",
      done: false,
    };
  }
  return {
    title: `Build your site on ${name}`,
    why: "Your words, colors, logo and items are ready to paste, so setup goes quickly.",
    cost: firstYearText(PLATFORM_DATA[state.chosen]),
    needs: `A ${name} account you create yourself. SnapStart can’t sign in or pay for you.`,
    button: "Open the build steps",
    href: "#step-build",
    done: false,
  };
}

// The package the owner picked, in one line, so the comparison can fold away
function ChosenSummary({ platformId }: { platformId: PlatformId }) {
  const platform = PLATFORM_DATA[platformId];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] border border-accent bg-surface px-5 py-4 shadow-[0_0_0_3px_var(--color-accent-tint),var(--shadow-card)]">
      <Chip tone="done" icon="check">
        Your choice
      </Chip>
      <p className="font-display text-[22px] leading-tight">{platform.name}</p>
      <p className="text-muted">{platformId === "first_sale" ? "Design and preview your site here." : "Set up your site in Square, then connect it here."}</p>
    </div>
  );
}

function finishPanel(site: LoadedSite): FinishPanel {
  const readiness = publishReadiness(publishCheck(site));
  const signature = siteSignature(site);
  const finished = site.plan?.finished ?? null;
  return {
    signature,
    blockers: readiness.blockers,
    notes: readiness.notes,
    finished: finished ? { at: finished.at, upToDate: finished.signature === signature } : null,
  };
}

function BuildSteps({ site, platformId }: { site: LoadedSite; platformId: PlatformId }) {
  const platform = PLATFORM_DATA[platformId];
  const { plan, brand } = site;
  // Saved products join the items to paste
  const shown = shownSite(site);
  const context: PasteContext = {
    name: site.name,
    copy: shown.content ? copyOf(shown.content) : null,
    design: shown.design,
    brand: brand
      ? {
          colors: brand.colors,
          logo: download(brand.logos.primary),
          icon: download(brand.logos.profile),
          practice: { logo: site.brandPractice.logo, icon: site.brandPractice.icon },
        }
      : null,
    photos: Object.fromEntries(site.library.map((photo) => [photo.id, { href: photo.src, practice: photo.simulated }])),
    domain: plan?.domain ?? null,
    domainSetup: platform.domainSetup,
  };
  // Ticks from another platform's steps don't count here
  const done = (plan?.setupDone ?? []).filter((key) => platform.setupSteps.some((step) => step.key === key));
  const steps: ChecklistStep[] = platform.setupSteps.map((step) => ({
    ...step,
    // Design shows up once there are words
    inApp: !site.content && step.inApp?.href.endsWith("#step-design") ? { label: "Draft and approve your words first", href: "/website#step-words" } : step.inApp,
    paste: pasteFor(step.paste, context),
  }));
  const checked = (
    <p className="text-sm text-muted">
      Menus and buttons as {platformId === "first_sale" ? "Stripe and Square" : platform.name} name them in their help, checked{" "}
      <LocalDate iso={`${platform.stepsCheckedOn}T12:00:00Z`} />. If something has moved, each step’s help link has the latest.
    </p>
  );

  if (platformId === "first_sale") {
    return (
      <Fold icon="card" title="Optional: take card payments with Buy buttons" summary="Make a Stripe or Square payment link for each item">
        <p className="text-rule">
          A payment provider takes the card payment, keeps a small fee and pays the rest into your bank account. Make a link for each item, then paste it into that item’s Buy link in step 4.
        </p>
        <SetupChecklist steps={steps} done={done} />
        {checked}
      </Fold>
    );
  }

  const left = site.content ? placeholderCount(site.content) : 0;
  return (
    <section aria-labelledby="step-build" className="flex flex-col gap-4">
      <SectionHead
        id="step-build"
        number={4}
        title={`Build it on ${platform.name}`}
        lead={`You set up the site yourself on ${platform.name}; SnapStart can’t sign in or pay for you. Each step says where to click, links to that page on ${platform.name}, and has your own words, colors, logo and item details ready to paste.`}
      />
      <Card bodyClassName="gap-4">
        {platform.signupUrl ? (
          <OutsideLink href={platform.signupUrl}>Open {platform.name}</OutsideLink>
        ) : null}
        {left ? (
          <Note>
            {left} [bracketed] {left === 1 ? "note is" : "notes are"} still in your words. Fill them in in step 3 before you paste.
          </Note>
        ) : null}
        {!site.content ? <p className="text-muted">Draft your pages in step 3, and your words will show up in these steps ready to copy.</p> : null}
        <SetupChecklist steps={steps} done={done} />
        {checked}
      </Card>
    </section>
  );
}
