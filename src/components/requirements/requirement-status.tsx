import { type RequirementStatus, STATUS_LABELS } from "@/lib/research/applicability";

const STYLES: Record<RequirementStatus, string> = {
  verified: "bg-accent-tint text-accent-ink",
  conditional: "bg-rule-tint text-rule",
  optional: "bg-surface text-rule ring-1 ring-ink/15",
  needs_confirmation: "bg-check-tint text-check",
  outside_coverage: "bg-surface text-muted ring-1 ring-ink/15",
};

const PATHS: Record<RequirementStatus, React.ReactNode> = {
  verified: <path d="M20 6 9 17l-5-5" />,
  conditional: (
    <>
      <path d="M6 3v12" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </>
  ),
  optional: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  needs_confirmation: (
    <>
      <path d="M12 8v5" />
      <path d="M12 16.5h.01" />
      <circle cx="12" cy="12" r="10" />
    </>
  ),
  outside_coverage: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
};

// Whether a requirement applies; the icon only repeats the words
export function RequirementStatusChip({ status }: { status: RequirementStatus }) {
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${STYLES[status]}`}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[status]}
      </svg>
      {STATUS_LABELS[status]}
    </span>
  );
}
