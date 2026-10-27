import Link from "next/link";
import { Suspense } from "react";
import { DetailField } from "@/components/business/detail-field";
import { BusinessHeading } from "@/components/intake/business-heading";
import { LocalDate } from "@/components/local-date";
import { History } from "@/components/structure/history";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { getMyBusiness, getMyDetails, getMyIntakeDraft, listMyHistory } from "@/lib/data/my-business";
import { DECISION_KEYS, DETAIL_KEYS, DETAILS, type DetailSpec, displayDetail } from "@/lib/details";
import type { BusinessProfile } from "@/lib/domain";
import { displayName, groupRows, profileToAnswers, sameAnswers, summarize, type SummaryRow } from "@/lib/intake/answers";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/business");

type SavedDetail = Awaited<ReturnType<typeof getMyDetails>>[number];

export default function BusinessPage({ searchParams }: PageProps<"/business">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading your business…</p>}>
      <BusinessOverview searchParams={searchParams} />
    </Suspense>
  );
}

async function BusinessOverview({ searchParams }: { searchParams: PageProps<"/business">["searchParams"] }) {
  const [{ welcome }, current, details, draft, history] = await Promise.all([
    searchParams,
    getMyBusiness(),
    getMyDetails(),
    getMyIntakeDraft(),
    listMyHistory({ kind: "profile", limit: 10 }),
  ]);

  if (!current) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <p className={EYEBROW}>Start your business · Step 1</p>
        <h1 className={PAGE_TITLE}>Your business</h1>
        <p className="text-lg text-muted">
          Answer a few quick questions, mostly by clicking. Your answers shape your requirements, your structure and your startup plan.
        </p>
        {draft?.mode === "create" ? (
          <p className="rounded-xl bg-accent-tint px-4 py-3 text-accent-ink">
            You’ve started already. Your answers from <LocalDate iso={draft.updatedAt.toISOString()} /> are saved.
          </p>
        ) : null}
        <Link href="/business/new" className={PRIMARY_LINK}>
          {draft?.mode === "create" ? "Pick up where you left off" : "Tell us about your business"}
        </Link>
      </div>
    );
  }

  const welcoming = welcome === "1" && current.profile !== null;
  const saved = new Map(details.map((detail) => [detail.key, detail]));
  const groups = current.profile ? groupRows(summarize(profileToAnswers(current.profile), { followUps: true })) : null;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Start your business · Step 1</p>
        <BusinessHeading focusOnMount={welcome === "1"}>{displayName(current.profile)}</BusinessHeading>
        <p className="text-lg text-muted">Your answers shape your requirements, your structure and your startup plan.</p>
      </div>

      {welcoming && current.profile ? <Welcome profile={current.profile} /> : null}

      {draft?.mode === "edit" && !(current.profile && sameAnswers(draft.answers, profileToAnswers(current.profile))) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-tint px-4 py-3 text-accent-ink">
          <p>You have answer changes you haven’t confirmed yet.</p>
          <Link href="/business/edit" className={SECONDARY_LINK}>
            Review them
          </Link>
        </div>
      ) : null}

      {groups ? (
        <section aria-labelledby="answers-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="answers-heading" className={SECTION_TITLE}>
              Your answers
            </h2>
            <Link href="/business/edit" className={SECONDARY_LINK}>
              Change answers
            </Link>
          </div>
          <p className="text-rule">You confirmed these. First Sale uses them everywhere, so you won’t be asked again.</p>
          <Rows rows={groups.confirmed} />
          {groups.open.length ? (
            <>
              <h3 className="mt-2 font-bold">Still open</h3>
              <p className="text-rule">
                You said “not sure” or skipped these. We don’t assume an answer: your requirements show what depends on them.
              </p>
              <Rows rows={groups.open} open />
            </>
          ) : null}
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl bg-check-tint p-5">
          <p className="text-check">Some of this business’s answers need updating before we can use them.</p>
          <Link href="/business/edit" className={PRIMARY_LINK}>
            Update the answers
          </Link>
        </section>
      )}

      <section aria-labelledby="decisions-heading" className="flex flex-col gap-3">
        <h2 id="decisions-heading" className={SECTION_TITLE}>
          Decisions
        </h2>
        <div className={`${CARD} flex flex-col gap-3`}>
          <dl className="flex flex-col gap-3">
            {DECISION_KEYS.map((key) => {
              const decision = saved.get(key);
              return (
                <div key={key} className="flex flex-col gap-0.5">
                  <dt className="font-bold">{DETAILS[key].label}</dt>
                  <dd className={decision ? "" : "text-muted"}>{decision ? displayDetail(key, decision.value) : "Not decided yet"}</dd>
                  {decision ? (
                    <dd>
                      <Origin detail={decision} />
                    </dd>
                  ) : null}
                </div>
              );
            })}
          </dl>
          <Link href="/structure" className={SECONDARY_LINK}>
            Compare your options
          </Link>
        </div>
      </section>

      <section aria-labelledby="details-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="details-heading" className={SECTION_TITLE}>
            Business details
          </h2>
          <p className="text-rule">
            Forms ask for these. Fill them in here, and First Sale can draft your form answers for you to check.
          </p>
        </div>
        <p className="rounded-lg bg-rule-tint px-3 py-2.5 text-sm text-rule">
          First Sale never stores Social Security or tax id numbers. Forms leave those for you to fill in yourself.
        </p>
        <ul className="rounded-2xl bg-surface px-5 ring-1 ring-ink/5">
          {DETAIL_KEYS.filter((key) => !(DETAILS[key] as DetailSpec).decision).map((key) => {
            const detail = saved.get(key);
            return (
              <li key={key} className="border-b border-rule-tint py-4 last:border-b-0">
                <DetailField detailKey={key} value={detail?.value ?? null} origin={detail ? <Origin detail={detail} /> : null} />
              </li>
            );
          })}
        </ul>
      </section>

      <History title="Answer history" events={history} empty="No changes yet." />

      <div className="flex flex-wrap gap-2.5">
        {current.profile && !welcoming ? (
          <Link href="/requirements" className={PRIMARY_LINK}>
            See your requirements
          </Link>
        ) : null}
        <Link href="/documents" className={SECONDARY_LINK}>
          Your documents
        </Link>
      </div>
    </div>
  );
}

