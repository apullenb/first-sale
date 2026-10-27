import { LocalDate } from "@/components/local-date";
import type { requirements, sources } from "@/db/schema";
import { formatFee } from "@/lib/documents/startup-plan";
import type { Classified } from "@/lib/research/applicability";
import type { Inquiry } from "@/lib/research/inquiry";
import { RequirementStatusChip } from "./requirement-status";
import { WrittenInquiry } from "./written-inquiry";

type Requirement = typeof requirements.$inferSelect;
type Source = typeof sources.$inferSelect;

const LEVELS = { federal: "Federal", state: "State", county: "County", city: "City" } as const;

interface Props {
  requirement: Requirement;
  sources: Source[];
  // Worked out again with the owner's current answers and decisions
  standing: Classified;
  inquiry: Inquiry;
  // Whose rule it is, such as "Texas" or "Austin"
  jurisdiction: string;
}

export function RequirementCard({ requirement, sources, standing, inquiry, jurisdiction }: Props) {
  const sourced = requirement.verification === "sourced";
  const cited = requirement.sourceIds.flatMap((key) => sources.find((source) => source.key === key) ?? []);
  const fee = requirement.feeCents === null ? null : formatFee(requirement.feeCents);
  const facts = [`${LEVELS[requirement.level]}: ${jurisdiction}`, fee ? `Fee ${fee}` : null, requirement.timing === "later" ? "Later, not before your first sale" : null].filter(Boolean);
  const best = cited[0] ? { title: cited[0].title, url: cited[0].url } : null;

  return (
    <article className="flex flex-col gap-2.5 rounded-2xl bg-surface px-4 py-4 ring-1 ring-ink/5 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <RequirementStatusChip status={standing.status} />
        <StatusChip sourced={sourced} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-[17px] font-bold leading-snug">{requirement.title}</h3>
        <p className="text-sm text-muted">{facts.join(" · ")}</p>
      </div>
      <p className="text-rule">{requirement.whyItApplies}</p>

      {standing.conditions.length ? (
        <div className="flex flex-col gap-1 rounded-xl bg-rule-tint/60 px-3.5 py-2.5 text-[15px]">
          <p className="font-semibold">It depends on</p>
          <ul className="flex list-disc flex-col gap-0.5 pl-5">
            {standing.conditions.map((condition, index) => (
              <li key={index}>{condition}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {standing.alreadyHave ? <p className="rounded-xl bg-accent-tint px-3.5 py-2.5 text-[15px] text-accent-ink">{standing.alreadyHave}</p> : null}
      {requirement.agency ? (
        <p className="text-sm text-rule">
          <span className="font-semibold">Who handles it:</span> {requirement.agency}
        </p>
      ) : null}
      {requirement.needsProfessional ? <p className="text-sm text-muted">A lawyer or accountant can help you with this one.</p> : null}

      <details className="group">
        <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-accent-ink underline underline-offset-4">
          <span className="group-open:hidden">{sourced ? "Show the source" : "What the official pages say"}</span>
          <span className="hidden group-open:inline">Hide the source</span>
        </summary>
        {sourced ? (
          <div className="mt-1 flex flex-col gap-2 rounded-xl bg-ground px-3.5 py-3 text-sm">
            <p className="font-bold">Official source</p>
            <SourceLinks sources={cited} />
            {requirement.evidence ? (
              <figure className="flex flex-col gap-0.5">
                <figcaption className="text-muted">What the page says, word for word</figcaption>
                <blockquote className="text-rule">“{requirement.evidence}”</blockquote>
              </figure>
            ) : null}
            {requirement.deadline ? (
              <p>
                <span className="font-semibold">Deadline:</span> {requirement.deadline}
              </p>
            ) : null}
            {requirement.renewal ? (
              <p>
                <span className="font-semibold">Renewal:</span> {requirement.renewal}
                {requirement.renewalFeeCents !== null ? `, ${formatFee(requirement.renewalFeeCents)}` : null}
              </p>
            ) : null}
            <p className="text-muted">
              Checked <LocalDate iso={requirement.checkedAt.toISOString()} />
            </p>
          </div>
        ) : (
          <div className="mt-1 flex flex-col gap-2 rounded-xl bg-check-tint/60 px-3.5 py-3 text-sm ring-1 ring-check/15">
            <p className="font-semibold">
              {cited.length ? "We found a page about this, but it doesn’t confirm the details." : "No official page confirmed this yet. That doesn’t mean it doesn’t apply."}
            </p>
            {cited.length ? <SourceLinks sources={cited} /> : null}
          </div>
        )}
      </details>

      {sourced && standing.status === "verified" ? null : (
        <details className="group">
          <summary className="flex min-h-11 w-fit cursor-pointer items-center text-sm font-semibold text-accent-ink underline underline-offset-4">
            <span className="group-open:hidden">Ask in writing</span>
            <span className="hidden group-open:inline">Hide the message</span>
          </summary>
          <div className="mt-1 text-sm">
            <WrittenInquiry inquiry={inquiry} office={requirement.whoToCall} link={best} />
          </div>
        </details>
      )}
    </article>
  );
}

export function SourceLinks({ sources }: { sources: Source[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {sources.map((source) => (
        <li key={source.id} className="flex flex-col">
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline underline-offset-2">
            {source.title}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          {source.government ? <span className="text-muted">{source.government}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function StatusChip({ sourced }: { sourced: boolean }) {
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
