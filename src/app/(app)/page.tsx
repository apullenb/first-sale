import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { DashboardWidgets, LaunchCard } from "@/components/plan/dashboard-widgets";
import { JourneyStages, StartHere } from "@/components/plan/journey";
import { LaunchSchedule, TodayHead } from "@/components/plan/launch-countdown";
import { actionStep, priceTasks } from "@/components/plan/paperwork";
import { StepBoard } from "@/components/plan/step-board";
import { PracticeBanner } from "@/components/practice-banner";
import { SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/server";
import { getMyBusiness, getMyPaperwork, getMyResearch, listMyDocuments, type MyBusiness } from "@/lib/data/my-business";
import { autofillFacts, outdatedFacts } from "@/lib/documents/autofill";
import { displayName, profileToAnswers, summarize } from "@/lib/intake/answers";
import { BUDGET_LABELS } from "@/lib/intake/options";
import { answerChanges } from "@/lib/research/changes";
import { type JourneyInput, journeyStages, nextMove, readyForFirstSale } from "@/lib/rules/journey";
import { planCosts } from "@/lib/rules/next-action";
import { nextTaskAfter } from "@/lib/rules/paperwork";
import { budgetCapCents, remainingWork, spentCents } from "@/lib/rules/progress";

export default function Today() {
  return (
    <div className="@container flex max-w-[1000px] flex-col gap-6">
      <Suspense fallback={<Loading />}>
        <Overview />
      </Suspense>
    </div>
  );
}

function Loading() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="h-4 w-44 rounded bg-wash" />
        <div className="h-10 w-80 max-w-full rounded-lg bg-wash" />
        <div className="h-5 w-96 max-w-full rounded bg-wash" />
      </div>
      <div className="h-80 rounded-2xl border border-line bg-surface shadow-card" />
    </div>
  );
}

