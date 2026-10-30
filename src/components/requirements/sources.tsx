import { Icon } from "@/components/icons";
import { Chip } from "@/components/ui";
import type { sources } from "@/db/schema";

type Source = typeof sources.$inferSelect;

// Official pages a requirement was checked against, each opening in a new tab
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

// Shown only when an official page backs it; First Sale's own decisions carry their reason instead
export function StatusChip({ sourced }: { sourced: boolean }) {
  return sourced ? <Chip icon="link">Official source</Chip> : null;
}
