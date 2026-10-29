import type { ReactNode } from "react";
import { ActorChip } from "@/components/actor-chip";
import { ALERT } from "@/components/styles";
import { PLATFORM_DATA } from "@/data/marketing-platforms";
import { type MarketingPlan, type PlatformRole, ROLE_LABELS } from "@/lib/marketing/types";

const ROLE_STYLES: Record<PlatformRole, string> = {
  main: "bg-accent text-white",
  support: "bg-accent-tint text-accent-ink",
  later: "bg-rule-tint text-rule",
  suggested: "bg-ai-tint text-ai",
};

const ROLE_NOTES: Partial<Record<PlatformRole, string>> = {
  later: "Not in your steps yet. Start it once your main places are going.",
  suggested: "You didn’t pick this one. Add it in your answers to get steps for it.",
};

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="font-display text-lg font-bold">
        {title}
      </h3>
      {children}
    </section>
  );
}

// The drafted plan, read-only; the owner approves it or writes it again
export function PlanView({ plan }: { plan: MarketingPlan }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {plan.simulated ? <ActorChip actor="rule" /> : <ActorChip actor="ai" />}
        {plan.simulated ? "Drafted in practice mode, from a template" : "Drafted by AI from your answers"}, then checked by rules: platforms you said no to are never in it.
      </p>
      {plan.summary ? <p className="text-lg">{plan.summary}</p> : null}
      {plan.flags.length ? (
        <ul className={`${ALERT} flex list-disc flex-col gap-1 pl-8`}>
          {plan.flags.map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      ) : null}

      {plan.goals.length ? (
        <Part id="plan-goals" title="Goals for the first three months">
          <ul className="flex flex-col gap-2">
            {plan.goals.map((goal, index) => (
              <li key={index} className="rounded-xl bg-ground px-4 py-3">
                <p className="font-semibold">{goal.goal}</p>
                {goal.measure ? <p className="text-[15px] text-rule">How you’ll know: {goal.measure}</p> : null}
              </li>
            ))}
          </ul>
        </Part>
      ) : null}

      <Part id="plan-audience" title="Who you’re reaching">
        <dl className="grid gap-x-4 gap-y-1.5 text-[15px] sm:grid-cols-[auto_1fr]">
          {[
            ["Who", plan.audience.who],
            ["Where they are", plan.audience.where],
            ["What they care about", plan.audience.cares],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="font-semibold">{label}</dt>
                <dd className="text-rule">{value}</dd>
              </div>
            ))}
        </dl>
      </Part>

      {plan.platforms.length ? (
        <Part id="plan-platforms" title="Where you’ll show up">
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {plan.platforms.map((entry) => (
              <li key={entry.platform} className="flex flex-col gap-1.5 rounded-xl bg-ground px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{PLATFORM_DATA[entry.platform].name}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ROLE_STYLES[entry.role]}`}>{ROLE_LABELS[entry.role]}</span>
                </div>
                {entry.why ? <p className="text-[15px] text-rule">{entry.why}</p> : null}
                {entry.cadence ? <p className="text-sm font-semibold">How often: {entry.cadence}</p> : null}
                {ROLE_NOTES[entry.role] ? <p className="text-sm text-muted">{ROLE_NOTES[entry.role]}</p> : null}
              </li>
            ))}
          </ul>
        </Part>
      ) : null}

      {plan.themes.length ? (
        <Part id="plan-themes" title="What to post about">
          <ul className="flex flex-col gap-2">
            {plan.themes.map((theme, index) => (
              <li key={index} className="rounded-xl bg-ground px-4 py-3">
                <p className="font-semibold">{theme.title}</p>
                {theme.idea ? <p className="text-[15px] text-rule">{theme.idea}</p> : null}
                {theme.examples.length ? (
                  <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-[15px] text-rule">
                    {theme.examples.map((example, at) => (
                      <li key={at}>{example}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </Part>
      ) : null}

      {plan.rhythm ? (
        <Part id="plan-rhythm" title="Your weekly rhythm">
          <p className="text-rule">{plan.rhythm}</p>
        </Part>
      ) : null}

      {plan.firstActions.length ? (
        <Part id="plan-first" title="First things to do">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            {plan.firstActions.map((action, index) => (
              <li key={index}>
                <span className="font-semibold">{action.title}.</span> <span className="text-rule">{action.why}</span>
              </li>
            ))}
          </ol>
        </Part>
      ) : null}
    </div>
  );
}
