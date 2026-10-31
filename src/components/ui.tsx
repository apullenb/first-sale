import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { LocalDate } from "./local-date";
import { ACTION_ITEM, OUTSIDE_LINK, RESOURCE_LINK } from "./styles";

// Building blocks for the Onramp look. Pages compose these instead of repeating class lists.

type Tone = "accent" | "gray" | "warn" | "done" | "ai" | "pick";

const TILE: Record<Tone, string> = {
  accent: "border-accent-ring bg-accent-tint text-accent",
  gray: "border-line bg-wash text-muted",
  warn: "border-check-ring bg-check-tint text-check",
  done: "border-done/25 bg-done-tint text-done",
  ai: "border-ai/20 bg-ai-tint text-ai",
  pick: "border-pick-ring bg-pick-tint text-pick",
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
  pick: "border-pick-ring bg-pick-tint text-pick-ink",
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

// Something the owner must do: a to-do icon, what and why, then its one main button
export function ActionItem({
  title,
  kicker = "To do",
  icon = "todo",
  headingLevel = 2,
  id,
  action,
  children,
}: {
  title: ReactNode;
  kicker?: ReactNode;
  icon?: IconName;
  headingLevel?: 2 | 3;
  id?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section aria-labelledby={id} className={ACTION_ITEM}>
      <div className="flex items-start gap-3">
        <IconTile icon={icon} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-accent">{kicker}</p>
          <Heading id={id} className="text-[17px] font-bold leading-snug">
            {title}
          </Heading>
        </div>
      </div>
      {children ? <div className="flex flex-col gap-2 text-rule">{children}</div> : null}
      {action ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{action}</div> : null}
    </section>
  );
}

export const siteName = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// Something the owner must do, or should see, on another site: always this look, with where it goes
export function OutsideLink({ href, cue = "do", children }: { href: string; cue?: "do" | "recommended" | "see"; children: ReactNode }) {
  const site = siteName(href);
  const words = cue === "recommended" ? `Recommended · ${site}` : cue === "see" ? `On ${site}` : `Do this on ${site}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={OUTSIDE_LINK}>
      <Icon name="external" className="text-accent" />
      <span className="grid min-w-0 gap-px">
        <b className="font-bold leading-snug">{children}</b>
        <small className="break-all text-[13px] font-semibold text-accent">{words}</small>
      </span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

// Optional reading: sources, "learn more" and reference pages, small and muted
export function ResourceLink({ href, external = true, className = "", children }: { href: string; external?: boolean; className?: string; children: ReactNode }) {
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={`${RESOURCE_LINK} ${className}`}>
      <Icon name="book" size="xs" className="text-faint" />
      <span className="min-w-0 break-words">{children}</span>
      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </a>
  );
}

const day = (iso: string) => (iso.length === 10 ? `${iso}T12:00:00.000Z` : iso);

// "From <page>, checked on <date>": where a fact came from
export function Source({ url, title, checkedOn, byHand, lead = "From" }: { url: string; title: string; checkedOn?: string; byHand?: boolean; lead?: string }) {
  return (
    <small className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
      {lead ? <span>{lead}</span> : null}
      <ResourceLink href={url}>{title}</ResourceLink>
      {checkedOn ? (
        <span>
          , checked{byHand ? " by hand in a browser" : ""} on <LocalDate iso={day(checkedOn)} />
        </span>
      ) : null}
    </small>
  );
}

// Between two ways of doing the same thing
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[13px] font-bold uppercase tracking-[0.08em] text-muted" role="separator" aria-label="Or">
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      <span aria-hidden="true">Or</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}

// One labeled way of doing it; options sharing a name open one at a time
export function ChoiceOption({
  name,
  letter,
  title,
  summary,
  tag,
  open,
  children,
}: {
  name: string;
  letter: string;
  title: ReactNode;
  summary?: ReactNode;
  tag?: ReactNode;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details name={name} open={open} className="group/choice rounded-[14px] border-[1.5px] border-line bg-surface shadow-soft open:border-accent-ring open:shadow-card">
      <summary className="flex min-h-[64px] cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-accent-ring bg-accent-tint font-display text-lg text-accent">
          {letter}
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <b className="text-[17px] font-bold leading-snug">
              <span className="sr-only">Option {letter}: </span>
              {title}
            </b>
            {tag}
          </span>
          {summary ? <small className="text-[14.5px] text-muted">{summary}</small> : null}
        </span>
        <span className="hidden text-sm font-semibold text-accent group-open/choice:hidden sm:inline">Choose</span>
        <Icon name="chevron" className="text-faint transition-transform group-open/choice:rotate-90" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-line px-4 pt-4 pb-5">{children}</div>
    </details>
  );
}

// Numbered steps inside one way of doing it
export function NumberedSteps({ label, steps }: { label: string; steps: { title: ReactNode; body: ReactNode; done?: boolean }[] }) {
  return (
    <ol aria-label={label} className="grid gap-2.5">
      {steps.map((step, index) => (
        <li key={index} className="grid grid-cols-[30px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[34px_minmax(0,1fr)] sm:gap-3">
          <span
            aria-hidden="true"
            className={`grid size-[30px] place-items-center rounded-full border font-display text-base ${step.done ? "border-done/25 bg-done-tint text-done" : "border-accent-ring bg-accent-tint text-accent"}`}
          >
            {step.done ? <Icon name="check" size="sm" strokeWidth={2.4} /> : index + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-2 pt-0.5">
            <h4 className="font-bold leading-snug">
              <span className="sr-only">Step {index + 1}{step.done ? " (done)" : ""}: </span>
              {step.title}
            </h4>
            {step.body}
          </div>
        </li>
      ))}
    </ol>
  );
}
