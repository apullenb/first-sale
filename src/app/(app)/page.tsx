import Link from "next/link";
import { Suspense } from "react";
import { ActorLegend } from "@/components/how-it-works";
import { getCurrentBusiness } from "@/lib/data/my-businesses";
import { displayName, profileToAnswers, summarize } from "@/lib/intake/answers";

export default function Today() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-accent-ink">Today</p>
        <h1 className="max-w-2xl font-display text-4xl font-bold leading-tight tracking-tight">
          Start your business one step at a time.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Your setup progress, your next step, and anything waiting for your OK will show up here as each part of
          the app is built.
        </p>
      </section>
      <ActorLegend />
      <Suspense fallback={<div className="h-28 max-w-2xl rounded-2xl bg-surface ring-1 ring-ink/5" />}>
        <CurrentBusiness />
      </Suspense>
    </div>
  );
}

async function CurrentBusiness() {
  const business = await getCurrentBusiness();

  if (!business) {
    return (
      <Link
        href="/business/new"
        className="flex min-h-12 w-fit items-center rounded-lg bg-accent px-5 font-bold text-white hover:bg-accent-ink"
      >
        Tell us about your business
      </Link>
    );
  }

  const rows = business.profile ? summarize(profileToAnswers(business.profile)) : [];
  const detail = rows
    .filter((row) => row.step === "place" || row.step === "sell")
    .map((row) => row.value)
    .filter(Boolean)
    .join(" · ");

  return (
    <section aria-labelledby="current-business" className="flex max-w-2xl flex-col gap-2 rounded-2xl bg-surface p-5 ring-1 ring-ink/5">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Working on</p>
      <h2 id="current-business" className="font-display text-2xl font-bold">
        {displayName(business.profile)}
      </h2>
      {detail ? <p className="text-rule">{detail}</p> : null}
      <Link href="/business" className="w-fit font-semibold text-accent-ink underline underline-offset-4">
        See your business
      </Link>
    </section>
  );
}
