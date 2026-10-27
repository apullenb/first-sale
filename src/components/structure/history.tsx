import { LocalDate } from "@/components/local-date";
import type { BusinessEvent } from "@/lib/data/business-history";

// Dated record of confirmed changes, newest first, with the answers each decision was made on
export function History({ title, events, empty }: { title: string; events: BusinessEvent[]; empty: string }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {events.length ? (
        <ol className="flex flex-col rounded-2xl bg-surface px-5 ring-1 ring-ink/5">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1 border-b border-rule-tint py-3 last:border-b-0">
              <p className="text-sm font-semibold text-muted">
                <LocalDate iso={event.createdAt.toISOString()} />
              </p>
              <ul className="flex flex-col gap-0.5 text-[15px]">
                {event.summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {event.basis?.answers.length ? (
                <details className="text-sm">
                  <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent-ink underline underline-offset-4">
                    Answers it was based on
                  </summary>
                  <ul className="list-disc pl-5 text-rule">
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
        <p className="text-muted">{empty}</p>
      )}
    </section>
  );
}
