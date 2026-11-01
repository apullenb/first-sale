"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { jobsRunningAction } from "@/app/(app)/job-actions";
import type { JobRef } from "@/lib/workflows";
import { Working } from "./working";

const POLL_MS = 3000;

// Follows jobs started elsewhere, such as another tab; refreshes the page once none is running
export function useJobWatch(onDone?: () => void) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRef[] | null>(null);
  const key = jobs ? JSON.stringify(jobs) : null;

  useEffect(() => {
    if (!key) return;
    const watched = JSON.parse(key) as JobRef[];
    let stopped = false;
    let timer: number | undefined;
    async function check() {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        const running = await jobsRunningAction(watched).catch(() => true);
        if (stopped) return;
        if (!running) {
          setJobs(null);
          router.refresh();
          onDone?.();
          return;
        }
      }
      timer = window.setTimeout(check, POLL_MS);
    }
    timer = window.setTimeout(check, POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
    // onDone is read when the job ends, not watched
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, router]);

  return { watching: jobs !== null, watch: useCallback((next: JobRef[]) => setJobs(next), []) };
}

export const RUNNING_ELSEWHERE = "Already running, maybe in another tab. This page shows the result when it finishes.";

// A job the page found running when it loaded: shows progress, then the result, with no reload
export function JobWatch({ jobs, what }: { jobs: JobRef[]; what: string }) {
  const { watching, watch } = useJobWatch();
  const key = JSON.stringify(jobs);
  useEffect(() => watch(JSON.parse(key) as JobRef[]), [key, watch]);
  return <Working label={`${what} is running. This page shows the result when it finishes.`} active={watching} />;
}
