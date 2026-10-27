import { LocalDate } from "@/components/local-date";
import type { requirements, sources } from "@/db/schema";

type Requirement = typeof requirements.$inferSelect;
type Source = typeof sources.$inferSelect;

const LEVELS = { federal: "Federal", state: "State", county: "County", city: "City" } as const;

export function RequirementCard({ requirement, sources }: { requirement: Requirement; sources: Source[] }) {
  const sourced = requirement.verification === "sourced";
  const cited = requirement.sourceIds.flatMap((key) => sources.find((source) => source.key === key) ?? []);
  const fee =
    requirement.feeCents === null
      ? null
      : requirement.feeCents === 0
        ? "Free"
        : `$${(requirement.feeCents / 100).toLocaleString("en-US", { minimumFractionDigits: requirement.feeCents % 100 ? 2 : 0 })}`;

  return (
    <article className="flex flex-col gap-2 rounded-2xl bg-surface px-4 py-4 ring-1 ring-ink/5 sm:px-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2.5">
        <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1">
          <h3 className="text-[17px] font-bold leading-snug">{requirement.title}</h3>
          <p className="text-rule">{requirement.whyItApplies}</p>
          {requirement.needsProfessional ? (
            <p className="text-sm text-muted">A lawyer or accountant can help you with this one.</p>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <StatusChip sourced={sourced} />
          <span className="text-sm text-muted">{[LEVELS[requirement.level], fee].filter(Boolean).join(" · ")}</span>
        </div>
      </div>

      <details className="group">
        <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-accent-ink underline underline-offset-4">
          <span className="group-open:hidden">{sourced ? "Show the source" : "Who to call"}</span>
          <span className="hidden group-open:inline">Hide details</span>
        </summary>
        {sourced ? (
          <div className="mt-1 flex flex-col gap-2 rounded-xl bg-ground px-3.5 py-3 text-sm">
            <p className="font-bold">Official source</p>
            <SourceLinks sources={cited} />
            {requirement.evidence ? (
              <figure className="flex flex-col gap-0.5">
                <figcaption className="text-muted">What the page says</figcaption>
                <blockquote className="text-rule">“{requirement.evidence}”</blockquote>
              </figure>
            ) : null}
            {requirement.deadline ? (
              <p>
                <span className="font-semibold">Deadline:</span> {requirement.deadline}
              </p>
            ) : null}
            <p className="text-muted">
              Checked <LocalDate iso={requirement.checkedAt.toISOString()} />
            </p>
          </div>
        ) : (
          <div className="mt-1 flex flex-col gap-2 rounded-xl bg-check-tint/60 px-3.5 py-3 text-sm ring-1 ring-check/15">
            <p>
              <strong>
                {cited.length ? "We found a page about this, but it doesn’t confirm the details." : "No official source found yet."}
              </strong>{" "}
              {requirement.whoToCall ? `Call: ${requirement.whoToCall}.` : null}
            </p>
            {cited.length ? <SourceLinks sources={cited} /> : null}
            {requirement.whatToAsk.length ? (
              <>
                <p className="font-bold">What to ask</p>
                <ul className="flex list-disc flex-col gap-0.5 pl-5">
                  {requirement.whatToAsk.map((question, index) => (
                    <li key={index}>{question}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        )}
      </details>
    </article>
  );
}

export function SourceLinks({ sources }: { sources: Source[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {sources.map((source) => (
        <li key={source.id}>
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline underline-offset-2">
            {source.title}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function StatusChip({ sourced }: { sourced: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${
        sourced ? "bg-accent-tint text-accent-ink" : "bg-check-tint text-check"
      }`}
    >
      {sourced ? (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8v5" />
          <path d="M12 16.5h.01" />
          <circle cx="12" cy="12" r="10" />
        </svg>
      )}
      {sourced ? "Official source" : "Needs verification"}
    </span>
  );
}
