"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { draftMarketingPlanAction, saveMarketingIntakeAction } from "@/app/(app)/marketing/actions";
import { Icon } from "@/components/icons";
import { useJobWatch } from "@/components/job-watch";
import { AI_BUTTON, ALERT, INPUT, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";
import { MARKETING_PLATFORMS, type MarketingPlatformId, PLATFORM_DATA } from "@/data/marketing-platforms";
import { DONE_ALREADY, DONE_LABELS, type DoneAlready, MAX_DONE_NOTE, marketingIntakeSchema, SKILL_QUESTIONS, type StoredIntake } from "@/lib/marketing/intake";
import { PlanProgress, useFinishAndRefresh } from "./ai-progress";
import { InfoRows, PICKS, PickTile, Why } from "./pieces";

const EMPTY: StoredIntake = { include: [], have: [], exclude: [], social: null, seo: null, content: null, done: [], doneNote: "" };
const SCREENS = ["Where you want to show up", "What you already know", "What you’ve tried so far"] as const;
const QUESTION = "font-display text-[21px] leading-snug";

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
      <InfoRows rows={rows} />
      <button type="button" className={`${SECONDARY} w-fit`} onClick={() => setEditing(true)}>
        <Icon name="pencil" size="sm" />
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
  // What SnapStart already knows, so it isn't asked again
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
  const finished = () => {
    setPhase("finished");
    finish(() => {
      setPhase("form");
      onDone?.();
    });
  };
  // Already being written, maybe in another tab: the progress screen stays up until it ends
  const job = useJobWatch(finished);
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
      if (!written.ok && written.busy) return job.watch([written.busy]);
      if (!written.ok) throw new Error(`Your answers are saved. ${written.message}`);
      finished();
    } catch (problem) {
      setError(problem instanceof Error && problem.message !== "Failed to fetch" ? problem.message : "Couldn’t reach SnapStart. Check your connection and try again.");
      setPhase("form");
    }
  }

  if (phase === "writing" || phase === "finished") return <PlanProgress finished={phase === "finished"} />;

  const last = screen === SCREENS.length - 1;
  const notIncluded = MARKETING_PLATFORMS.filter((id) => !answers.include.includes(id));

  return (
    <form
      data-demo-ok
      className="flex flex-col gap-7"
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
      <div className="flex flex-col gap-5">
        <ol aria-label="Your progress" className="grid auto-cols-fr grid-flow-col gap-2.5">
          {SCREENS.map((title, index) => (
            <li
              key={title}
              aria-current={index === screen ? "step" : undefined}
              className={`flex min-w-0 flex-col gap-2 text-sm font-semibold ${index < screen ? "text-rule" : index === screen ? "text-ink" : "text-muted"}`}
            >
              <span className="hidden items-center gap-1.5 truncate sm:flex">
                {index < screen ? <Icon name="check" size="xs" className="text-accent" /> : null}
                {title}
              </span>
              <span className="sr-only sm:hidden">{title}</span>
              <span className="sr-only">{index < screen ? " (done)" : index === screen ? " (now)" : ""}</span>
              <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-accent" style={{ width: index < screen ? "100%" : index === screen ? "45%" : "0%" }} />
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-1">
          <p className="text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">
            Part {screen + 1} of {SCREENS.length}
          </p>
          <h2 ref={heading} tabIndex={-1} className="font-display text-[28px] leading-tight outline-none sm:text-[32px]">
            {SCREENS[screen]}
          </h2>
        </div>
      </div>

      {screen === 0 ? (
        <>
          {known.length ? (
            <details className="group/known rounded-xl border border-line bg-soft">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2 font-semibold [&::-webkit-details-marker]:hidden">
                <Icon name="info" className="text-accent" />
                <span className="flex-1">We’ll also use what you’ve already told us</span>
                <Icon name="chevron" size="sm" className="text-faint transition-transform group-open/known:rotate-90" />
              </summary>
              <div className="px-4 pb-3">
                <InfoRows rows={known} />
                <p className="pt-2 text-sm text-muted">
                  Your plan uses these too, so we won’t ask again.{" "}
                  <Link href="/business/edit" className={TEXT_LINK}>
                    Change your business answers
                  </Link>
                </p>
              </div>
            </details>
          ) : null}

          <fieldset className="flex flex-col gap-3" aria-describedby="why-include">
            <legend className={`${QUESTION} mb-2.5`}>Which of these do you want to use?</legend>
            <Why id="why-include">We build your plan around the places you pick. Pick any that fit, or none and we’ll suggest where to start.</Why>
            <p className="flex items-start gap-2.5 rounded-xl border border-accent-ring bg-accent-tint px-3.5 py-3 font-semibold text-accent-ink">
              <Icon name="users" size="sm" className="mt-[3px]" />
              It’s okay if you don’t have these accounts. We’ll set them up together.
            </p>
            <div className={PICKS.wide}>
              {MARKETING_PLATFORMS.map((id) => (
                <PickTile
                  key={id}
                  pressed={answers.include.includes(id)}
                  onClick={() => toggleInclude(id)}
                  label={PLATFORM_DATA[id].name}
                  description={PLATFORM_DATA[id].goodFor}
                  descriptionId={`about-${id}`}
                  layout="top"
                />
              ))}
            </div>
          </fieldset>

          {answers.include.length ? (
            <div className="flex flex-col gap-3">
              <h3 id="have-question" className={QUESTION}>
                Do you already have any of these for your business?
              </h3>
              <Why id="why-have">So we skip setting up what you already have. Pick any that fit.</Why>
              <div role="group" aria-labelledby="have-question" aria-describedby="why-have" className={PICKS.cards}>
                {answers.include.map((id) => (
                  <PickTile key={id} pressed={answers.have.includes(id)} onClick={() => toggleIn("have", id)} label={PLATFORM_DATA[id].name} />
                ))}
              </div>
            </div>
          ) : null}

          {notIncluded.length ? (
            <div className="flex flex-col gap-3">
              <h3 id="exclude-question" className={QUESTION}>
                Any you don’t want at all?
              </h3>
              <Why id="why-exclude">Your plan will never suggest these. Pick any that fit.</Why>
              <div role="group" aria-labelledby="exclude-question" aria-describedby="why-exclude" className={PICKS.cards}>
                {notIncluded.map((id) => (
                  <PickTile key={id} pressed={answers.exclude.includes(id)} onClick={() => toggleIn("exclude", id)} label={PLATFORM_DATA[id].name} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {screen === 1
        ? SKILL_QUESTIONS.map((question) => (
            <div key={question.area} className="flex flex-col gap-3">
              <h3 id={`${question.area}-question`} className={QUESTION}>
                {question.title}
              </h3>
              <Why id={`why-${question.area}`}>{question.why}</Why>
              <div role="group" aria-labelledby={`${question.area}-question`} aria-describedby={`why-${question.area}`} className={PICKS.cards}>
                {(Object.keys(question.options) as (keyof typeof question.options)[]).map((level) => (
                  <PickTile
                    key={level}
                    pressed={answers[question.area] === level}
                    onClick={() => update({ [question.area]: answers[question.area] === level ? null : level })}
                    label={question.options[level].label}
                    description={question.options[level].description}
                    layout="top"
                  />
                ))}
              </div>
            </div>
          ))
        : null}

      {screen === 2 ? (
        <>
          <div className="flex flex-col gap-3">
            <h3 id="done-question" className={QUESTION}>
              What have you done for marketing so far?
            </h3>
            <Why id="why-done">So your plan builds on what you’ve started instead of starting over. Pick any that fit.</Why>
            <div role="group" aria-labelledby="done-question" aria-describedby="why-done" className={PICKS.cards}>
              {DONE_ALREADY.map((value) => (
                <PickTile key={value} pressed={answers.done.includes(value)} onClick={() => toggleDone(value)} label={DONE_LABELS[value]} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <label htmlFor="done-note" className={QUESTION}>
              Anything else? <span className="font-sans text-base text-muted">(optional)</span>
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

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        {screen > 0 ? (
          <button type="button" className={SECONDARY} onClick={() => setScreen(screen - 1)} disabled={phase !== "form"}>
            <Icon name="back" size="sm" />
            Back
          </button>
        ) : null}
        <button type="submit" data-writes={last ? "" : undefined} className={last ? AI_BUTTON : PRIMARY} disabled={phase !== "form"}>
          {last ? (hasPlan ? "Save and write my plan again" : "Save and write my plan") : "Next"}
          {last ? <Icon name="sparkles" size="sm" /> : <Icon name="arrow" size="sm" />}
        </button>
        {last && hasPlan ? (
          <button type="button" data-writes className={SECONDARY} disabled={phase !== "form"} onClick={() => (screenReady(2, answers) ? submit(false) : setError("Answer each question on this screen first."))}>
            {phase === "saving" ? "Saving…" : "Just save my answers"}
          </button>
        ) : null}
        {onDone ? (
          <button type="button" className={`${SECONDARY} sm:ml-auto`} onClick={onDone} disabled={phase !== "form"}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