async function Overview() {
  const [user, business, paper, research, documents] = await Promise.all([getCurrentUser(), getMyBusiness(), getMyPaperwork(), getMyResearch(), listMyDocuments()]);

  const profile = business?.profile ?? null;
  const details = paper?.details ?? [];
  const decision = paper?.context.decision ?? { structure: null, from: null };
  const changes = research && profile ? answerChanges(research.profile, profile, (research.structure as typeof decision.structure) ?? null, decision.structure) : [];
  const facts = profile ? autofillFacts(profile, details) : [];
  const outdated = documents.filter((doc) => doc.role !== "reviewed" && outdatedFacts(doc.factsUsed, facts).length > 0);
  const toCheck = documents.filter((doc) => doc.role !== "reviewed" && Object.values(doc.answers).some((answer) => answer.state === "suggested"));

  // Only tasks that apply, counted the same way as the menu's paperwork groups
  const view = paper?.basis ? paper.view : null;
  const tasks = view ? priceTasks(view.tasks, paper!.context.place, decision.structure) : [];
  const priced = tasks.map(actionStep);
  const costs = planCosts(priced);
  const work = remainingWork(priced);
  const required = priced.filter((step) => step.timing === "before_selling");
  const beforeSelling = { total: required.length, done: required.filter((step) => step.status === "done").length };
  const first = view?.first ?? null;
  const groupOf = (key: string) => view?.groups.find((group) => group.key === key) ?? null;

  const input: JourneyInput = {
    business: !business ? "none" : profile ? "done" : "update",
    businessSummary: profile ? `Answers saved for ${displayName(profile)}.` : null,
    researched: Boolean(research),
    answersChanged: changes.length > 0,
    structure: { ...decision, recorded: details.some((detail) => detail.key === "structure_choice") },
    questions: view?.open.length ?? 0,
    plan: {
      steps: priced.length,
      beforeSelling,
      first: first
        ? {
            id: first.step.id,
            title: first.step.title,
            later: first.step.timing === "later", group: { name: groupOf(first.group)!.name, href: groupOf(first.group)!.href },
          }
        : null,
      waitsOnStructure: Boolean(view?.waitsOnStructure),
    },
    documents: { total: documents.length, waiting: new Set([...outdated, ...toCheck].map((doc) => doc.id)).size },
  };
  const move = nextMove(input);
  const moveStep = move.stepId ? priced.find((step) => step.id === move.stepId) : undefined;
  const afterTask = moveStep && view ? nextTaskAfter(view.tasks, moveStep.key) : null;
  const after = afterTask ? (priced.find((step) => step.id === afterTask.step.id) ?? null) : null;
  const moveGroup = first && move.stepId === first.step.id ? groupOf(first.group) : null;
  const stages = journeyStages(input);

  const waiting: { text: string; href: string; action: string }[] = [];
  if (changes.length) {
    waiting.push({
      text: `You changed your answers (${changes.map((change) => change.what.toLowerCase()).join(", ")}), so your steps need updating.`,
      href: "/requirements",
      action: "Update my steps",
    });
  }
  if (outdated.length) {
    waiting.push({ text: `${outdated.length === 1 ? "A drafted form uses" : `${outdated.length} drafted forms use`} details you’ve since changed.`, href: `/documents/${outdated[0].id}`, action: "Update the answers" });
  } else if (toCheck.length) {
    waiting.push({ text: `${toCheck.length === 1 ? "A form has" : `${toCheck.length} forms have`} drafted answers waiting for you to check.`, href: `/documents/${toCheck[0].id}`, action: "Check the answers" });
  }
  // The next move already points there
  const alsoWaiting = waiting.filter((item) => item.href !== move.href);

  return (
    <>
      <TodayHead
        name={user.name.trim().split(/\s+/)[0] || null}
        business={profile?.name ?? null}
        launchDate={profile?.launchDate ?? null}
        ready={readyForFirstSale(input)}
      />

      {/* "Do this next" comes first on phones too */}
      <div className="grid items-stretch gap-5 @3xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <StartHere
          move={move}
          step={moveStep}
          group={moveGroup ? { name: moveGroup.name, href: moveGroup.href } : null}
          parallel={moveStep && moveStep.timing !== "later" ? Math.max(0, tasks.filter((task) => task.state === "ready" && task.step.timing !== "later").length - 1) : 0}
          after={after}
        />
        {profile ? <LaunchCard date={profile.launchDate} /> : null}
      </div>

      {alsoWaiting.length ? (
        <section aria-labelledby="waiting-heading" className="flex items-start gap-3 rounded-[14px] border border-check-ring bg-check-tint px-4 py-3.5 text-check">
          <Icon name="info" className="mt-0.5" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id="waiting-heading" className="font-bold">
              Also waiting for your OK
            </h2>
            <ul className="flex flex-col gap-1">
              {alsoWaiting.map((item) => (
                <li key={item.href + item.action} className="flex flex-col">
                  <p>{item.text}</p>
                  <Link href={item.href} className="flex min-h-11 w-fit items-center font-bold underline decoration-[1.5px] underline-offset-[3px] hover:text-ink">
                    {item.action}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {profile && priced.length ? (
        <>
          <DashboardWidgets
            left={work.left.length}
            minutes={work.minutes}
            waiting={work.waiting.length}
            parts={(view?.groups ?? []).filter((group) => !group.later && group.minutesLeft).map((group) => ({ name: group.name, href: group.href, minutes: group.minutesLeft }))}
            spentCents={spentCents(priced)}
            toGoCents={costs.startupCents}
            unknownFees={costs.unknown.length}
            budgetCapCents={budgetCapCents(profile.startupBudget)}
            budgetLabel={profile.startupBudget ? BUDGET_LABELS[profile.startupBudget] : null}
            done={beforeSelling.done}
            total={beforeSelling.total}
            stages={stages}
          />
          {profile.launchDate ? <LaunchSchedule date={profile.launchDate} minutes={work.minutes} waiting={work.waiting.length} /> : null}
        </>
      ) : null}

      {/* The step in "Do this next" isn't listed again */}
      {tasks.length ? <StepBoard tasks={tasks} costs={costs} skip={moveStep?.id ?? null} /> : null}
      {priced.some((step) => step.simulated) ? <PracticeBanner what="These steps came from practice results." /> : null}

      <div className={`grid items-start gap-5 ${business ? "@3xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" : ""}`}>
        <JourneyStages stages={stages} />
        {business ? (
          <div className="flex flex-col gap-5">
            <Card title="Already have some paperwork?" icon="upload" id="have-heading">
              <p className="text-rule">
                Not starting from scratch? Upload what you already have, like your LLC certificate or the IRS letter with your EIN (tax ID number). Got a letter in the mail you’re not
                sure about? Upload it and SnapStart explains what it is and what to do.
              </p>
              <Link href="/documents?add=have#add-form" className={SECONDARY_LINK}>
                Upload a document
              </Link>
            </Card>
            <CurrentBusiness business={business} />
          </div>
        ) : null}
      </div>
    </>
  );
}

function CurrentBusiness({ business }: { business: MyBusiness }) {
  const rows = business.profile ? summarize(profileToAnswers(business.profile)) : [];
  const detail = rows
    .filter((row) => row.step === "place" || row.step === "sell")
    .map((row) => row.value)
    .filter(Boolean)
    .join(" · ");

  return (
    <Card title="Working on" icon="store" id="current-business">
      <p className="font-display text-[22px] leading-tight">{displayName(business.profile)}</p>
      {detail ? <p className="text-[15px] text-muted">{detail}</p> : null}
      <Link href="/business" className={`-my-3 w-fit py-3 ${TEXT_LINK}`}>
        See your business
      </Link>
    </Card>
  );
}
