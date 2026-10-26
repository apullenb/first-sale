import Link from "next/link";
import { Suspense } from "react";
import { BusinessHeading } from "@/components/intake/business-heading";
import { SwitchBusinessButton } from "@/components/intake/switch-business-button";
import { getCurrentBusiness, listMyBusinesses } from "@/lib/data/my-businesses";
import type { BusinessProfile } from "@/lib/domain";
import { displayName, profileToAnswers, summarize } from "@/lib/intake/answers";
import { sectionMetadata } from "@/lib/sections";

export const metadata = sectionMetadata("/business");

export default function BusinessPage({ searchParams }: PageProps<"/business">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading your business…</p>}>
      <BusinessOverview searchParams={searchParams} />
    </Suspense>
  );
}

const PRIMARY_LINK = "flex min-h-12 w-fit items-center rounded-lg bg-accent px-5 font-bold text-white hover:bg-accent-ink";

async function BusinessOverview({ searchParams }: { searchParams: PageProps<"/business">["searchParams"] }) {
  const [{ welcome }, businesses, current] = await Promise.all([searchParams, listMyBusinesses(), getCurrentBusiness()]);

  if (!current) {
    return (
      <div className="flex max-w-2xl flex-col gap-3">
        <p className="text-sm font-semibold text-accent-ink">Start your business · Step 1</p>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">Your business</h1>
        <p className="text-lg text-muted">
          Answer a few questions about your business. Your answers shape your requirements, your structure and your
          checklist.
        </p>
        <Link href="/business/new" className={PRIMARY_LINK}>
          Tell us about your business
        </Link>
      </div>
    );
  }

  const others = businesses.filter((business) => business.id !== current.id);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold text-accent-ink">Start your business · Step 1</p>
        <BusinessHeading businessId={current.id} focusOnMount={welcome === current.id}>{displayName(current.profile)}</BusinessHeading>
        <p className="text-lg text-muted">Your answers shape your requirements, your structure and your checklist.</p>
      </div>

      {/* Only for the business just created, not whichever is current */}
      {welcome === current.id && current.profile ? <Welcome profile={current.profile} /> : null}

      {current.profile ? (
        <section aria-labelledby="answers-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="answers-heading" className="font-display text-xl font-bold">
              Your answers
            </h2>
            <Link href="/business/edit" className="flex min-h-11 items-center rounded-lg border border-field bg-surface px-4 font-semibold hover:border-muted">
              Edit answers
            </Link>
          </div>
          <dl className="rounded-2xl bg-surface px-5 ring-1 ring-ink/5">
            {summarize(profileToAnswers(current.profile)).map((row) => (
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

      <section aria-labelledby="businesses-heading" className="flex flex-col gap-3">
        <h2 id="businesses-heading" className="font-display text-xl font-bold">
          Your businesses
        </h2>
        {others.length ? (
          <ul className="rounded-2xl bg-surface px-5 ring-1 ring-ink/5">
            {others.map((business) => {
              const name = displayName(business.profile);
              return (
                <li key={business.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-rule-tint py-3 last:border-b-0">
                  <span className="font-semibold">{name}</span>
                  <SwitchBusinessButton businessId={business.id} name={name} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">This is your only business so far.</p>
        )}
        <Link href="/business/new" className="w-fit font-semibold text-accent-ink underline underline-offset-4">
          Add another business
        </Link>
      </section>
    </div>
  );
}

function Welcome({ profile }: { profile: BusinessProfile }) {
  const place = summarize(profileToAnswers(profile)).find((row) => row.step === "place")?.value;
  const items = [
    `Requirements for ${place}, each linked to an official source or marked for you to check`,
    profile.owners.count > 1
      ? `A comparison of business structures for ${profile.owners.count} owners, with a suggested path`
      : "A comparison of business structures for a single owner, with a suggested path",
    "A checklist of setup steps in the right order",
  ];
  if (profile.offeringKinds.includes("food")) items.push("Questions to ask about the food rules for what you make");
  if (profile.hiringPlans === "first_year" || profile.hiringPlans === "right_away") {
    items.push("Employer steps for when you’re ready to hire");
  }

  return (
    <section aria-labelledby="welcome-heading" className="flex flex-col gap-3 rounded-2xl bg-accent-tint p-5">
      <h2 id="welcome-heading" className="font-display text-2xl font-bold text-accent-ink">
        You’re all set.
      </h2>
      <p className="text-accent-ink">Here’s what First Sale prepares next:</p>
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
    </section>
  );
}
