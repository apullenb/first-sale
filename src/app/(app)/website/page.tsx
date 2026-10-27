import Link from "next/link";
import { Suspense } from "react";
import { draftWebsiteAction } from "@/app/(app)/website/actions";
import { findMoreOptionsAction } from "@/app/(app)/website/option-actions";
import { ActionButton } from "@/components/action-button";
import { ActorChip } from "@/components/actor-chip";
import { PracticeBanner } from "@/components/practice-banner";
import { RunStatus } from "@/components/run-status";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { WebsiteBasics } from "@/components/website/basics";
import { CopyButton } from "@/components/website/copy-button";
import { CopyEditor } from "@/components/website/copy-editor";
import { DomainFinder } from "@/components/website/domain-finder";
import { MoreOptionsList } from "@/components/website/more-options";
import { PlatformCard } from "@/components/website/platform-card";
import { SetupChecklist } from "@/components/website/setup-checklist";
import { SitePreview } from "@/components/website/site-preview";
import { PLATFORM_DATA, PLATFORM_ORDER } from "@/data/website-platforms";
import { getModel } from "@/lib/ai";
import { getMyBrand, getMyBusiness, getMyWebsitePlan, lastMyRun } from "@/lib/data/my-business";
import { CUT_OFF_MESSAGE } from "@/lib/data/workflow-runs";
import { displayName } from "@/lib/intake/answers";
import { sectionMetadata } from "@/lib/sections";
import { copyOf, copyTexts } from "@/lib/website/content";
import { domainIdeas } from "@/lib/website/domains";
import { lookFromBrand } from "@/lib/website/look";
import { isCurrentExplanation, platformFacts } from "@/lib/website/options";
import { recommendPlatform, sellsProducts } from "@/lib/website/recommend";
import type { WebsiteContent } from "@/lib/website/types";

export const metadata = sectionMetadata("/website");
// Drafting the site's words waits on an AI call
export const maxDuration = 300;

export default function WebsitePage() {
  return (
    <div className="flex max-w-5xl flex-col gap-6 wrap-break-word">
      <div className="flex max-w-3xl flex-col gap-1.5">
        <p className={EYEBROW}>Run your business</p>
        <h1 className={PAGE_TITLE}>Your website</h1>
        <p className="text-lg text-muted">
          Compare three ways to build a website and what each really costs, pick one, then build it step by step. First Sale writes the
          words with you; you set up the site on the platform you choose.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading your website plan…</p>}>
        <WebsitePlanView />
      </Suspense>
    </div>
  );
}

function StepHeading({ number, title, id }: { number: number; title: string; id: string }) {
  return (
    <h2 id={id} className={`${SECTION_TITLE} flex items-center gap-3`}>
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-base text-white">
        {number}
      </span>
      <span>
        <span className="sr-only">Step {number}: </span>
        {title}
      </span>
    </h2>
  );
}

