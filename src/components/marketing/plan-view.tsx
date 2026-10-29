import type { ReactNode } from "react";
import { ActorChip } from "@/components/actor-chip";
import { Icon, type IconName } from "@/components/icons";
import { ALERT } from "@/components/styles";
import { Chip } from "@/components/ui";
import { PLATFORM_DATA } from "@/data/marketing-platforms";
import { type MarketingPlan, type PlatformRole, ROLE_LABELS } from "@/lib/marketing/types";
import { BOX, InfoRows } from "./pieces";

const ROLE_TONES: Record<PlatformRole, "accent" | "plain" | "gray" | "ai"> = {
  main: "accent",
  support: "plain",
  later: "gray",
  suggested: "ai",
};

const ROLE_NOTES: Partial<Record<PlatformRole, string>> = {
  later: "Not in your steps yet. Start it once your main places are going.",
  suggested: "You didn’t pick this one. Add it in your answers to get steps for it.",
};

function Part({ id, icon, title, children }: { id: string; icon: IconName; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2.5 border-t border-line pt-5">
      <h3 id={id} className="flex items-center gap-2.5 font-display text-[19px] leading-snug">
        <Icon name={icon} className="text-accent" />
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
      {plan.summary ? <p className="border-l-[3px] border-accent-ring pl-4 font-display text-xl leading-snug">{plan.summary}</p> : null}
      {plan.flags.length ? (
        <ul className={`${ALERT} flex list-disc flex-col gap-1 pl-8`}>
          {plan.flags.map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      ) : null}

      {plan.goals.length ? (
        <Part id="plan-goals" icon="flag" title="Goals for the first three months">
          <ul className="grid gap-2 sm:grid-cols-2">
            {plan.goals.map((goal, index) => (
              <li key={index} className={`${BOX} px-4 py-3`}>
                <p className="font-semibold">{goal.goal}</p>
                {goal.measure ? <p className="mt-0.5 text-[15px] text-muted">How you’ll know: {goal.measure}</p> : null}
              </li>
            ))}
          </ul>
        </Part>
      ) : null}

      <Part id="plan-audience" icon="users" title="Who you’re reaching">
        <InfoRows
          rows={[
            { label: "Who", value: plan.audience.who },
            { label: "Where they are", value: plan.audience.where },
            { label: "What they care about", value: plan.audience.cares },
          ].filter((row) => row.value)}
        />
      </Part>

      {plan.platforms.length ? (
        <Part id="plan-platforms" icon="globe" title="Where you’ll show up">
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {plan.platforms.map((entry) => (
              <li key={entry.platform} className={`flex flex-col gap-1.5 rounded-xl border bg-surface px-4 py-3 shadow-soft ${entry.role === "main" ? "border-accent-ring" : "border-line"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{PLATFORM_DATA[entry.platform].name}</span>
                  <Chip tone={ROLE_TONES[entry.role]}>{ROLE_LABELS[entry.role]}</Chip>
                </div>
                {entry.why ? <p className="text-[15px] text-rule">{entry.why}</p> : null}
                {entry.cadence ? (
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Icon name="clock" size="sm" className="text-accent" />
                    How often: {entry.cadence}
                  </p>
                ) : null}
                {ROLE_NOTES[entry.role] ? <p className="text-sm text-muted">{ROLE_NOTES[entry.role]}</p> : null}
              </li>
            ))}
          </ul>
        </Part>
      ) : null}

      {plan.themes.length ? (
        <Part id="plan-themes" icon="lightbulb" title="What to post about">
          <ul className="flex flex-col gap-2">
            {plan.themes.map((theme, index) => (
              <li key={index} className={`${BOX} px-4 py-3`}>
                <p className="font-semibold">{theme.title}</p>
                {theme.idea ? <p className="text-[15px] text-rule">{theme.idea}</p> : null}
                {theme.examples.length ? (
                  <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-[15px] text-muted marker:text-accent">
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
        <Part id="plan-rhythm" icon="calendar" title="Your weekly rhythm">
          <p className="text-rule">{plan.rhythm}</p>
        </Part>
      ) : null}

      {plan.firstActions.length ? (
        <Part id="plan-first" icon="checklist" title="First things to do">
          <ol className="flex flex-col gap-2.5">
            {plan.firstActions.map((action, index) => (
              <li key={index} className="flex items-start gap-3">
                <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full border border-accent-ring bg-accent-tint font-display text-[13px] text-accent">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="sr-only">{index + 1}. </span>
                  <span className="font-semibold">{action.title}.</span> <span className="text-rule">{action.why}</span>
                </span>
              </li>
            ))}
          </ol>
        </Part>
      ) : null}
    </div>
  );
}
