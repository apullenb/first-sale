import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { IconTile } from "@/components/ui";
import type { BusinessEvent } from "@/lib/data/business-history";

// Dated record of confirmed changes, newest first, with the answers each decision was made on
export function History({ title, events, empty }: { title: string; events: BusinessEvent[]; empty: string }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
        <IconTile icon="clock" />
        <h2 className="min-w-0 flex-1 text-base font-bold">{title}</h2>
      </div>
      {events.length ? (
        <ol className="flex flex-col px-5">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1 border-b border-line py-3.5 last:border-b-0">
              <p className="text-sm font-semibold text-muted">
                <LocalDate iso={event.createdAt.toISOString()} />
              </p>
              <ul className="flex flex-col gap-0.5 text-[15px]">
                {event.summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {event.basis?.answers.length ? (
                <details className="group/basis text-sm">
                  <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 font-semibold text-accent hover:text-accent-ink [&::-webkit-details-marker]:hidden">
                    <Icon name="chevron" size="sm" className="transition-transform group-open/basis:rotate-90 motion-reduce:transition-none" />
                    Answers it was based on
                  </summary>
                  <ul className="list-disc pl-5 text-rule marker:text-faint">
                    {event.basis.answers.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-4 text-muted">{empty}</p>
      )}
    </section>
  );
}
