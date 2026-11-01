import { JobWatch } from "@/components/job-watch";
import type { JobRef } from "@/lib/workflows";

// A job started earlier, perhaps in another tab: follows it until the result shows, or says it was cut off
export function RunStatus({ status, job, message, what }: { status: "running" | "failed"; job: JobRef; message: string | null; what: string }) {
  if (status === "running") return <JobWatch jobs={[job]} what={what} />;
  return (
    <p role="alert" className="rounded-xl bg-check-tint px-4 py-3 text-[15px] text-check">
      {what} didn’t finish last time. {message ?? "Try again."}
    </p>
  );
}