async function WebsitePlanView() {
  const [business, plan, run, optionsRun, brand] = await Promise.all([
    getMyBusiness(),
    getMyWebsitePlan(),
    lastMyRun("website_copy", null),
    lastMyRun("website_options", null),
    getMyBrand(),
  ]);

  if (!business?.profile) {
    return (
      <section className={`${CARD} flex max-w-3xl flex-col gap-3`}>
        <p>Tell us about your business first. Your answers decide which option fits you best.</p>
        <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
          {business ? "Update your answers" : "Tell us about your business"}
        </Link>
      </section>
    );
  }

  const profile = business.profile;
  const name = displayName(profile);
  const recommendation = recommendPlatform(profile);
  const chosen = plan?.platform ?? null;
  const ideas = domainIdeas(profile.name, profile.location.city);
  const content = plan?.content ?? null;
  const practice = getModel().simulated;
  const explanations = plan?.explanations ?? {};
  const moreExplanations = Object.fromEntries(
    (plan?.moreOptions?.options ?? []).flatMap((option) => {
      const key = `more:${option.name.toLowerCase()}`;
      const explanation = explanations[key];
      return isCurrentExplanation(explanation, profile, option, practice) ? [[key, explanation]] : [];
    }),
  );

  return (
    <>
      <details open={!chosen} className={`${CARD} group max-w-3xl`}>
        <summary className="flex min-h-11 cursor-pointer items-center font-display text-xl font-bold">New to websites? Start here</summary>
        <div className="mt-3">
          <WebsiteBasics exampleDomain={ideas[0] ?? "yourbusiness.com"} />
        </div>
      </details>

      <section aria-labelledby="step-choose" className="flex flex-col gap-4">
        <StepHeading number={1} id="step-choose" title="Choose where to build it" />
        <div className="flex max-w-3xl flex-col gap-2 rounded-2xl bg-accent-tint p-5">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-accent-ink">
            <ActorChip actor="rule" /> Suggested for {name}: {PLATFORM_DATA[recommendation.platform].name}
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-accent-ink">
            {recommendation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="text-sm text-accent-ink">
            This comes from your answers about what you sell and how. You can pick any option.{" "}
            <Link href="/business/edit" className={TEXT_LINK}>
              Change your answers
            </Link>
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
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
        <div className={`${CARD} flex flex-col gap-3`}>
          <h3 className="font-display text-lg font-bold">Want to see other options?</h3>
          <p className="text-rule">
            These three fit most first websites. To compare others, First Sale can search the web for more builders, with their prices,
            pros and cons.
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
        </div>
      </section>

      <section aria-labelledby="step-address" className={`${CARD} flex max-w-3xl flex-col gap-3`}>
        <StepHeading number={2} id="step-address" title="Pick a web address" />
        <p className="text-rule">
          Your web address is how people find you, so pick one that’s short and matches your business name. You’ll buy it when you set
          up your site.
        </p>
        <DomainFinder ideas={ideas} checks={plan?.domainChecks ?? []} chosen={plan?.domain ?? null} />
      </section>

      <section aria-labelledby="step-words" className={`${CARD} flex max-w-3xl flex-col gap-4`}>
        <StepHeading number={3} id="step-words" title="Write your pages" />
        <ul aria-label="Who does what" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <li className="flex items-center gap-2">
            {content?.simulated ? <ActorChip actor="rule" /> : <ActorChip actor="ai" />}
            {content?.simulated ? "drafts in practice mode, from a template" : "drafts from your answers, without making up facts"}
          </li>
          <li className="flex items-center gap-2">
            <ActorChip actor="owner" /> edit and approve every word
          </li>
        </ul>
        {run && (run.status === "running" || run.message === CUT_OFF_MESSAGE) ? (
          <RunStatus status={run.status === "running" ? "running" : "failed"} message={null} what="Writing your website" />
        ) : null}
        {!chosen ? (
          <p className="text-muted">Choose where you’ll build your site in step 1 first, so the words fit how customers will buy.</p>
        ) : (
          <>
            {content?.simulated ? <PracticeBanner what="These words were drafted in practice mode." /> : null}
            {content && content.platform !== chosen ? (
              <p role="status" className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
                These words were written for {PLATFORM_DATA[content.platform].name}. Draft them again so they fit how customers buy on{" "}
                {PLATFORM_DATA[chosen].name}.
              </p>
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
      </section>

      {content ? (
        <section aria-labelledby="step-preview" className="flex flex-col gap-3">
          <StepHeading number={4} id="step-preview" title="See how it could look" />
          {content.simulated ? <PracticeBanner what="This preview uses words drafted in practice mode." /> : null}
          <SitePreview
            copy={content}
            name={name}
            domain={plan?.domain ?? null}
            look={lookFromBrand(brand)}
            action={sellsProducts(profile) ? "Shop now" : "Get in touch"}
          />
        </section>
      ) : null}

      {chosen ? <BuildSteps content={content} platformId={chosen} done={plan?.setupDone ?? []} /> : null}
    </>
  );
}

function BuildSteps({ content, platformId, done }: { content: WebsiteContent | null; platformId: keyof typeof PLATFORM_DATA; done: string[] }) {
  const platform = PLATFORM_DATA[platformId];
  // Ticks from another platform's steps don't count here
  const doneHere = done.filter((key) => platform.setupSteps.some((step) => step.key === key));
  const pieces = content
    ? [
        { label: "headline", text: content.headline },
        { label: "line under the headline", text: content.subheadline },
        { label: "welcome", text: content.intro },
        { label: "about story", text: content.about },
        { label: "what you sell", text: content.offerings.map((item) => `${item.name}\n${item.description}`).join("\n\n") },
        { label: "how to buy", text: content.howToBuy },
        { label: "contact", text: content.contact },
        { label: "questions and answers", text: content.faq.map((entry) => `${entry.question}\n${entry.answer}`).join("\n\n") },
        { label: "search title", text: content.seoTitle },
        { label: "search description", text: content.seoDescription },
      ].filter((piece) => piece.text.trim())
    : [];
  const left = content ? copyTexts(content).join(" ").match(/\[[^\]]+\]/g)?.length ?? 0 : 0;

  return (
    <section aria-labelledby="step-build" className={`${CARD} flex max-w-3xl flex-col gap-4`}>
      <StepHeading number={content ? 5 : 4} id="step-build" title={`Build it on ${platform.name}`} />
      <p className="text-rule">
        You set up the site yourself on {platform.name}; First Sale can’t sign in or pay for you. Follow these steps, and tick each one
        off as you go. Each “how to” link opens {platform.name}’s own help in a new tab.
      </p>
      <a href={platform.signupUrl} target="_blank" rel="noopener noreferrer" className={PRIMARY_LINK}>
        Open {platform.name}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <SetupChecklist steps={platform.setupSteps} done={doneHere} />

      {pieces.length ? (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-lg font-bold">Your words, ready to paste</h3>
          {content?.simulated ? <PracticeBanner what="These words were drafted in practice mode." /> : null}
          {left ? (
            <p className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
              {left} [bracketed] {left === 1 ? "note is" : "notes are"} still in your words. Fill them in above before you paste.
            </p>
          ) : null}
          <ul className="flex flex-col gap-2.5">
            {pieces.map((piece) => (
              <li key={piece.label} className="flex flex-col gap-1.5 rounded-xl bg-ground px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold capitalize">{piece.label}</span>
                  <CopyButton text={piece.text} label={piece.label} />
                </div>
                <p className="whitespace-pre-line text-[15px] text-rule">{piece.text}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted">Draft your pages in step 3, and they’ll show up here ready to copy into {platform.name}.</p>
      )}
    </section>
  );
}
