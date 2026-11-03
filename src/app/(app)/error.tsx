"use client";

import Link from "next/link";
import { PAGE_TITLE, PRIMARY, SECONDARY_LINK } from "@/components/styles";

// retry() refetches the page from the server; reset() alone would re-render the same failure
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="flex max-w-xl flex-col gap-3">
      <h1 className={PAGE_TITLE}>Something went wrong</h1>
      <p className="text-lg text-muted">This page couldn’t load. Try again, or go back to Today.</p>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={() => retry()} className={PRIMARY}>
          Try again
        </button>
        <Link href="/" className={SECONDARY_LINK}>
          Go to Today
        </Link>
      </div>
    </div>
  );
}
