import Link from "next/link";
import { Suspense } from "react";
import { draftWebsiteAction } from "@/app/(app)/website/actions";
import { findMoreOptionsAction } from "@/app/(app)/website/option-actions";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { Kicker, SectionHead } from "@/components/marketing/pieces";
import { PracticeBanner } from "@/components/practice-banner";
import { RunStatus } from "@/components/run-status";
import { PRIMARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, Fold, Note, PageHead } from "@/components/ui";
import { WebsiteBasics } from "@/components/website/basics";
import { CopyEditor } from "@/components/website/copy-editor";
import { DomainFinder } from "@/components/website/domain-finder";
import { MoreOptionsList } from "@/components/website/more-options";
import { PlatformCard } from "@/components/website/platform-card";
import { type ChecklistStep, SetupChecklist } from "@/components/website/setup-checklist";
import { type LibraryChoice, type PublishPanel, SiteStudio } from "@/components/website/site-studio";
import { PLATFORM_DATA, PLATFORM_ORDER } from "@/data/website-platforms";
import { getModel } from "@/lib/ai";
import type { BrandFile } from "@/lib/brand/types";
import { getMyBusiness, lastMyRun } from "@/lib/data/my-business";
import { CUT_OFF_MESSAGE } from "@/lib/data/workflow-runs";
import { sectionMetadata } from "@/lib/sections";
import { copyOf, placeholderCount } from "@/lib/website/content";
import { domainIdeas } from "@/lib/website/domains";
import { netlifyApp } from "@/lib/website/hosting";
import { isCurrentExplanation, platformFacts } from "@/lib/website/options";
import { type PasteContext, pasteFor } from "@/lib/website/paste";
import { recommendPlatform } from "@/lib/website/recommend";
import { publishReadiness } from "@/lib/website/site/ready";
import type { PlatformId } from "@/lib/website/types";
import { type LoadedSite, loadSite, publishCheck, siteSignature } from "./site-data";

export const metadata = sectionMetadata("/website");
// Drafting the site's words waits on an AI call
export const maxDuration = 300;

