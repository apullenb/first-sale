"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { draftMarketingPlanAction, saveMarketingIntakeAction } from "@/app/(app)/marketing/actions";
import { ChoiceCards, ChoiceChips } from "@/components/intake/choices";
import { AI_BUTTON, ALERT, INPUT, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";
import { MARKETING_PLATFORMS, type MarketingPlatformId, PLATFORM_DATA } from "@/data/marketing-platforms";
import { DONE_ALREADY, DONE_LABELS, type DoneAlready, MAX_DONE_NOTE, marketingIntakeSchema, SKILL_QUESTIONS, type StoredIntake } from "@/lib/marketing/intake";
import { PlanProgress, useFinishAndRefresh } from "./ai-progress";

const EMPTY: StoredIntake = { include: [], have: [], exclude: [], social: null, seo: null, content: null, done: [], doneNote: "" };
const SCREENS = ["Where you want to show up", "What you already know", "What you’ve tried so far"] as const;
const ON = "border-accent bg-accent-tint";
const OFF = "border-field bg-surface hover:border-muted";

function Why({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="text-[15px] text-rule">
      <span className="font-semibold">Why we ask:</span> {children}
    </p>
  );
}

// Saved answers, with a way back into the questions
export function MarketingAnswers({ intake, hasPlan, known }: { intake: StoredIntake; hasPlan: boolean; known: Props["known"] }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <MarketingIntakeForm initial={intake} hasPlan={hasPlan} known={known} onDone={() => setEditing(false)} />;
  const names = (ids: MarketingPlatformId[]) => ids.map((id) => PLATFORM_DATA[id].name).join(", ") || "None";
  const level = (area: "social" | "seo" | "content") => {
    const question = SKILL_QUESTIONS.find((each) => each.area === area)!;
    return intake[area] ? question.options[intake[area]].label : "Not answered";
  };
  const rows = [
    { label: "Use", value: names(intake.include) },
    { label: "Already have", value: names(intake.have) },
    { label: "Never suggest", value: names(intake.exclude) },
    { label: "Social media", value: level("social") },
    { label: "SEO", value: level("seo") },
    { label: "Making content", value: level("content") },
    { label: "Done so far", value: intake.done.map((each) => DONE_LABELS[each]).join(", ") || "Not answered" },
    ...(intake.doneNote ? [{ label: "Also", value: intake.doneNote }] : []),
  ];
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-x-4 gap-y-1.5 text-[15px] sm:grid-cols-[auto_1fr]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="font-semibold">{row.label}</dt>
            <dd className="text-rule">{row.value}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className={`${SECONDARY} w-fit`} onClick={() => setEditing(true)}>
        Change my answers
      </button>
    </div>
  );
}

// Every question on one screen is answered
function screenReady(screen: number, answers: StoredIntake): boolean {
  if (screen === 1) return Boolean(answers.social && answers.seo && answers.content);
  if (screen === 2) return answers.done.length > 0;
  return true;
}

interface Props {
  initial: StoredIntake | null;
  // A plan exists, so saving can skip writing a new one
  hasPlan: boolean;
  // What First Sale already knows, so it isn't asked again
  known: { label: string; value: string }[];
  // Editing saved answers: closes the form after a cancel or a save without a new plan
  onDone?: () => void;
}

