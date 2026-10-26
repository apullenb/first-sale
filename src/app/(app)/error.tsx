"use client";

import Link from "next/link";

// retry() refetches the page from the server; reset() alone would re-render the same failure
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="flex max-w-xl flex-col gap-3">
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p className="text-muted">This page couldn’t load. Try again, or go back to Today.</p>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={() => retry()} className="min-h-11 rounded-lg bg-accent px-5 font-bold text-white hover:bg-accent-ink">
          Try again
        </button>
        <Link href="/" className="flex min-h-11 items-center rounded-lg border border-field bg-surface px-4 font-semibold">
          Go to Today
        </Link>
      </div>
    </div>
  );
}