export default function WebsitePage({ searchParams }: PageProps<"/website">) {
  return (
    <div className="flex max-w-[1000px] flex-col gap-8 wrap-break-word">
      <PageHead
        kicker={<Kicker icon="globe">Marketing and branding</Kicker>}
        title="Your website"
        lead="First Sale can build your site here from your words, brand and items, show it to you live, and publish it when you say so. Or pick Square, Wix or Shopify, and follow click-by-click steps with everything ready to paste."
      />
      <Suspense fallback={<p className="text-muted">Loading your website plan…</p>}>
        <WebsitePlanView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const view = (file: BrandFile | null) => (file ? { src: file.url, width: file.width, height: file.height } : null);
// Brand links open in the browser with ?view=1; without it they download
const download = (file: BrandFile | null) => (file ? file.url.replace(/\?view=1$/, "") : null);
const photoUrl = (photoId: string, versionId: string, inline: boolean) => `/photos/${photoId}/versions/${versionId}/file${inline ? "?view=1" : ""}`;

async function WebsitePlanView({ searchParams }: { searchParams: PageProps<"/website">["searchParams"] }) {
  const [site, run, optionsRun, params] = await Promise.all([loadSite(), lastMyRun("website_copy", null), lastMyRun("website_options", null), searchParams]);

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
  const recommendation = recommendPlatform(profile);
  const chosen = plan?.platform ?? null;
  const ideas = domainIdeas(profile.name, profile.location.city);
  const content = site.content;
  const practice = getModel().simulated;
  const explanations = plan?.explanations ?? {};
  const moreExplanations = Object.fromEntries(
    (plan?.moreOptions?.options ?? []).flatMap((option) => {
      const key = `more:${option.name.toLowerCase()}`;
      const explanation = explanations[key];
      return isCurrentExplanation(explanation, profile, option, practice) ? [[key, explanation]] : [];
    }),
  );
  const builtHere = chosen === "first_sale";
  const steps = { design: 4, build: content ? (builtHere ? 6 : 5) : 4 };
  const returned = typeof params.netlify === "string" ? params.netlify : null;

  return (
    <>
      <Fold open={!chosen} icon="book" title="New to websites? Start here" summary="Four words to know before you pick">
        <WebsiteBasics exampleDomain={ideas[0] ?? "yourbusiness.com"} />
      </Fold>

      <section aria-labelledby="step-choose" className="@container flex flex-col gap-4">
        <SectionHead id="step-choose" number={1} title="Choose how to build it" />
        <div className="flex flex-col gap-3 rounded-2xl border border-accent-ring bg-surface p-5 shadow-[0_0_0_4px_var(--color-accent-tint),var(--shadow-card)] sm:p-6">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-accent-ring bg-accent-tint text-accent">
              <Icon name="sparkles" />
            </span>
            <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">Suggested for {name}</p>
            <ActorChip actor="rule" />
          </div>
          <p className="font-display text-[22px] leading-snug">{PLATFORM_DATA[recommendation.platform].name}</p>
          <ul className="flex flex-col gap-1.5">
            {recommendation.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-accent-ring bg-accent-tint text-accent">
                  <Icon name="check" size="xs" strokeWidth={2.6} />
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            This comes from your answers about what you sell and how. You can pick any option.{" "}
            <Link href="/business/edit" className={TEXT_LINK}>
              Change your answers
            </Link>
          </p>
        </div>
        <div className="grid gap-5 @3xl:grid-cols-2">
          {PLATFORM_ORDER.map((id) => (
            <PlatformCard
              key={id}
              platform={PLATFORM_DATA[id]}
              recommended={id === recommendation.platform}
              chosen={id === chosen}
              explanation={
                isCurrentExplanation(explanations[`platform:${id}`], profile, platformFacts(PLATFORM_DATA[id]), practice)
                  ? explanations[`platform:${id}`]
                  : null
              }
            />
          ))}
        </div>
        <Card title="Want to see other options?" icon="search" id="more-options-heading" headingLevel={3}>
          <p className="text-rule">
            These fit most first websites. To compare others, First Sale can search the web for more builders, with their prices, pros and cons.
          </p>
          {optionsRun && (optionsRun.status === "running" || optionsRun.message === CUT_OFF_MESSAGE) ? (
            <RunStatus status={optionsRun.status === "running" ? "running" : "failed"} message={null} what="Searching for more options" />
          ) : null}
          <ActionButton
            action={findMoreOptionsAction}
            label={plan?.moreOptions ? "Search again" : "Find more options"}
            pendingLabel="Searching…"
            pendingStatus="Searching the web for other website builders. This can take a minute."
            variant="ai"
          />
          {plan?.moreOptions ? <MoreOptionsList found={plan.moreOptions} explanations={moreExplanations} /> : null}
        </Card>
      </section>

      <section aria-labelledby="step-address" className="flex flex-col gap-4">
        <SectionHead
          id="step-address"
          number={2}
          title="Pick a web address"
          lead={`Your web address is how people find you, so pick one that’s short and matches your business name. ${
            builtHere ? "It’s optional: your site works on a free netlify.app address, and you can add your own later." : "You’ll buy it when you set up your site."
          }`}
        />
        <Card>
          <DomainFinder ideas={ideas} checks={plan?.domainChecks ?? []} chosen={plan?.domain ?? null} />
        </Card>
      </section>

      <section aria-labelledby="step-words" className="flex flex-col gap-4">
        <SectionHead id="step-words" number={3} title="Write your pages">
          <ul aria-label="Who does what" className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm text-muted">
            <li className="flex items-center gap-2">
              {content?.simulated ? <ActorChip actor="rule" /> : <ActorChip actor="ai" />}
              {content?.simulated ? "drafts in practice mode, from a template" : "drafts from your answers, without making up facts"}
            </li>
            <li className="flex items-center gap-2">
              <ActorChip actor="owner" /> edit and approve every word
            </li>
          </ul>
        </SectionHead>
        <Card bodyClassName="gap-4">
          {run && (run.status === "running" || run.message === CUT_OFF_MESSAGE) ? (
            <RunStatus status={run.status === "running" ? "running" : "failed"} message={null} what="Writing your website" />
          ) : null}
          {!chosen ? (
            <p className="text-muted">Choose how you’ll build your site in step 1 first, so the words fit how customers will buy.</p>
          ) : (
            <>
              {content?.simulated ? <PracticeBanner what="These words were drafted in practice mode." /> : null}
              {content && content.platform !== chosen ? (
                <Note>
                  <p role="status">
                    These words were written for {PLATFORM_DATA[content.platform].name}. Draft them again so they fit how customers buy on {PLATFORM_DATA[chosen].name}.
                  </p>
                </Note>
              ) : null}
              <ActionButton
                action={draftWebsiteAction}
                label={content ? "Draft my website again" : "Draft my website"}
                pendingLabel="Writing your website…"
                pendingStatus="Writing the words for each page from your answers. This can take a minute."
                variant="ai"
                confirm={content ? "This replaces your current words, including your edits. Draft again?" : undefined}
              />
              {content ? (
                <CopyEditor copy={copyOf(content)} flags={content.flags} approved={Boolean(plan?.contentApprovedAt)} signature={content.generatedAt} />
              ) : null}
            </>
          )}
        </Card>
      </section>

      {content && chosen ? (
        <>
          {content.simulated ? <PracticeBanner what="This site uses words drafted in practice mode." /> : null}
          <SiteStudio
            name={name}
            copy={copyOf(content)}
            saved={site.design}
            images={{ logo: view(brand?.logos.primary ?? null), hero: view(brand?.images.websiteHero ?? null), favicon: view(brand?.logos.profile ?? null) }}
            library={site.library.map(
              (photo): LibraryChoice => ({
                versionId: photo.id,
                photoId: photo.photoId,
                title: photo.title,
                src: photoUrl(photo.photoId, photo.id, true),
                width: photo.width,
                height: photo.height,
                simulated: photo.simulated,
              }),
            )}
            brandColors={brand?.colors ?? []}
            contact={site.contact}
            year={site.year}
            domain={plan?.domain ?? null}
            practiceBrand={site.brandPractice.logo || site.brandPractice.hero || site.brandPractice.icon}
            stepNumber={steps.design}
            publish={builtHere ? publishPanel(site, returned) : null}
            publishHelp={builtHere ? <DoItYourself open={!netlifyApp()} /> : undefined}
          />
        </>
      ) : null}

      {chosen ? <BuildSteps site={site} platformId={chosen} number={steps.build} /> : null}
    </>
  );
}

function publishPanel(site: LoadedSite, returned: string | null): PublishPanel {
  const connected = Boolean(site.plan?.hostConnected);
  const readiness = publishReadiness(publishCheck(site));
  const signature = siteSignature(site);
  const hosting = site.plan?.hosting ?? null;
  return {
    signature,
    blockers: readiness.blockers,
    notes: readiness.notes,
    configured: Boolean(netlifyApp()),
    connected,
    returned,
    hosting: hosting
      ? {
          url: hosting.url,
          adminUrl: hosting.adminUrl,
          simulated: hosting.simulated,
          state: hosting.state,
          publishedAt: hosting.publishedAt,
          // Only a publish that went live counts
          upToDate: hosting.hash === signature && hosting.state === "ready",
        }
      : null,
  };
}

// Netlify Drop, from https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/ (read 2026-10-28)
function DoItYourself({ open }: { open: boolean }) {
  return (
    <Fold open={open} icon="upload" title="Or put it online yourself with Netlify Drop" summary="Download your site, then drag it onto Netlify">
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-rule marker:font-semibold marker:text-accent">
        <li>Once every check above passes, click “Download my site (.zip)”.</li>
        <li>Unzip it. You’ll get a folder with index.html and an assets folder.</li>
        <li>
          Open{" "}
          <a href="https://app.netlify.com/drop" target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
            Netlify Drop
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{" "}
          and log in or sign up. If you don’t, the site gets a temporary password until you claim it.
        </li>
        <li>Drag the folder onto the drop zone.</li>
        <li>Netlify shows your address ending in netlify.app. Open it and check your site.</li>
        <li>To update it later, download again, then drag the new folder into the drop area under Production deploys on your project’s page.</li>
      </ol>
      <p className="text-sm text-muted">
        From{" "}
        <a href="https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/" target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
          Netlify’s Drop guide
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        , checked <LocalDate iso="2026-10-28T12:00:00Z" />.
      </p>
    </Fold>
  );
}

function BuildSteps({ site, platformId, number }: { site: LoadedSite; platformId: PlatformId; number: number }) {
  const platform = PLATFORM_DATA[platformId];
  const { plan, brand } = site;
  const hosting = plan?.hosting && !plan.hosting.simulated ? plan.hosting : null;
  const context: PasteContext = {
    name: site.name,
    copy: site.content ? copyOf(site.content) : null,
    design: site.design,
    brand: brand
      ? {
          colors: brand.colors,
          logo: download(brand.logos.primary),
          icon: download(brand.logos.profile),
          practice: { logo: site.brandPractice.logo, icon: site.brandPractice.icon },
        }
      : null,
    photos: Object.fromEntries(site.library.map((photo) => [photo.id, { href: photoUrl(photo.photoId, photo.id, false), practice: photo.simulated }])),
    domain: plan?.domain ?? null,
    siteHost: platformId === "first_sale" && hosting ? `${hosting.siteName}.netlify.app` : null,
    domainSetup: platform.domainSetup,
  };
  // Connecting only works where a Netlify app is registered; Netlify Drop needs no connection
  const shown = platform.setupSteps.filter((step) => step.key !== "first_sale-connect" || netlifyApp());
  // Ticks from another platform's steps don't count here
  const done = (plan?.setupDone ?? []).filter((key) => shown.some((step) => step.key === key));
  const steps: ChecklistStep[] = shown.map((step) => ({
    ...step,
    // Design and publish show up once there are words
    inApp: !site.content && step.inApp?.href.match(/#step-(design|publish)$/) ? { label: "Draft and approve your words first", href: "/website#step-words" } : step.inApp,
    // Once the site is on Netlify, its own domain page
    goTo:
      hosting && (step.key === "first_sale-domain" || step.key === "first_sale-https")
        ? { label: "Your site’s domain settings", url: `https://app.netlify.com/projects/${hosting.siteName}/domain-management` }
        : step.goTo,
    paste: pasteFor(step.paste, context),
  }));
  const builtHere = platformId === "first_sale";
  const left = site.content ? placeholderCount(site.content) : 0;

  return (
    <section aria-labelledby="step-build" className="flex flex-col gap-4">
      <SectionHead
        id="step-build"
        number={number}
        title={builtHere ? "Finish what only you can do" : `Build it on ${platform.name}`}
        lead={
          builtHere
            ? "First Sale builds and publishes your site, but it can’t make accounts, take payments or buy a web address for you. These steps cover those, with your details ready to paste."
            : `You set up the site yourself on ${platform.name}; First Sale can’t sign in or pay for you. Each step says where to click, has a “Take me there” link to that page on ${platform.name}, and has your own words, colors, logo and item details ready to paste.`
        }
      />
      <Card bodyClassName="gap-4">
        {!builtHere ? (
          <a href={platform.signupUrl} target="_blank" rel="noopener noreferrer" className={PRIMARY_LINK}>
            Open {platform.name}
            <Icon name="external" size="sm" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
        {left && !builtHere ? (
          <Note>
            {left} [bracketed] {left === 1 ? "note is" : "notes are"} still in your words. Fill them in in step 3 before you paste.
          </Note>
        ) : null}
        {!site.content ? <p className="text-muted">Draft your pages in step 3, and your words will show up in these steps ready to copy.</p> : null}
        <SetupChecklist steps={steps} done={done} />
        <p className="text-sm text-muted">
          Menus and buttons as {builtHere ? "Netlify, Stripe and Square" : platform.name} name them in their help, checked{" "}
          <LocalDate iso={`${platform.stepsCheckedOn}T12:00:00Z`} />. If something has moved, each step’s help link has the latest.
        </p>
      </Card>
    </section>
  );
}
