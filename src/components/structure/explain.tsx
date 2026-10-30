import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { RecommendedBadge } from "@/components/recommended";
import type { StructureExample } from "@/data/structure-examples";
import { factSource } from "@/lib/structure/facts";
import type { Reason } from "@/lib/structure/suggest";
import { SourceLink } from "./source-link";

// Shared by the guide and the questions; no server-only imports, so client components can use it

export function RecommendedTag() {
  return <RecommendedBadge />;
}

const SUMMARY =
  "relative z-10 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[15px] font-semibold text-accent hover:text-accent-ink [&::-webkit-details-marker]:hidden";

function Disclosure({ label, group, children }: { label: string; group: "why" | "ex"; children: ReactNode }) {
  const open = group === "why" ? "group-open/why:rotate-90" : "group-open/ex:rotate-90";
  return (
    <details className={group === "why" ? "group/why" : "group/ex"}>
      <summary className={SUMMARY}>
        <Icon name="chevron" size="sm" className={`transition-transform motion-reduce:transition-none ${open}`} />
        {label}
      </summary>
      <div className="relative z-10 mt-1 flex flex-col gap-3 rounded-xl border border-line bg-soft px-4 py-3">{children}</div>
    </details>
  );
}

export function ExplainWhy({ children }: { children: ReactNode }) {
  return (
    <Disclosure label="Explain why" group="why">
      {children}
    </Disclosure>
  );
}

export function ReasonList({ reasons }: { reasons: Reason[] }) {
  return (
    <ul className="flex flex-col gap-2 text-[15px]">
      {reasons.map((reason) => (
        <li key={reason.text} className="flex items-start gap-2">
          <Icon name={reason.caveat ? "info" : "check"} size="sm" className={`mt-0.5 shrink-0 ${reason.caveat ? "text-check" : "text-accent"}`} />
          <span>
            {reason.caveat ? <span className="sr-only">Keep in mind: </span> : null}
            {reason.text}
            {reason.fact ? <SourceLink fact={reason.fact} /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Made-up scenarios, labeled as examples rather than advice
export function ShowExamples({ examples }: { examples: StructureExample[] }) {
  if (!examples.length) return null;
  return (
    <Disclosure label="Show me examples" group="ex">
      <p className="text-sm text-muted">Made-up businesses, to show how this works. Not advice for your situation.</p>
      {examples.map((example) => (
        <ExampleCard key={example.id} example={example} />
      ))}
    </Disclosure>
  );
}

function ExampleCard({ example }: { example: StructureExample }) {
  // One link per official page the example rests on
  const pages = [...new Map(example.facts.map((fact) => [factSource(fact).id, factSource(fact)])).values()];
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3.5 shadow-soft">
      <p className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-wash px-1.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-muted">Example</span>
        <span className="font-bold leading-snug">{example.title}</span>
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] marker:text-faint">
        {example.story.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="border-l-[3px] border-accent-ring pl-3 text-[15px] text-rule">{example.takeaway}</p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
        <span>Based on</span>
        {pages.map((page) => (
          <a key={page.id} href={page.url} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 font-semibold text-accent-ink underline underline-offset-2">
            <Icon name="link" size="xs" />
            {page.title}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ))}
      </p>
    </article>
  );
}
