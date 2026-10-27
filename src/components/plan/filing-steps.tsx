import { LocalDate } from "@/components/local-date";
import { SECTION_TITLE } from "@/components/styles";
import type { FilingLine, FilingStep } from "@/lib/rules/filing";

// The numbered self-filing steps; each fact shows the official page it came from and when it was checked
export function FilingSteps({ steps }: { steps: FilingStep[] }) {
  return (
    <section aria-labelledby="how-heading" className="flex flex-col gap-3">
      <h2 id="how-heading" className={SECTION_TITLE}>
        How to do it yourself
      </h2>
      <ol className="flex flex-col gap-2.5">
        {steps.map((step, index) => (
          <li key={step.kind} className="flex gap-3.5 rounded-2xl bg-surface px-4 py-3.5 ring-1 ring-ink/5 sm:px-5">
            <span aria-hidden="true" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-rule-tint text-sm font-bold text-rule">
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h3 className="text-[17px] font-bold leading-snug">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <ul className="flex flex-col gap-2">
                {step.lines.map((line, at) => (
                  <Line key={at} line={line} />
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Line({ line }: { line: FilingLine }) {
  return (
    <li className={`flex flex-col gap-1 ${line.unknown ? "rounded-lg bg-check-tint/60 px-3 py-2 text-check" : ""}`}>
      <span>{line.text}</span>
      {line.address ? (
        <address className="not-italic text-rule">
          {line.address.map((part) => (
            <span key={part} className="block">
              {part}
            </span>
          ))}
        </address>
      ) : null}
      {line.link ? (
        <a href={line.link.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 w-fit items-center font-semibold text-accent-ink underline underline-offset-4">
          {line.link.label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : null}
      {line.link?.checkedByHand ? (
        <span className="text-sm text-muted">
          Link checked by hand on <LocalDate iso={`${line.link.checkedByHand}T12:00:00.000Z`} />: this site doesn’t let First Sale read it automatically.
        </span>
      ) : null}
      {line.source ? (
        <span className="text-sm text-muted">
          From{" "}
          <a href={line.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2">
            {line.source.title}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          , checked{line.source.byHand ? " by hand in a browser" : ""} on{" "}
          <LocalDate iso={line.source.checkedOn.length === 10 ? `${line.source.checkedOn}T12:00:00.000Z` : line.source.checkedOn} />
        </span>
      ) : null}
    </li>
  );
}
