import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { MoveOn } from "@/components/move-on";
import { GroupFacts, LockNote, needsConfirming, priceTasks, TaskListRow, WaitingOnStructure } from "@/components/plan/paperwork";
import { NextStep } from "@/components/plan/plan-summary";
import { PracticeBanner } from "@/components/practice-banner";
import { PRIMARY_LINK, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card, Note, PageHead } from "@/components/ui";
import { getMyPaperwork } from "@/lib/data/my-business";
import { formatMinutes, MAX_SITTING_MINUTES } from "@/lib/rules/progress";

export const metadata: Metadata = { title: "Your paperwork" };

type Params = Promise<{ group: string }>;

export default function GroupPage({ params }: { params: Params }) {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link href="/start" className="-mb-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-accent">
        <Icon name="back" size="sm" />
        Start your business
      </Link>
      <Suspense fallback={<p className="text-muted">Loading these steps…</p>}>
        <Group params={params} />
      </Suspense>
    </div>
  );
}

// Numbered after Your business, Business structure and What applies to you; a group's parts share its number, like the menu
const FIRST_GROUP_STEP = 4;

async function Group({ params }: { params: Params }) {
  const [{ group: key }, paper] = await Promise.all([params, getMyPaperwork()]);
  const groups = paper?.basis ? paper.view.groups : [];
  const index = groups.findIndex((each) => each.key === key);
  const group = groups[index];
  if (!paper || !group) {
    return (
      <Card>
        <p>{groups.length ? "These steps moved. Your answers changed how they’re grouped." : "Your paperwork shows up once you find what applies to you."}</p>
        <Link href={groups.length ? "/start" : "/requirements"} className={PRIMARY_LINK}>
          {groups.length ? "See every step" : "Find what applies to me"}
          <Icon name="arrow" size="sm" />
        </Link>
      </Card>
    );
  }
  const priced = priceTasks(group.tasks, paper.context.place, paper.context.decision.structure);
  const after = groups.slice(index + 1).find((each) => each.state !== "done") ?? null;
  // What applies now, not what was stored before the owner's answers
  const next = group.next ? { ...group.next.step, requirementStatus: group.next.requirementStatus, conditions: group.next.conditions } : undefined;
  const nextPriced = priced.find((task) => task.step.id === group.next?.step.id);
  // The owner's own work first: a lock that's only an office's wait says so on its row
  const locked = group.tasks.filter((task) => task.state === "locked");
  const lockedTask = group.state === "locked" ? (locked.find((task) => task.blockers.some((each) => !each.office)) ?? locked[0]) : undefined;
  const ownBlocker = lockedTask?.blockers.find((each) => !each.office);

  return (
    <>
      <PageHead
        kicker={`Start your business · Step ${FIRST_GROUP_STEP + [...new Set(groups.map((each) => each.base))].indexOf(group.base)}`}
        title={group.name}
        lead={`${group.summary}${group.part ? ` Split into ${group.part.of} parts so each takes ${formatMinutes(MAX_SITTING_MINUTES)} or less.` : ""}`}
      >
        <div className="mt-1">
          <GroupFacts group={group} />
        </div>
      </PageHead>

      {group.tasks.some((task) => task.step.simulated) ? <PracticeBanner what="These steps came from practice results." /> : null}

      {next ? (
        <NextStep
          step={next}
          parallel={Math.max(0, group.tasks.filter((task) => task.state === "ready").length - 1)}
          kind={nextPriced?.action ?? "filing"}
          feeCents={nextPriced?.feeCents ?? next.feeCents}
          unconfirmed={nextPriced ? needsConfirming(nextPriced) : false}
        />
      ) : group.state === "locked" ? (
        <Note icon="lock">
          <p className="font-semibold">Nothing here can start yet.</p>
          {ownBlocker ? <LockNote blockers={lockedTask!.blockers} /> : <p>Do this first: choose your business structure.</p>}
          <Link href={ownBlocker?.href ?? "/structure"} className="mt-1 inline-flex min-h-11 items-center font-bold underline underline-offset-4">
            Take me there
          </Link>
        </Note>
      ) : group.state === "waiting" ? (
        <Note icon="hourglass" tone="quiet">
          Everything here is with an office. Mark each one approved when you hear back.
        </Note>
      ) : group.state === "done" ? (
        <Note icon="check" tone="quiet">
          You’ve finished every step here.
        </Note>
      ) : null}
      {group.state === "done" || group.state === "waiting" ? <MoveOn from="Start your business" /> : null}

      <section aria-labelledby="steps-heading" className="flex flex-col gap-3">
        <h2 id="steps-heading" className="font-display text-[22px] leading-snug">
          Steps in this part, in order
        </h2>
        <ul className="grid gap-2.5">
          {priced.map((task) => (
            <TaskListRow key={task.step.id} task={task} next={task.step.id === group.next?.step.id} />
          ))}
          {group.waitingOnStructure.length ? <WaitingOnStructure titles={group.waitingOnStructure.map((each) => each.step.title)} /> : null}
        </ul>
      </section>

      <section aria-label="What’s next" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-soft">
        <div className="flex min-w-0 flex-col">
          <p className="text-sm font-semibold text-muted">When you’re done here</p>
          <p className="font-semibold">{after ? `Next is: ${after.name}` : "That’s the last of your paperwork."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {after ? (
            <Link href={after.href} className={SECONDARY_LINK}>
              Go to the next part
              <Icon name="arrow" size="sm" />
            </Link>
          ) : null}
          <Link href="/start" className={`flex min-h-11 w-fit items-center ${TEXT_LINK}`}>
            See every step
          </Link>
        </div>
      </section>
    </>
  );
}
