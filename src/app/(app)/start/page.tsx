import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { MoveOn } from "@/components/move-on";
import { PlanCosts, StepGroup } from "@/components/plan/next-actions";
import { actionStep, GroupFacts, ListRow, priceTasks, TaskListRow, TimeFact, WaitingOnStructure } from "@/components/plan/paperwork";
import { StepRow } from "@/components/plan/step-row";
import { PracticeBanner } from "@/components/practice-banner";
import { ResearchRunStatus } from "@/components/requirements/research-run";
import { TEXT_LINK } from "@/components/styles";
import { Card, Chip, Fold, PageHead } from "@/components/ui";
import { getMyBusiness, getMyPaperwork, lastMyRun, type MyPaperwork } from "@/lib/data/my-business";
import { displayName } from "@/lib/intake/answers";
import { STRUCTURE_NAMES } from "@/lib/research/applicability";
import { profileKey } from "@/lib/research/requirements";
import { planCosts } from "@/lib/rules/next-action";
import type { TaskState } from "@/lib/rules/paperwork";
import { CHECK_MINUTES, formatMinutes, INTAKE_MINUTES, MAX_SITTING_MINUTES, remainingWork, stepMinutes } from "@/lib/rules/progress";
import { PAPERWORK_PLACEHOLDER } from "@/lib/rules/section-status";
import { getMyContactSetup } from "@/lib/contact-status";
import { progressLabel } from "@/lib/progress-labels";
import { CONTACT_HREF, CONTACT_STEP_TITLE } from "@/lib/rules/contact-setup";
import { sectionMetadata } from "@/lib/sections";
import { savePlanPdfAction } from "../checklist/actions";

export const metadata = sectionMetadata("/start");

export default function StartPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHead
        kicker={
          <span className="inline-flex items-center gap-2">
            <Icon name="flag" size="sm" />
            Start your business · Every step
          </span>
        }
        title="Start your business"
        lead="Every step in order, under the part of the menu it belongs to. Each one says what it is, about how long it takes, and whether it’s ready, done, or waiting on something."
      />
      <Suspense fallback={<p className="text-muted">Loading your steps…</p>}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  const [business, paper, research, followUp, contact] = await Promise.all([
    getMyBusiness(),
    getMyPaperwork(),
    lastMyRun("research", null),
    lastMyRun("follow_up", null),
    getMyContactSetup(),
  ]);
  const answered = Boolean(business?.profile);
  return (
    <>
      <ResearchRunStatus runs={{ research, followUp }} retryHref="/requirements" />
      {paper?.view.tasks.some((task) => task.step.simulated) ? <PracticeBanner what="Steps here came from practice results." /> : null}
      {paper ? <Progress paper={paper} /> : null}
      <MoveOn from="Start your business" />

      <ol className="flex flex-col gap-7">
        <Subsection number={1} title="Your business" id="sub-business">
          <ListRow
            href={answered ? "/business" : "/business/new"}
            title={answered ? `Your answers for ${displayName(business!.profile)}` : "Tell us about your business"}
            summary="Where you are, who owns it, what you sell and how. Your answers decide everything below."
            state={answered ? "done" : "ready"}
            icon="store"
            meta={answered ? null : <TimeFact minutes={INTAKE_MINUTES} />}
          />
          {contact.status.step !== "none" ? (
            <ListRow
              href={CONTACT_HREF}
              title={CONTACT_STEP_TITLE}
              summary="A business email address and phone number, apart from your personal ones."
              state={contact.status.step === "done" ? "done" : "ready"}
              icon="file"
            />
          ) : null}
        </Subsection>
        <Subsection number={2} title="Business structure" id="sub-structure">
          <StructureRow paper={paper} answered={answered} />
        </Subsection>
        <Subsection number={3} title="What applies to you" id="sub-check">
          <CheckRow paper={paper} answered={answered} />
        </Subsection>
        <Paperwork paper={paper} />
      </ol>

      {paper && paper.view.tasks.length ? <Extras paper={paper} /> : null}

      {paper?.plan.retired.length ? (
        <StepGroup
          level={2}
          id="retired-steps"
          title="Finished steps no longer on your list"
          help="A later check left these out. You’d already finished them, so they stay here for your records."
          icon="check"
          tone="done"
          count={paper.plan.retired.length}
        >
          <ul className="grid gap-2.5">
            {paper.plan.retired.map((step) => (
              <StepRow key={step.id} step={step} state="done" />
            ))}
          </ul>
        </StepGroup>
      ) : null}
    </>
  );
}

