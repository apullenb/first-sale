import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { ActorChip } from "@/components/actor-chip";
import { LocalDate } from "@/components/local-date";
import { StepStateLabel, stepStates } from "@/components/plan/step-state";
import { StepStatus } from "@/components/plan/step-status";
import { StructureDecision } from "@/components/plan/structure-decision";
import { PracticeBanner } from "@/components/practice-banner";
import { StatusChip } from "@/components/requirements/requirement-card";
import { CARD, EYEBROW, PAGE_TITLE, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { getMyDetails, getMyStep, listMyDocuments } from "@/lib/data/my-business";
import { formatFee } from "@/lib/documents/startup-plan";
import { LEVEL_LABELS, TOPIC_LABELS } from "@/lib/labels";
import { followingSteps } from "@/lib/rules/plan";

export const metadata: Metadata = { title: "Startup plan step" };

type Params = Promise<{ stepId: string }>;

export default function StepPage({ params }: { params: Params }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Link href="/checklist" className={`flex min-h-11 w-fit items-center gap-1.5 ${TEXT_LINK}`}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Your startup plan
      </Link>
      <Suspense fallback={<p className="text-muted">Loading this step…</p>}>
        <StepDetail params={params} />
      </Suspense>
    </div>
  );
}

const LINK_ITEM = "flex min-h-11 w-fit items-center font-semibold underline underline-offset-4";

