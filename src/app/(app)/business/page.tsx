import Link from "next/link";
import { Suspense } from "react";
import { DetailField } from "@/components/business/detail-field";
import { BusinessHeading } from "@/components/intake/business-heading";
import { LocalDate } from "@/components/local-date";
import { CARD, EYEBROW, PAGE_TITLE, PRIMARY_LINK, SECONDARY_LINK, SECTION_TITLE, TEXT_LINK } from "@/components/styles";
import { getMyBusiness, getMyDetails, getMyPlan } from "@/lib/data/my-business";
import { DETAIL_KEYS, DETAILS, displayDetail } from "@/lib/details";
import type { BusinessProfile } from "@/lib/domain";
import { displayName, profileToAnswers, summarize } from "@/lib/intake/answers";
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
  const [{ welcome }, current, details, plan] = await Promise.all([searchParams, getMyBusiness(), getMyDetails(), getMyPlan()]);

  if (!current) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <p className={EYEBROW}>Start your business · Step 1</p>
        <h1 className={PAGE_TITLE}>Your business</h1>
        <p className="text-lg text-muted">
          Answer a few questions about your business. Your answers shape your requirements, your structure and your
          startup plan.
        </p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
        </Link>
      </div>
    );
  }

  const welcoming = welcome === "1" && current.profile !== null;
  const saved = new Map(details.map((detail) => [detail.key, detail]));
  const structure = saved.get("structure_choice");
  const structureStep = plan?.steps.find((step) => step.topic === "structure");

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <p className={EYEBROW}>Start your business · Step 1</p>
        <BusinessHeading focusOnMount={welcome === "1"}>{displayName(current.profile)}</BusinessHeading>
        <p className="text-lg text-muted">Your answers shape your requirements, your structure and your startup plan.</p>
      </div>

      {welcoming && current.profile ? <Welcome profile={current.profile} /> : null}

      {current.profile ? (
        <section aria-labelledby="answers-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="answers-heading" className={SECTION_TITLE}>
              Your answers
            </h2>
            <Link href="/business/edit" className={SECONDARY_LINK}>
              Edit answers
            </Link>
          </div>
          <dl className="rounded-2xl bg-surface px-5 ring-1 ring-ink/5">
            {summarize(profileToAnswers(current.profile), { followUps: true }).map((row) => (
              <div key={row.label} className="flex flex-wrap gap-x-4 gap-y-1 border-b border-rule-tint py-3 last:border-b-0">
                <dt className="w-44 font-semibold text-rule">{row.label}</dt>
                <dd className={`min-w-0 flex-1 basis-60 ${row.value ? "" : "text-muted"}`}>{row.value || "Not answered"}</dd>
              </div>
            ))}
          </dl>
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
        <div className={`${CARD} flex flex-col gap-2`}>
          <h3 className="font-bold">{DETAILS.structure_choice.label}</h3>
          <p className="text-[15px] text-rule">{DETAILS.structure_choice.help}</p>
          <p className={structure ? "" : "text-muted"}>
            {structure ? displayDetail("structure_choice", structure.value) : "Not decided yet"}
          </p>
          {structure ? <Origin detail={structure} /> : null}
          <Link href={structureStep ? `/checklist/${structureStep.id}` : "/checklist"} className={`${SECONDARY_LINK} mt-1`}>
            {structureStep ? "Open the business structure step" : "Open your startup plan"}
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
          {DETAIL_KEYS.filter((key) => key !== "structure_choice").map((key) => {
            const detail = saved.get(key);
            return (
              <li key={key} className="border-b border-rule-tint py-4 last:border-b-0">
                <DetailField detailKey={key} value={detail?.value ?? null} origin={detail ? <Origin detail={detail} /> : null} />
              </li>
            );
          })}
        </ul>
      </section>

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
