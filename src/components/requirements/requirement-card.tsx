import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { TOPIC_ICONS } from "@/components/plan/step-row";
import { Chip, IconTile } from "@/components/ui";
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
  const best = cited[0] ? { title: cited[0].title, url: cited[0].url } : null;

  return (
    <article className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-start gap-3">
        <IconTile icon={TOPIC_ICONS[requirement.topic]} tone="gray" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-[17.5px] font-bold leading-snug">{requirement.title}</h3>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="pin" size="xs" className="text-faint" />
              {LEVELS[requirement.level]}: {jurisdiction}
            </span>
            {requirement.feeCents !== null ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="coins" size="xs" className="text-faint" />
                {requirement.feeCents === 0 ? "Free" : `Fee ${formatFee(requirement.feeCents)}`}
              </span>
            ) : null}
            {requirement.timing === "later" ? (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="calendar" size="xs" className="text-faint" />
                Later, not before your first sale
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RequirementStatusChip status={standing.status} />
        <StatusChip sourced={sourced} />
      </div>
      <p className="text-rule">{requirement.whyItApplies}</p>

      {standing.conditions.length ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-line bg-soft px-3.5 py-3 text-[15px]">
          <Icon name="branch" size="sm" className="mt-0.5 text-faint" />
          <div className="min-w-0">
            <p className="font-semibold">It depends on</p>
            <ul className="mt-0.5 flex list-disc flex-col gap-0.5 pl-5 marker:text-faint">
              {standing.conditions.map((condition, index) => (
                <li key={index}>{condition}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {standing.alreadyHave ? (
        <p className="flex items-start gap-2.5 rounded-xl border border-done/25 bg-done-tint px-3.5 py-3 text-[15px] text-done">
          <Icon name="check" size="sm" className="mt-0.5" />
          <span>{standing.alreadyHave}</span>
        </p>
      ) : null}
      {requirement.agency ? (
        <p className="flex items-start gap-2 text-sm text-rule">
          <Icon name="office" size="sm" className="text-faint" />
          <span>
            <span className="font-semibold">Who handles it:</span> {requirement.agency}
          </span>
        </p>
      ) : null}
      {requirement.needsProfessional ? <p className="text-sm text-muted">A lawyer or accountant can help you with this one.</p> : null}

      <div className="flex flex-wrap gap-x-5 border-t border-line pt-1">
        <More label={sourced ? "Show the source" : "What the official pages say"} open="Hide the source">
          {sourced ? (
            <div className="flex flex-col gap-2.5 text-sm">
              <SourceLinks sources={cited} />
              {requirement.evidence ? (
                <figure className="flex flex-col gap-1">
                  <figcaption className="text-muted">What the page says, word for word</figcaption>
                  <blockquote className="border-l-[3px] border-accent-ring py-1 pl-3.5 text-[15px] italic text-rule">“{requirement.evidence}”</blockquote>
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
            <div className="flex flex-col gap-2 rounded-xl border border-check-ring bg-check-tint px-3.5 py-3 text-sm text-check">
              <p className="font-semibold">
                {cited.length ? "We found a page about this, but it doesn’t confirm the details." : "No official page confirmed this yet. That doesn’t mean it doesn’t apply."}
              </p>
              {cited.length ? <SourceLinks sources={cited} /> : null}
            </div>
          )}
        </More>
        {sourced && standing.status === "verified" ? null : (
          <More label="Ask in writing" open="Hide the message">
            <div className="text-[15px]">
              <WrittenInquiry inquiry={inquiry} office={requirement.whoToCall} link={best} />
            </div>
          </More>
        )}
      </div>
    </article>
  );
}

// A small fold inside a card; the summary names what's inside
function More({ label, open, children }: { label: string; open: string; children: ReactNode }) {
  return (
    <details className="group/more w-full open:pb-2 sm:w-auto sm:open:w-full">
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-accent hover:text-accent-ink [&::-webkit-details-marker]:hidden">
        <Icon name="chevron" size="sm" className="transition-transform group-open/more:rotate-90 motion-reduce:transition-none" />
        <span className="group-open/more:hidden">{label}</span>
        <span className="hidden group-open/more:inline">{open}</span>
      </summary>
      <div className="mt-1">{children}</div>
    </details>
  );
}

export function SourceLinks({ sources }: { sources: Source[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {sources.map((source) => (
        <li key={source.id}>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-1.5 transition hover:border-line-strong motion-reduce:transition-none"
          >
            <Icon name="globe" size="sm" className="text-accent" />
            <span className="min-w-0 flex-1">
              <b className="block font-semibold leading-snug text-ink">{source.title}</b>
              {source.government ? <small className="block text-[13.5px] text-muted">{source.government}</small> : null}
            </span>
            <Icon name="external" size="xs" className="text-faint" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function StatusChip({ sourced }: { sourced: boolean }) {
  return sourced ? (
    <Chip icon="link">Official source</Chip>
  ) : (
    <Chip tone="warn" icon="info">
      Needs verification
    </Chip>
  );
}
