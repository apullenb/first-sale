import Link from "next/link";
import { ActorLegend } from "@/components/how-it-works";

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
      <Link
        href="/business"
        className="flex min-h-11 w-fit items-center rounded-lg bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-ink"
      >
        Tell us about your business
      </Link>
    </div>
  );
}