function Rows({ rows, open = false }: { rows: SummaryRow[]; open?: boolean }) {
  if (!rows.length) return null;
  return (
    <dl className={`rounded-2xl px-5 ring-1 ${open ? "bg-check-tint/50 ring-check/20" : "bg-surface ring-ink/5"}`}>
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule-tint py-3 last:border-b-0">
          <dt className="w-44 font-semibold text-rule">{row.label}</dt>
          <dd className={`flex min-w-0 flex-1 basis-60 flex-wrap items-center gap-2 ${row.value ? "" : "text-muted"}`}>
            {row.value || "Not answered"}
            {row.unsure ? <span className="rounded-full bg-check-tint px-2.5 py-0.5 text-[13px] font-bold text-check">Not sure yet</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Origin({ detail }: { detail: SavedDetail }) {
  const date = <LocalDate iso={detail.updatedAt.toISOString()} />;
  if (detail.source === "owner") return <p className="text-sm text-muted">You entered this on {date}.</p>;
  return (
    <p className="text-sm text-muted">
      {detail.documentId ? (
        <Link href={`/documents/${detail.documentId}`} className={TEXT_LINK}>
          Saved from a document
        </Link>
      ) : (
        "Saved from a document"
      )}{" "}
      on {date}.
    </p>
  );
}

function Welcome({ profile }: { profile: BusinessProfile }) {
  const place = summarize(profileToAnswers(profile)).find((row) => row.step === "place")?.value;
  const items = [
    `Find your requirements for ${place} on official government sites`,
    "Compare business structures, explained for your answers",
    "Get a startup plan with your steps in the right order",
    "Get help understanding and filling in your forms",
  ];

  return (
    <section aria-labelledby="welcome-heading" className="flex flex-col gap-3 rounded-2xl bg-accent-tint p-5">
      <h2 id="welcome-heading" className="font-display text-2xl font-bold text-accent-ink">
        You’re all set.
      </h2>
      <p className="text-accent-ink">Here’s what comes next:</p>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0 text-accent">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link href="/requirements" className={`${PRIMARY_LINK} mt-1`}>
        Find my requirements
      </Link>
    </section>
  );
}