function Progress({ paper }: { paper: MyPaperwork }) {
  const steps = paper.view.tasks.map((task) => ({ ...task.step, requirementStatus: task.requirementStatus }));
  const needed = steps.filter((step) => step.timing === "before_selling");
  const done = needed.filter((step) => step.status === "done").length;
  const work = remainingWork(steps);
  const parts = paper.view.groups.filter((group) => !group.later && group.left).length;
  const waiting = paper.view.groups.reduce((sum, group) => sum + group.waitingOnStructure.length, 0);
  if (!needed.length && !waiting) return null;
  return (
    <div className="-mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="done" icon="check">
          {progressLabel("launch", done, needed.length)} done before your first sale
        </Chip>
        {work.left.length ? (
          <Chip icon="clock">
            {work.left.length} left, in {parts} {parts === 1 ? "part" : "parts"} of {formatMinutes(MAX_SITTING_MINUTES)} or less
          </Chip>
        ) : null}
        {work.waiting.length ? (
          <Chip tone="warn" icon="hourglass">
            {work.waiting.length} waiting to hear back
          </Chip>
        ) : null}
        {waiting ? (
          <Chip tone="gray" icon="lock">
            {waiting === 1 ? "1 filing waits" : `${waiting} filings wait`} on your business structure
          </Chip>
        ) : null}
      </div>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-wash">
        <div className="h-full rounded-full bg-accent" style={{ width: `${needed.length ? Math.round((done / needed.length) * 100) : 0}%` }} />
      </div>
    </div>
  );
}

function Subsection({ number, title, id, href, lead, facts, children }: { number: number; title: string; id: string; href?: string; lead?: string; facts?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2.5">
      <section aria-labelledby={id} className="flex flex-col gap-2.5">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-[1.5px] border-accent-ring bg-accent-tint text-sm font-bold text-accent">
            {number}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 id={id} className="font-display text-[22px] leading-snug">
              {href ? (
                <Link href={href} className="underline-offset-4 hover:underline">
                  {title}
                </Link>
              ) : (
                title
              )}
            </h2>
            {lead ? <p className="text-[15px] text-muted">{lead}</p> : null}
            {facts}
          </div>
        </div>
        <ul className="grid gap-2.5 sm:pl-11">{children}</ul>
      </section>
    </li>
  );
}

function StructureRow({ paper, answered }: { paper: MyPaperwork | null; answered: boolean }) {
  const decision = paper?.context.decision.structure ?? null;
  const recorded = paper?.details.some((detail) => detail.key === "structure_choice") ?? false;
  const waiting = paper?.view.standings.filter((standing) => standing.inclusion === "structure").length ?? 0;
  const state: TaskState = !answered ? "locked" : decision ? "done" : "ready";
  const summary = decision
    ? `${paper?.context.decision.from === "registered" ? "Already registered as" : "You chose"} ${STRUCTURE_NAMES[decision]}.`
    : recorded
      ? `You’re not sure yet.${waiting ? ` ${waiting === 1 ? "1 filing waits" : `${waiting} filings wait`} until you choose.` : ""}`
      : "Compare a sole proprietorship, an LLC and more for your situation, then choose. “Not sure yet” is fine for now.";
  return (
    <ListRow
      href="/structure"
      title={decision ? "Your business structure" : "Choose how your business is set up"}
      summary={summary}
      state={state}
      icon="scale"
      meta={state === "done" ? null : <TimeFact minutes={stepMinutes({ topic: "structure" })} />}
      note={state === "locked" ? "Do this first: Your business" : null}
    />
  );
}

