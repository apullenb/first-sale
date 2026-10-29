import { Icon } from "@/components/icons";

// A small link icon to the official page a result comes from, with its name on hover or focus
export function SourceButton({ url, title }: { url: string; title: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/src relative inline-grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-muted transition after:absolute after:-inset-1 hover:border-accent-ring hover:bg-accent-tint hover:text-accent motion-reduce:transition-none"
    >
      <Icon name="link" size="sm" />
      <span className="sr-only">Source: {title} (opens in a new tab)</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 bottom-full z-20 mb-2 hidden w-max max-w-[260px] rounded-[9px] bg-ink px-2.5 py-2 text-left text-[13.5px] font-semibold leading-snug text-white shadow-lift group-hover/src:block group-focus-visible/src:block"
      >
        Source: {title}
      </span>
    </a>
  );
}
