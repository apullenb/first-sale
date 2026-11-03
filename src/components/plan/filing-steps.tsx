import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { OutsideLink, ResourceLink, Source } from "@/components/ui";
import type { FilingLine, FilingStep } from "@/lib/rules/filing";

const day = (iso: string) => (iso.length === 10 ? `${iso}T12:00:00.000Z` : iso);

// The numbered self-filing steps; each checked fact names the official page it came from
export function FilingSteps({ steps, extras = {}, label = "How to do it yourself" }: { steps: FilingStep[]; extras?: Partial<Record<FilingStep["kind"], ReactNode>>; label?: string }) {
  return (
    <ol aria-label={label} className="grid gap-2.5">
      {steps.map((step, index) => (
        <li key={step.kind} className="grid grid-cols-[30px_minmax(0,1fr)] gap-2.5 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[34px_minmax(0,1fr)] sm:gap-3 sm:p-3.5">
          <span aria-hidden="true" className="grid size-[30px] place-items-center rounded-full border border-accent-ring bg-accent-tint font-display text-base text-accent">
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-2 pt-0.5">
            <h3 className="font-bold leading-snug">
              <span className="sr-only">Step {index + 1}: </span>
              {step.title}
            </h3>
            <FilingLines lines={step.lines} />
            {extras[step.kind] ? <div className="mt-1 flex flex-col gap-3">{extras[step.kind]}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function FilingLines({ lines }: { lines: FilingLine[] }) {
  return (
    <ul className="grid gap-2">
      {lines.map((line, at) => (
        <Line key={at} line={line} />
      ))}
    </ul>
  );
}

function Line({ line }: { line: FilingLine }) {
  const body = (
    <>
      <p>{line.text}</p>
      {line.address ? (
        <address className="mt-1 block not-italic text-rule">
          {line.address.map((part) => (
            <span key={part} className="block">
              {part}
            </span>
          ))}
        </address>
      ) : null}
      {line.link ? (
        <div className="mt-2 flex flex-col items-start gap-1">
          {line.link.quiet ? <ResourceLink href={line.link.url}>{line.link.label}</ResourceLink> : <OutsideLink href={line.link.url}>{line.link.label}</OutsideLink>}
          {line.link.checkedByHand ? (
            <small className="text-sm text-muted">
              Link checked by hand on <LocalDate iso={day(line.link.checkedByHand)} />: this site doesn’t let SnapStart read it automatically.
            </small>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (!line.source && !line.unknown) return <li className="text-[15px] leading-relaxed">{body}</li>;
  return (
    <li className={`flex items-start gap-2.5 rounded-xl border px-2.5 py-2.5 text-[15px] leading-snug sm:gap-3 sm:px-3 ${line.unknown ? "border-check-ring bg-check-tint text-check" : "border-line bg-soft"}`}>
      <span aria-hidden="true" className={`mt-px grid size-[22px] shrink-0 place-items-center rounded-full text-white ${line.unknown ? "bg-check text-[13px] font-bold" : "bg-accent"}`}>
        {line.unknown ? "!" : <Icon name="check" size="xs" strokeWidth={2.6} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {body}
        {line.source ? <Source url={line.source.url} title={line.source.title} checkedOn={line.source.checkedOn} byHand={line.source.byHand} /> : null}
      </div>
    </li>
  );
}