function CheckRow({ paper, answered }: { paper: MyPaperwork | null; answered: boolean }) {
  const basis = paper?.basis ?? null;
  const stale = Boolean(paper && basis && profileKey(paper.profile) !== basis.profileKey);
  const open = paper?.view.open.length ?? 0;
  const done = Boolean(basis) && !stale && !open;
  const state: TaskState = !answered ? "locked" : done ? "done" : "ready";
  const summary = !basis
    ? "SnapStart checks official government sites and works out the rules that fit your business."
    : stale
      ? "You changed your answers. Open this and SnapStart updates your steps."
      : open
        ? `${open} quick ${open === 1 ? "question" : "questions"} about your plans left.`
        : "Checked on official government sites, and every question answered.";
  return (
    <ListRow
      href={open ? "/requirements#questions" : "/requirements"}
      title={basis ? "What applies to you" : "Find what applies to you"}
      summary={summary}
      state={state}
      icon="search"
      meta={
        state === "done" && basis ? (
          <span>
            Checked <LocalDate iso={basis.checkedAt.toISOString()} />
          </span>
        ) : state === "done" ? null : (
          <TimeFact minutes={CHECK_MINUTES} />
        )
      }
      note={state === "locked" ? "Do this first: Your business" : null}
    />
  );
}

function Paperwork({ paper }: { paper: MyPaperwork | null }) {
  if (!paper?.basis || !paper.view.groups.length) {
    return (
      <Subsection number={4} title={PAPERWORK_PLACEHOLDER.title} id="paperwork">
        <ListRow
          href="/requirements"
          title={paper?.basis ? "Nothing to file has turned up yet" : "Your licenses and registrations show up here"}
          summary={
            paper?.basis
              ? "Answer the questions on What applies to you. Anything that applies shows up here, grouped and in order."
              : "Once you find what applies to you, they show up here in short groups, each an hour and a half or less."
          }
          state={paper?.basis && !paper.view.open.length ? "done" : "locked"}
          icon="checklist"
          note={paper?.basis && !paper.view.open.length ? null : "Do this first: What applies to you"}
        />
      </Subsection>
    );
  }
  const place = paper.context.place;
  const priced = priceTasks(paper.view.tasks, place, paper.context.decision.structure);
  const byId = new Map(priced.map((task) => [task.step.id, task]));
  // A group's parts share its number, like the menu
  const bases = [...new Set(paper.view.groups.map((group) => group.base))];
  return (
    <>
      {paper.view.groups.map((group) => (
        <Subsection
          key={group.key}
          number={4 + bases.indexOf(group.base)}
          title={group.name}
          id={`group-${group.key}`}
          href={group.href}
          lead={group.summary}
          facts={<GroupFacts group={group} />}
        >
          {group.tasks.map((task) => (
            <TaskListRow key={task.step.id} task={byId.get(task.step.id)!} />
          ))}
          {group.waitingOnStructure.length ? <WaitingOnStructure titles={group.waitingOnStructure.map((each) => each.step.title)} /> : null}
        </Subsection>
      ))}
    </>
  );
}

function Extras({ paper }: { paper: MyPaperwork }) {
  const priced = priceTasks(paper.view.tasks, paper.context.place, paper.context.decision.structure);
  return (
    <>
      <PlanCosts costs={planCosts(priced.map(actionStep))} />

      <Card title="Keep a copy" icon="file" id="save-plan">
        <p className="text-muted">Save these steps as a PDF to print or bring along. A copy goes in your Documents.</p>
        <ActionButton
          action={savePlanPdfAction}
          label="Save as PDF"
          pendingLabel="Saving…"
          pendingStatus="Making a PDF of your steps. It opens when it’s ready."
          openDocument
        />
      </Card>

      <Fold title="How this list was made" summary="Who drafted the steps, and who decides" icon="info">
        <p className="text-sm text-muted">
          Times are rough estimates of your own hands-on time. Time waiting on an office isn’t counted. Groups longer than {formatMinutes(MAX_SITTING_MINUTES)} are split
          into parts.
        </p>
        <Link href="/requirements" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
          See what was checked, and what doesn’t apply
        </Link>
      </Fold>
    </>
  );
}