// The marketing questions, a few at a time. Finishing saves the answers and writes the plan behind a progress screen.
export function MarketingIntakeForm({ initial, hasPlan, known, onDone }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<StoredIntake>(initial ?? EMPTY);
  const [screen, setScreen] = useState(0);
  const [phase, setPhase] = useState<"form" | "saving" | "writing" | "finished">("form");
  const [error, setError] = useState<string | null>(null);
  const [, startRefresh] = useTransition();
  const { finish } = useFinishAndRefresh();
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useLayoutEffect(() => () => setError(null), []);
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = true;
  }, [screen]);

  const update = (patch: Partial<StoredIntake>) => setAnswers((current) => ({ ...current, ...patch }));

  function toggleInclude(id: MarketingPlatformId) {
    const on = answers.include.includes(id);
    update({
      include: on ? answers.include.filter((each) => each !== id) : [...answers.include, id],
      have: on ? answers.have.filter((each) => each !== id) : answers.have,
      exclude: answers.exclude.filter((each) => each !== id),
    });
  }

  function toggleIn(field: "have" | "exclude", id: MarketingPlatformId) {
    const list = answers[field];
    update({ [field]: list.includes(id) ? list.filter((each) => each !== id) : [...list, id] });
  }

  function toggleDone(value: DoneAlready) {
    const list = answers.done;
    if (list.includes(value)) update({ done: list.filter((each) => each !== value) });
    else update({ done: value === "none" ? ["none"] : [...list.filter((each) => each !== "none"), value] });
  }

  async function submit(write: boolean) {
    const parsed = marketingIntakeSchema.safeParse(answers);
    if (!parsed.success) {
      setError("Some answers are missing. Go back and answer each question.");
      return;
    }
    setError(null);
    setPhase(write ? "writing" : "saving");
    try {
      const saved = await saveMarketingIntakeAction(parsed.data);
      if (!saved.ok) throw new Error(saved.message);
      if (!write) {
        startRefresh(() => {
          router.refresh();
          setPhase("form");
          onDone?.();
        });
        return;
      }
      const written = await draftMarketingPlanAction();
      if (!written.ok) throw new Error(`Your answers are saved. ${written.message}`);
      setPhase("finished");
      finish(() => {
        setPhase("form");
        onDone?.();
      });
    } catch (problem) {
      setError(problem instanceof Error && problem.message !== "Failed to fetch" ? problem.message : "Couldn’t reach First Sale. Check your connection and try again.");
      setPhase("form");
    }
  }

  if (phase === "writing" || phase === "finished") return <PlanProgress finished={phase === "finished"} />;

  const last = screen === SCREENS.length - 1;
  const notIncluded = MARKETING_PLATFORMS.filter((id) => !answers.include.includes(id));

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!screenReady(screen, answers)) setError("Answer each question on this screen first.");
        else if (last) submit(true);
        else {
          setError(null);
          setScreen(screen + 1);
        }
      }}
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted">
          {screen + 1} of {SCREENS.length}
        </p>
        <h2 ref={heading} tabIndex={-1} className="font-display text-2xl font-bold outline-none">
          {SCREENS[screen]}
        </h2>
      </div>

      {screen === 0 ? (
        <>
          {known.length ? (
            <details className="rounded-xl bg-ground px-4 py-1">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold">We’ll also use what you’ve already told us</summary>
              <dl className="grid gap-x-4 gap-y-1 text-[15px] sm:grid-cols-[auto_1fr]">
                {known.map((fact) => (
                  <div key={fact.label} className="contents">
                    <dt className="text-rule">{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="py-2 text-sm text-rule">
                Your plan uses these too, so we won’t ask again.{" "}
                <Link href="/business/edit" className={TEXT_LINK}>
                  Change your business answers
                </Link>
              </p>
            </details>
          ) : null}

          <fieldset className="flex flex-col gap-2.5" aria-describedby="why-include">
            <legend className="text-[19px] font-bold leading-snug">Which of these do you want to use?</legend>
            <Why id="why-include">We build your plan around the places you pick. Pick any that fit, or none and we’ll suggest where to start.</Why>
            <p className="rounded-lg bg-accent-tint px-3 py-2.5 font-semibold text-accent-ink">
              It’s okay if you don’t have these accounts. We’ll set them up together.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {MARKETING_PLATFORMS.map((id) => {
                const on = answers.include.includes(id);
                return (
                  <label key={id} className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 ${on ? ON : OFF}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5 size-5 shrink-0 accent-accent"
                      checked={on}
                      onChange={() => toggleInclude(id)}
                      aria-label={PLATFORM_DATA[id].name}
                      aria-describedby={`about-${id}`}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold">{PLATFORM_DATA[id].name}</span>
                      <span id={`about-${id}`} className="text-sm text-rule">
                        {PLATFORM_DATA[id].goodFor}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {answers.include.length ? (
            <div className="flex flex-col gap-2.5">
              <h3 id="have-question" className="text-[19px] font-bold leading-snug">
                Do you already have any of these for your business?
              </h3>
              <Why id="why-have">So we skip setting up what you already have. Pick any that fit.</Why>
              <ChoiceChips
                labelledBy="have-question"
                describedBy="why-have"
                options={answers.include.map((id) => [id, PLATFORM_DATA[id].name])}
                selected={answers.have}
                onToggle={(id) => toggleIn("have", id)}
              />
            </div>
          ) : null}

          {notIncluded.length ? (
            <div className="flex flex-col gap-2.5">
              <h3 id="exclude-question" className="text-[19px] font-bold leading-snug">
                Any you don’t want at all?
              </h3>
              <Why id="why-exclude">Your plan will never suggest these. Pick any that fit.</Why>
              <ChoiceChips
                labelledBy="exclude-question"
                describedBy="why-exclude"
                options={notIncluded.map((id) => [id, PLATFORM_DATA[id].name])}
                selected={answers.exclude}
                onToggle={(id) => toggleIn("exclude", id)}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {screen === 1
        ? SKILL_QUESTIONS.map((question) => (
            <div key={question.area} className="flex flex-col gap-2.5">
              <h3 id={`${question.area}-question`} className="text-[19px] font-bold leading-snug">
                {question.title}
              </h3>
              <Why id={`why-${question.area}`}>{question.why}</Why>
              <ChoiceCards
                labelledBy={`${question.area}-question`}
                describedBy={`why-${question.area}`}
                options={(Object.keys(question.options) as (keyof typeof question.options)[]).map((level) => [level, question.options[level].label])}
                descriptions={Object.fromEntries(Object.entries(question.options).map(([level, option]) => [level, option.description]))}
                selected={answers[question.area] ?? ""}
                onSelect={(level) => update({ [question.area]: answers[question.area] === level ? null : level })}
              />
            </div>
          ))
        : null}

      {screen === 2 ? (
        <>
          <div className="flex flex-col gap-2.5">
            <h3 id="done-question" className="text-[19px] font-bold leading-snug">
              What have you done for marketing so far?
            </h3>
            <Why id="why-done">So your plan builds on what you’ve started instead of starting over. Pick any that fit.</Why>
            <ChoiceChips
              labelledBy="done-question"
              describedBy="why-done"
              options={DONE_ALREADY.map((value) => [value, DONE_LABELS[value]])}
              selected={answers.done}
              onToggle={toggleDone}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="done-note" className="text-[19px] font-bold leading-snug">
              Anything else? <span className="font-normal text-muted">(optional)</span>
            </label>
            <Why id="why-note">A line about what worked or didn’t helps your plan fit.</Why>
            <textarea
              id="done-note"
              aria-describedby="why-note"
              rows={2}
              maxLength={MAX_DONE_NOTE}
              className={INPUT}
              value={answers.doneNote}
              onChange={(event) => update({ doneNote: event.target.value })}
              placeholder="For example: I sold out at the spring market"
            />
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {screen > 0 ? (
          <button type="button" className={SECONDARY} onClick={() => setScreen(screen - 1)} disabled={phase !== "form"}>
            Back
          </button>
        ) : null}
        <button type="submit" className={last ? AI_BUTTON : PRIMARY} disabled={phase !== "form"}>
          {last ? (hasPlan ? "Save and write my plan again" : "Save and write my plan") : "Next"}
        </button>
        {last && hasPlan ? (
          <button type="button" className={SECONDARY} disabled={phase !== "form"} onClick={() => (screenReady(2, answers) ? submit(false) : setError("Answer each question on this screen first."))}>
            {phase === "saving" ? "Saving…" : "Just save my answers"}
          </button>
        ) : null}
        {onDone ? (
          <button type="button" className={`${SECONDARY} ml-auto`} onClick={onDone} disabled={phase !== "form"}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
