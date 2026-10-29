import Link from "next/link";
import { type ReactNode, Suspense } from "react";
import { approveMarketingPlanAction } from "@/app/(app)/marketing/actions";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { ApproveOrRewrite, WritePlanButton } from "@/components/marketing/ai-progress";
import { MarketingAnswers, MarketingIntakeForm } from "@/components/marketing/intake-form";
import { PlanView } from "@/components/marketing/plan-view";
import { MarketingStepList, type ShownStep } from "@/components/marketing/step-list";
import { PracticeBanner } from "@/components/practice-banner";
import { RunStatus } from "@/components/run-status";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import type { SkillArea } from "@/data/marketing-platforms";
import { PLATFORM_DATA as WEBSITE_PLATFORMS } from "@/data/website-platforms";
import { getMyBrand, getMyBusiness, getMyMarketing, getMyWebsitePlan, lastMyRun, listMyDocuments } from "@/lib/data/my-business";
import { CUT_OFF_MESSAGE } from "@/lib/data/workflow-runs";
import type { BusinessProfile } from "@/lib/domain";
import { examplesText } from "@/lib/intake/catalog";
import { BUDGET_LABELS, CHANNEL_LABELS, OFFERING_KIND_LABELS, STATE_NAMES } from "@/lib/intake/options";
import { completeIntake, intakeKey } from "@/lib/marketing/intake";
import { type HandHolding, stepAnchor } from "@/lib/marketing/types";
import { doneSteps, handHolding, type MarketingMove, marketingMove, visibleSteps, withoutPlatforms } from "@/lib/rules/marketing";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/marketing");
// Writing the plan waits on an AI call
export const maxDuration = 300;

export default function MarketingPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6 wrap-break-word">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Marketing and branding</p>
        <h1 className={PAGE_TITLE}>Build your marketing plan</h1>
        <p className="text-lg text-muted">Answer a few questions, get a plan made for your business, then follow it one step at a time.</p>
      </div>
      <Suspense fallback={<p className="text-muted">Loading your marketing plan…</p>}>
        <MarketingView />
      </Suspense>
    </div>
  );
}

// Why a step gets the help it does, in the owner's own terms
const HELP_NOTES: Record<HandHolding, Record<SkillArea, string>> = {
  walkthrough: {
    social: "Step by step, because you’re new to social media.",
    seo: "Step by step, because SEO is new to you.",
    content: "Step by step, because you haven’t made marketing content yet.",
  },
  guided: {
    social: "A short checklist, with step-by-step help one tap away, since you use social media for yourself.",
    seo: "A short checklist, with step-by-step help one tap away, since you know the basics of SEO.",
    content: "A short checklist, with step-by-step help one tap away, since you’ve made a little content.",
  },
  checklist: {
    social: "A quick checklist, since you’ve run accounts before.",
    seo: "A quick checklist, since you’ve done SEO before.",
    content: "A quick checklist, since you make content often.",
  },
};

function helpNote(area: SkillArea, help: HandHolding): string {
  return HELP_NOTES[help][area];
}

function launchLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// What the plan uses that the owner already told First Sale
function knownFacts(profile: BusinessProfile, hasLogo: boolean, website: string | null) {
  const sells = profile.firstItems || examplesText(profile.category, profile.productTags) || profile.offeringKinds.map((kind) => OFFERING_KIND_LABELS[kind]).join(", ");
  return [
    { label: "Business", value: profile.name ?? "No name yet" },
    { label: "What you sell", value: sells },
    { label: "How you sell", value: profile.channels.map((channel) => CHANNEL_LABELS[channel]).join(", ") },
    { label: "Where", value: [profile.location.city, STATE_NAMES[profile.location.state]].filter(Boolean).join(", ") },
    { label: "Budget to start", value: profile.startupBudget ? BUDGET_LABELS[profile.startupBudget] : "Not given" },
    { label: "First sale by", value: profile.launchDate ? launchLabel(profile.launchDate) : "No date yet" },
    { label: "Logo", value: hasLogo ? "Made in Branding" : "Not made yet" },
    { label: "Website", value: website ?? "Not chosen yet" },
  ].filter((fact) => fact.value);
}

