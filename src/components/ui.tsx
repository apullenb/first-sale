import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// Building blocks for the Onramp look. Pages compose these instead of repeating class lists.

type Tone = "accent" | "gray" | "warn" | "done" | "ai";

const TILE: Record<Tone, string> = {
  accent: "border-accent-ring bg-accent-tint text-accent",
  gray: "border-line bg-wash text-muted",
  warn: "border-check-ring bg-check-tint text-check",
  done: "border-done/25 bg-done-tint text-done",
  ai: "border-ai/20 bg-ai-tint text-ai",
};

export function IconTile({ icon, tone = "accent", big = false }: { icon: IconName; tone?: Tone; big?: boolean }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center border ${big ? "size-11 rounded-xl" : "size-9 rounded-[10px]"} ${TILE[tone]}`}>
      <Icon name={icon} size={big ? "lg" : "md"} />
    </span>
  );
}

// A ruled index card: an optional header row with an icon tile, then the body
export function Card({
  title,
  icon,
  tone,
  action,
  headingLevel = 2,
  id,
  className = "",
  bodyClassName = "",
  children,
}: {
  title?: ReactNode;
  icon?: IconName;
  tone?: Tone;
  action?: ReactNode;
  headingLevel?: 2 | 3;
  id?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={title ? id : undefined} className={`overflow-hidden rounded-[14px] border border-line bg-surface shadow-card ${className}`}>
      {title ? (
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          {icon ? <IconTile icon={icon} tone={tone} /> : null}
          <Heading id={id} className="min-w-0 flex-1 text-base font-bold">
            {title}
          </Heading>
          {action}
        </div>
      ) : null}
      <div className={`flex flex-col gap-3 px-5 pb-5 ${title ? "pt-4" : "pt-5"} ${bodyClassName}`}>{children}</div>
    </section>
  );
}

const CHIP: Record<Tone | "plain", string> = {
  plain: "border-line bg-surface text-rule",
  accent: "border-accent-ring bg-accent-tint text-accent-ink",
  gray: "border-line bg-wash text-rule",
  warn: "border-check-ring bg-check-tint text-check",
  done: "border-done/25 bg-done-tint text-done",
  ai: "border-ai/20 bg-ai-tint text-ai-ink",
};

export function Chip({ icon, tone = "plain", children }: { icon?: IconName; tone?: Tone | "plain"; children: ReactNode }) {
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[13.5px] font-semibold leading-none ${CHIP[tone]}`}>
      {icon ? <Icon name={icon} size="xs" /> : null}
      {children}
    </span>
  );
}

// A small fact with an icon, like "20 min" or "Free"
export function Fact({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[15px] text-rule shadow-soft">
      <Icon name={icon} size="sm" className="text-accent" />
      {children}
    </span>
  );
}

// An expandable card: a one-line summary that opens to the details
export function Fold({ title, summary, icon, open, children }: { title: ReactNode; summary?: ReactNode; icon?: IconName; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-[14px] border border-line bg-surface shadow-soft">
      <summary className="flex min-h-[58px] cursor-pointer list-none items-center gap-3 px-[18px] py-3.5 [&::-webkit-details-marker]:hidden">
        {icon ? <IconTile icon={icon} tone="gray" /> : null}
        <span className="grid min-w-0 flex-1 gap-px">
          <b className="text-[16.5px] font-bold">{title}</b>
          {summary ? <small className="text-[14.5px] text-muted">{summary}</small> : null}
        </span>
        <Icon name="chevron" className="text-faint transition-transform group-open:rotate-90" />
      </summary>
      <div className="flex flex-col gap-2.5 px-[18px] pb-[18px]">{children}</div>
    </details>
  );
}

export function Note({ icon = "info", tone = "warn", children }: { icon?: IconName; tone?: "warn" | "quiet"; children: ReactNode }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[15px] ${
        tone === "warn" ? "border-check-ring bg-check-tint text-check" : "border-line bg-surface text-muted shadow-soft"
      }`}
    >
      <Icon name={icon} className={`mt-0.5 ${tone === "warn" ? "" : "text-faint"}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// The kicker, serif headline and lead line at the top of a page
export function PageHead({ kicker, title, lead, children }: { kicker?: ReactNode; title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      {kicker ? <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">{kicker}</p> : null}
      <h1 className="font-display text-[32px] leading-[1.15] tracking-[-0.01em] sm:text-[38px]">{title}</h1>
      {lead ? <p className="max-w-2xl text-lg text-muted">{lead}</p> : null}
      {children}
    </div>
  );
}

// A handwritten margin note; use one or two in the whole app
export function Hand({ children }: { children: ReactNode }) {
  return <span className="font-hand text-2xl leading-none text-accent">{children}</span>;
}
