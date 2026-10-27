import Link from "next/link";
import type { PlanStep } from "@/lib/data/plan";
import { formatFee } from "@/lib/documents/startup-plan";
import { TOPIC_LABELS } from "@/lib/labels";

export function PlanProgress({ done, total }: { done: number; total: number }) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-lg">
        <span className="font-display text-2xl font-bold">
          {done} of {total}
        </span>{" "}
        {total === 1 ? "step" : "steps"} done
      </p>
      <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-rule-tint">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// The first step whose earlier steps are all done
export function NextStep({ step }: { step: PlanStep }) {
  const facts = [TOPIC_LABELS[step.topic], step.agency, step.feeCents === null ? null : `Fee: ${formatFee(step.feeCents)}`].filter(Boolean);
  return (
    <section aria-labelledby="next-step-heading" className="flex flex-col gap-1.5 rounded-2xl bg-accent-tint p-5">
      <h2 id="next-step-heading" className="text-xs font-bold uppercase tracking-wider text-accent-ink">
        Your next step
      </h2>
      <Link
        href={`/checklist/${step.id}`}
        className="flex min-h-11 w-fit items-center font-display text-2xl font-bold leading-snug text-accent-ink underline underline-offset-4"
      >
        {step.title}
      </Link>
      {facts.length ? <p className="text-rule">{facts.join(" · ")}</p> : null}
      {step.simulated ? <p className="text-sm font-semibold text-check">Practice mode: built-in rules suggested this step, not real research.</p> : null}
    </section>
  );
}