async function MarketingView() {
  const [business, marketing, run, brand, website, documents] = await Promise.all([
    getMyBusiness(),
    getMyMarketing(),
    lastMyRun("marketing_plan", null),
    getMyBrand(),
    getMyWebsitePlan(),
    listMyDocuments(),
  ]);

  if (!business?.profile) {
    return (
      <section className={`${CARD} flex flex-col gap-3`}>
        <p>Tell us about your business first. Your plan is built from your answers.</p>
        <Link href={business ? "/business/edit" : "/business/new"} className={PRIMARY_LINK}>
          {business ? "Update your answers" : "Tell us about your business"}
        </Link>
      </section>
    );
  }

  const known = knownFacts(business.profile, Boolean(brand), website?.platform ? WEBSITE_PLATFORMS[website.platform].name : null);
  const stored = marketing?.intake ?? null;
  const intake = completeIntake(stored);
  const plan = marketing?.plan ?? null;
  const current = Boolean(plan && intake && plan.intakeKey === intakeKey(intake));
  const approvedAt = marketing?.approvedAt ?? null;
  const exclude = stored?.exclude ?? [];
  // Steps from the last approval stay until a new plan is approved; platforms ruled out since never show
  const steps = visibleSteps(marketing?.steps ?? [], exclude);
  const done = doneSteps(steps, marketing?.stepsDone ?? []);
  const move = marketingMove({ hasProfile: true, intake, plan, current, approved: Boolean(approvedAt), steps, done });
  const pdf = documents.find((doc) => doc.generatedKind === "marketing_plan") ?? null;
  const shown: ShownStep[] = steps.map((step) => {
    const help = handHolding(step.area, stored);
    return { ...step, help, helpNote: helpNote(step.area, help) };
  });
  const running = run?.status === "running";
  const runNotice =
    run && (running || run.message === CUT_OFF_MESSAGE) ? (
      <RunStatus status={running ? "running" : "failed"} message={null} what="Writing your marketing plan" />
    ) : null;
  const stepsNote = !current
    ? "These come from your approved plan. Your answers changed since, so write your plan again to update them."
    : !approvedAt
      ? "These come from your earlier plan. Approve your new plan to update them."
      : null;

  if (move.kind === "intake" || move.kind === "business") {
    return (
      <section aria-label="Questions" className={CARD}>
        <MarketingIntakeForm initial={stored} hasPlan={Boolean(plan)} known={known} />
      </section>
    );
  }

  return (
    <>
      <NextCard move={move} total={steps.length} done={done.length} draftedAt={plan?.generatedAt ?? null} runNotice={runNotice} running={running} />

      {steps.length ? (
        <section aria-labelledby="steps-heading" className={`${CARD} flex flex-col gap-4`}>
          <h2 id="steps-heading" className={SECTION_TITLE}>
            Your steps
          </h2>
          {stepsNote ? <p className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">{stepsNote}</p> : null}
          {steps.some((step) => step.practice) ? <PracticeBanner what="These steps come from a plan drafted in practice mode." /> : null}
          <ul aria-label="Who does what" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <li className="flex items-center gap-2">
              <ActorChip actor="rule" /> picks the steps and how much help each gets
            </li>
            {steps.some((step) => step.by === "ai") ? (
              <li className="flex items-center gap-2">
                <ActorChip actor="ai" /> wrote the plan’s own first actions
              </li>
            ) : null}
            <li className="flex items-center gap-2">
              <ActorChip actor="owner" /> tick each one off
            </li>
          </ul>
          <MarketingStepList steps={shown} done={done} />
        </section>
      ) : null}

      {plan ? (
        <section aria-labelledby="plan-heading" className={`${CARD} flex flex-col gap-4`}>
          <div className="flex flex-col gap-1">
            <h2 id="plan-heading" className={SECTION_TITLE}>
              Your marketing plan
            </h2>
            <p className="text-sm text-muted">
              {approvedAt && current ? (
                <>
                  Approved <LocalDate iso={approvedAt.toISOString()} />.{" "}
                  {pdf ? (
                    <Link href={`/documents/${encodeURIComponent(pdf.id)}`} className={TEXT_LINK}>
                      Open the copy in My Business Library
                    </Link>
                  ) : null}
                </>
              ) : current ? (
                "Draft, not approved yet"
              ) : (
                "Written before your answers changed"
              )}
            </p>
          </div>
          {plan.simulated ? <PracticeBanner what="This plan was drafted in practice mode." /> : null}
          {current && !approvedAt ? (
            <PlanView plan={withoutPlatforms(plan, exclude)} />
          ) : (
            // Open only while it waits for approval, so the steps stay up front
            <details className="group">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent-ink underline underline-offset-4">
                {current ? "Read your plan" : "Read your earlier plan"}
              </summary>
              <div className="pt-3">
                <PlanView plan={withoutPlatforms(plan, exclude)} />
              </div>
            </details>
          )}
        </section>
      ) : null}

      {stored ? (
        <section aria-labelledby="answers-heading" className={`${CARD} flex flex-col gap-3`}>
          <h2 id="answers-heading" className={SECTION_TITLE}>
            Your answers
          </h2>
          <MarketingAnswers intake={stored} hasPlan={Boolean(plan)} known={known} />
        </section>
      ) : null}
    </>
  );
}

function NextCard({
  move,
  total,
  done,
  draftedAt,
  runNotice,
  running,
}: {
  move: Exclude<MarketingMove, { kind: "intake" | "business" }>;
  total: number;
  done: number;
  draftedAt: string | null;
  // A run still going, or one the time limit cut off
  runNotice: ReactNode;
  // Buttons wait only while a run is still going
  running: boolean;
}) {
  return (
    <section aria-labelledby="next-heading" className="flex flex-col gap-3 rounded-2xl bg-accent-tint p-5">
      {move.kind === "write" ? (
        <>
          <h2 id="next-heading" className={`${SECTION_TITLE} text-accent-ink`}>
            {move.again ? "Your answers changed" : "Next: write your marketing plan"}
          </h2>
          <p className="text-accent-ink">
            {move.again
              ? "Write your plan again so it matches your new answers."
              : "First Sale looks at everything you’ve told it, from what you sell to your budget, launch date, brand and website, and drafts a plan for you to check."}
          </p>
          <ul aria-label="Who does what" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-accent-ink">
            <li className="flex items-center gap-2">
              <ActorChip actor="ai" /> drafts it
            </li>
            <li className="flex items-center gap-2">
              <ActorChip actor="rule" /> keep out places you said no to
            </li>
            <li className="flex items-center gap-2">
              <ActorChip actor="owner" /> approve it
            </li>
          </ul>
          {runNotice}
          {running ? null : <WritePlanButton again={move.again} />}
        </>
      ) : move.kind === "approve" ? (
        <>
          <h2 id="next-heading" className={`${SECTION_TITLE} text-accent-ink`}>
            Next: check your plan and approve it
          </h2>
          <p className="text-accent-ink">Read it below. Approving saves a copy to My Business Library and makes your steps.</p>
          {runNotice}
          {running ? null : <ApproveOrRewrite approve={approveMarketingPlanAction.bind(null, { draftedAt })} />}
        </>
      ) : move.kind === "step" ? (
        <>
          <p className="text-sm font-semibold text-accent-ink">
            Step {move.number} of {total} · {done} done
          </p>
          <h2 id="next-heading" className={`${SECTION_TITLE} text-accent-ink`}>
            Next: {move.step.title}
          </h2>
          <a href={`#${stepAnchor(move.step.key)}`} className={PRIMARY_LINK}>
            Start this step
          </a>
        </>
      ) : (
        <>
          <h2 id="next-heading" className={`${SECTION_TITLE} text-accent-ink`}>
            All your marketing steps are done
          </h2>
          <p className="text-accent-ink">Keep to your weekly rhythm. When you’re ready for more, change your answers and write your plan again.</p>
        </>
      )}
    </section>
  );
}