async function StepDetail({ params }: { params: Params }) {
  const { stepId } = await params;
  const [found, documents] = await Promise.all([getMyStep(stepId), listMyDocuments()]);
  if (!found) notFound();
  const { step, all } = found;
  const details = step.topic === "structure" ? await getMyDetails() : [];

  const states = stepStates(all);
  const byKey = new Map(all.map((candidate) => [candidate.key, candidate]));
  const before = step.prerequisites.flatMap((key) => byKey.get(key) ?? []);
  const after = followingSteps(all.filter((candidate) => !candidate.retired), step.key);
  const linked = documents.filter((doc) => doc.taskId === step.id);
  const sourced = step.verification === "sourced";

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className={EYEBROW}>
          {TOPIC_LABELS[step.topic]} · {LEVEL_LABELS[step.level]}
        </p>
        <h1 className={PAGE_TITLE}>{step.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip sourced={sourced} />
          <StepStateLabel state={states.get(step.key)} />
        </div>
      </div>

      {step.simulated ? <PracticeBanner what="This step came from practice results." /> : null}
      {step.retired ? (
        <p className="rounded-xl bg-rule-tint px-4 py-3 text-rule">
          A later check of your requirements left this step out of your plan. You’d already finished it, so it stays here
          for your records.
        </p>
      ) : null}

      {step.why || step.needsProfessional ? (
        <section aria-labelledby="why-heading" className={`flex flex-col gap-2 ${CARD}`}>
          <h2 id="why-heading" className={SECTION_TITLE}>
            Why it may apply to you
          </h2>
          {step.why ? <p>{step.why}</p> : null}
          {step.needsProfessional ? <p className="text-sm text-muted">A lawyer or accountant can help you with this one.</p> : null}
        </section>
      ) : null}

      {!sourced || step.uncertainty.length ? (
        <section aria-labelledby="check-heading" className="flex flex-col gap-2.5 rounded-2xl bg-check-tint/60 p-5 ring-1 ring-check/15">
          <h2 id="check-heading" className={`${SECTION_TITLE} text-check`}>
            Still to check
          </h2>
          {step.uncertainty.length ? (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {step.uncertainty.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : null}
          {!sourced && step.whoToCall ? (
            <p>
              <span className="font-semibold">Who to call:</span> {step.whoToCall}
            </p>
          ) : null}
          {!sourced && step.whatToAsk.length ? (
            <>
              <p className="font-semibold">What to ask</p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {step.whatToAsk.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="details-heading" className="flex flex-col gap-2.5">
        <h2 id="details-heading" className={SECTION_TITLE}>
          The details
        </h2>
        <dl className="rounded-2xl bg-surface px-5 ring-1 ring-ink/5">
          <Row label="Who handles it">{step.agency || step.whoToCall || "We didn’t find which office handles this yet."}</Row>
          <Row label="Fee">
            {step.feeCents === null ? (
              "We didn’t find a fee on an official page. Ask when you call."
            ) : (
              <>
                {formatFee(step.feeCents)}
                {step.feeCheckedAt ? (
                  <span className="text-muted">
                    {" "}
                    · checked <LocalDate iso={step.feeCheckedAt} />
                  </span>
                ) : null}
              </>
            )}
          </Row>
          <Row label="Deadline">{step.deadline ?? "We didn’t find a deadline on an official page. Ask when you call."}</Row>
          {step.prepare.length ? (
            <Row label="Have these ready">
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {step.prepare.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </Row>
          ) : null}
          {step.doneWhen ? <Row label="Done when">{step.doneWhen}</Row> : null}
        </dl>
      </section>

      <section aria-labelledby="links-heading" className="flex flex-col gap-2.5">
        <h2 id="links-heading" className={SECTION_TITLE}>
          Official links
        </h2>
        {step.links.length ? (
          <ul className="flex flex-col gap-2">
            {step.links.map((link, index) => (
              <li key={`${index}-${link.url}`} className="flex flex-col rounded-2xl bg-surface px-4 py-2 ring-1 ring-ink/5 sm:px-5">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className={`${LINK_ITEM} text-accent-ink`}>
                  {link.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                <p className="flex flex-wrap gap-x-3 gap-y-1 pb-1.5 text-sm">
                  {link.government ? <span className="text-muted">{link.government}</span> : null}
                  <span className={`font-semibold ${link.confirms ? "text-accent-ink" : "text-rule"}`}>
                    {link.confirms ? "Confirms this step" : "Related official page"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">We didn’t find an official page for this step yet. That doesn’t mean it doesn’t apply.</p>
        )}
      </section>

      {step.topic === "structure" ? (
        <StructureDecision key={step.id} current={details.find((detail) => detail.key === "structure_choice")?.value ?? null} />
      ) : null}

      {before.length || after.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {before.length ? (
            <section aria-labelledby="before-heading" className={`flex flex-col gap-1.5 ${CARD}`}>
              <h2 id="before-heading" className={SECTION_TITLE}>
                Finish first
              </h2>
              <ul className="flex flex-col gap-1">
                {before.map((prerequisite) => (
                  <li key={prerequisite.id} className="flex flex-col pb-1">
                    <Link href={`/checklist/${prerequisite.id}`} className={LINK_ITEM}>
                      {prerequisite.title}
                    </Link>
                    <StepStateLabel state={states.get(prerequisite.key)} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {after.length ? (
            <section aria-labelledby="after-heading" className={`flex flex-col gap-1.5 ${CARD}`}>
              <h2 id="after-heading" className={SECTION_TITLE}>
                What comes next
              </h2>
              <ul className="flex flex-col">
                {after.map((following) => (
                  <li key={following.id}>
                    <Link href={`/checklist/${following.id}`} className={LINK_ITEM}>
                      {following.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="documents-heading" className={`flex flex-col gap-2.5 ${CARD}`}>
        <h2 id="documents-heading" className={SECTION_TITLE}>
          Documents for this step
        </h2>
        {linked.length ? (
          <ul className="flex flex-col">
            {linked.map((doc) => (
              <li key={doc.id}>
                <Link href={`/documents/${doc.id}`} className={LINK_ITEM}>
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No documents are linked to this step yet.</p>
        )}
        <Link href={`/documents?step=${encodeURIComponent(step.id)}`} className={SECONDARY_LINK}>
          Get help with a form for this step
        </Link>
      </section>

      {step.retired ? null : (
        <section aria-labelledby="progress-heading" className={`flex flex-col gap-3 ${CARD}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id="progress-heading" className={SECTION_TITLE}>
              Your progress
            </h2>
            <ActorChip actor="owner" />
          </div>
          <StepStatus
            key={step.id}
            stepId={step.id}
            status={step.status}
            note={step.evidenceNote}
            completedAt={step.completedAt?.toISOString() ?? null}
          />
        </section>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-rule-tint py-3 last:border-b-0">
      <dt className="w-40 font-semibold text-rule">{label}</dt>
      <dd className="min-w-0 flex-1 basis-60">{children}</dd>
    </div>
  );
}
