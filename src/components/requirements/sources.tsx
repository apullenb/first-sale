import { Chip, ResourceLink } from "@/components/ui";
import type { sources } from "@/db/schema";

type Source = typeof sources.$inferSelect;

// Official pages a requirement was checked against, each opening in a new tab
export function SourceLinks({ sources }: { sources: Source[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {sources.map((source) => (
        <li key={source.id} className="flex flex-col">
          <ResourceLink href={source.url} className="w-fit">
            {source.title}
          </ResourceLink>
          {source.government ? <small className="pl-5 text-[13.5px] text-muted">{source.government}</small> : null}
        </li>
      ))}
    </ul>
  );
}

// Shown only when an official page backs it; First Sale's own decisions carry their reason instead
export function StatusChip({ sourced }: { sourced: boolean }) {
  return sourced ? <Chip icon="book">Official source</Chip> : null;
}
