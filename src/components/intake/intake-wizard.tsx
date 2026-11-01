"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import {
  createBusinessAction,
  discardIntakeDraftAction,
  saveIntakeDraftAction,
  suggestAnswersAction,
  updateBusinessAction,
} from "@/app/(app)/business/actions";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { ALERT, EYEBROW, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { Card, IconTile } from "@/components/ui";
import { type BusinessCategory, type BusinessProfile, businessProfileSchema, MAX_OWNERS, type OFFERING_KINDS } from "@/lib/domain";
import {
  answersToProfile,
  applySuggestion,
  EMPTY_ANSWERS,
  sameAnswers,
  type IntakeAnswers,
  type Marks,
  stepProblem,
  STEPS,
  stepsFor,
  type StepId,
  summarize,
  withDefaults,
} from "@/lib/intake/answers";
import { categoryFor } from "@/lib/intake/catalog";
import { type ImpactContext, profileImpact } from "@/lib/intake/impact";
import { type QuestionField, questionsFor } from "@/lib/intake/questions";
import { ChapterTabs } from "./chapter-tabs";
import { CHAPTERS, chapterIndex } from "./chapters";
import { CheckTile, ChoiceCards, PracticeSuggestions } from "./choices";
import { IntakeReview } from "./intake-review";
import { PlaceStep } from "./place-step";
import { MarkBadge, QUESTION_TITLE, QuestionBlock, WhyLine } from "./question-block";
import { SellStep } from "./sell-step";

type OfferingKind = (typeof OFFERING_KINDS)[number];
type Step = StepId | "review";
type Form = { answers: IntakeAnswers; marks: Marks };

export interface SavedDraft {
  answers: IntakeAnswers;
  marks: Marks;
  step: Step;
  practice: boolean;
  updatedAt: string;
}

type Props =
  | { mode: "create"; draft: SavedDraft | null }
  | {
      mode: "edit";
      initial: IntakeAnswers;
      initialProfile: BusinessProfile | null;
      // Key of the saved answers this edit starts from
      baseKey: string;
      draft: SavedDraft | null;
      context: ImpactContext;
    };

const TITLES: Record<Exclude<StepId, "details">, string> = {
  sell: "What kind of business is it?",
  place: "Where will your business be?",
  owners: "Who owns it?",
  name: "What’s it called?",
  status: "What you’ve done so far",
  channels: "How you’ll sell",
  premises: "Where you’ll work",
  money: "Money",
  help: "Help",
  timing: "Timing and goals",
};

const WHY: Record<StepId, string> = {
  sell: "What you sell decides which rules we look for, like food rules, product safety and sales tax. Pick the closest; you can add more.",
  place: "Rules come from your state, county and city. We only use official government sites for the places you pick.",
  owners: "One owner or several changes which business structures fit, and which agreements are worth writing down.",
  name: "Selling under a name that isn’t your own legal name usually means registering it. No name yet is fine.",
  status: "So we can mark steps you’ve already done instead of repeating them.",
  channels: "Markets, shops, delivery and shipping each come with their own rules.",
  details: "These few questions decide which product rules we check for you.",
  premises: "Working from home can need zoning approval. A rented space has to be approved for your kind of business.",
  money: "Your budget and sales shape which costs come first and which structure fits. Rough answers are fine.",
  help: "Paying people adds employer steps, usually later on.",
  timing: "Your launch date sets the countdown on your dashboard. The rest helps us explain more where you’re new.",
};

function detailsTitle(a: IntakeAnswers): string {
  const category = categoryFor(a.category);
  if (!category || category.id === "other") return "A few details";
  return category.id === "resale_shop" ? "About your shop" : `About your ${category.label.toLowerCase()}`;
}

// Steps whose title is the question itself, so the reason sits right under it
const ASKS_ITSELF: StepId[] = ["sell", "place", "owners", "name"];

const STEPPER =
  "grid size-11 place-items-center rounded-[10px] border border-line-strong bg-surface text-ink shadow-soft transition hover:border-muted hover:bg-soft active:translate-y-px";

// Fields shown on each step: continuing past a step confirms their suggestions
const STEP_FIELDS: Partial<Record<StepId, (keyof IntakeAnswers)[]>> = {
  sell: ["category", "productTags", "offeringKinds", "firstItems"],
  place: ["state", "county", "city"],
  owners: ["owners", "ownerCount"],
  name: ["name", "noName"],
};

function nextStep(current: Step, a: IntakeAnswers): Step {
  if (current === "review") return "review";
  return stepsFor(a).find((step) => STEPS.indexOf(step) > STEPS.indexOf(current)) ?? "review";
}

function previousStep(current: Step, a: IntakeAnswers): Step {
  const steps = stepsFor(a);
  if (current === "review") return steps.at(-1) ?? "sell";
  return steps.findLast((step) => STEPS.indexOf(step) < STEPS.indexOf(current)) ?? current;
}

export function IntakeWizard(props: Props) {
  const router = useRouter();
  const uid = useId();
  // Unique per instance: kept-mounted screens can hold a second wizard
  const id = (name: string) => `${uid}-${name}`;
  const editing = props.mode === "edit";
  const start = editing ? props.initial : EMPTY_ANSWERS;
  // An edit draft that matches the saved answers has nothing to resume
  const draft = props.draft && (!editing || !sameAnswers(props.draft.answers, start)) ? props.draft : null;
  const baseKey = editing ? props.baseKey : null;

  // Answers and their marks change together, always from the latest state
  const [form, setForm] = useState<Form>({ answers: draft?.answers ?? start, marks: draft?.marks ?? {} });
  const { answers, marks } = form;
  const [step, setStep] = useState<Step>(() => {
    const saved = draft?.step;
    if (saved && (saved === "review" || stepsFor(draft.answers).includes(saved))) {
      // Drafts saved before "Where are you now?" moved up go back to it first
      if (saved !== "review" && !draft.answers.stage && STEPS.indexOf(saved) > STEPS.indexOf("status")) return "status";
      return saved;
    }
    return editing ? "review" : "sell";
  });
  // "No date yet" only clears the date: the older timing answer is left alone, so research doesn't look out of date
  const [noDate, setNoDate] = useState(() => !answers.launchDate && answers.launchTiming === "unsure");
  const [resumed, setResumed] = useState<string | null>(draft?.updatedAt ?? null);
  // Set when a question was opened from the review, so Continue goes straight back
  const [fromReview, setFromReview] = useState(false);
  const [practice, setPractice] = useState(draft?.practice ?? false);
  const [aiNote, setAiNote] = useState<{ text: string; error: boolean } | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autosave, setAutosave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  // Focus moves only after the owner changes question, not when a kept screen is shown again
  const focusHeading = useRef(false);
  const dirty = useRef(false);
  const closed = useRef(false);
  const inFlight = useRef<Promise<unknown> | null>(null);

  const busy = aiPending || saving;
  const steps = stepsFor(answers);

  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus();
  }, [step]);

  // Autosave a moment after the last change, so returning owners continue where they left off
  useEffect(() => {
    if (!dirty.current || closed.current) return;
    // Nothing to keep when an edit matches the saved answers
    if (editing && sameAnswers(answers, start)) return;
    const timer = setTimeout(() => {
      if (closed.current) return;
      setAutosave("saving");
      const request = saveIntakeDraftAction({ mode: props.mode, answers, marks, step, practice, baseKey })
        .then((result) => setAutosave(result.ok && result.value.saved ? "saved" : "failed"))
        .catch(() => setAutosave("failed"));
      inFlight.current = request;
    }, 700);
    return () => clearTimeout(timer);
  }, [answers, marks, step, practice, props.mode, editing, start, baseKey]);

  function change(edit: (current: Form) => Form) {
    dirty.current = true;
    setForm((current) => {
      const next = edit(current);
      return withDefaults(next.answers, next.marks, current.answers);
    });
    setStepError(null);
  }

  // The owner's own answer replaces any suggestion for it
  function update<K extends keyof IntakeAnswers>(field: K, value: IntakeAnswers[K]) {
    change((current) => ({ answers: { ...current.answers, [field]: value }, marks: withoutMark(current.marks, field) }));
  }

  function go(to: Step) {
    focusHeading.current = true;
    // The welcome-back note and its Start over button are only for the first screen
    setResumed(null);
    dirty.current = true;
    setStepError(null);
    setStep(to);
  }

  function showProblem(problem: string) {
    flushSync(() => setStepError(problem));
    errorRef.current?.focus();
  }

  function next() {
    if (step === "review") return;
    const problem = stepProblem(step, answers);
    if (problem) return showProblem(problem);
    // Continuing past a step confirms what was filled in on it
    const shown = [...(STEP_FIELDS[step] ?? []), ...questionsFor(step, answers).map((q) => q.field)];
    setForm((current) => ({ ...current, marks: shown.reduce(withoutMark, current.marks) }));
    setFromReview(false);
    go(fromReview ? "review" : nextStep(step, answers));
  }

  function back() {
    if (fromReview && step !== "review") {
      const problem = stepProblem(step, answers);
      if (problem) return showProblem(problem);
      setFromReview(false);
      return go("review");
    }
    go(previousStep(step, answers));
  }

  function editFromReview(target: StepId) {
    setFromReview(true);
    go(steps.includes(target) ? target : "sell");
  }

  function pickCategory(category: BusinessCategory) {
    change(({ answers: current, marks: currentMarks }) => {
      const same = current.category === category;
      // Examples belong to the old kind of business; answers saved before kinds existed keep what they sell
      const keep = same || current.category === "";
      return {
        answers: { ...current, category, productTags: same ? current.productTags : [], offeringKinds: keep ? current.offeringKinds : [] },
        marks: withoutMark(withoutMark(currentMarks, "category"), "offeringKinds"),
      };
    });
  }

  function toggleIn(field: "productTags" | "offeringKinds", value: string) {
    change((current) => {
      const list = current.answers[field] as string[];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { answers: { ...current.answers, [field]: next }, marks: withoutMark(current.marks, field) };
    });
  }

  async function fillWithAi() {
    setAiPending(true);
    setAiNote(null);
    try {
      const result = await suggestAnswersAction(answers.description);
      if (!result.ok) {
        setAiNote({ text: result.message, error: true });
        return;
      }
      // The sell step is locked while waiting, and suggestions only fill unanswered questions
      const { applied } = applySuggestion(answers, result.value);
      change((current) => {
        const filled = applySuggestion(current.answers, result.value);
        return { answers: filled.answers, marks: { ...current.marks, ...Object.fromEntries(filled.applied.map((field) => [field, "ai"])) } };
      });
      setPractice(result.value.simulated);
      const count = `${applied.length} ${applied.length === 1 ? "answer" : "answers"}`;
      setAiNote({
        text: result.value.simulated
          ? applied.length
            ? `Practice mode suggested ${count} with simple word matching, not AI. They’re marked “Practice suggestion” for you to check closely.`
            : "Practice mode’s word matching didn’t find answers to fill in. Just pick from the choices."
          : applied.length
            ? `AI suggested ${count} from your description. They’re marked “AI suggestion” for you to check.`
            : "AI didn’t find answers to fill in. Just pick from the choices.",
        error: false,
      });
    } catch {
      setAiNote({ text: "Couldn’t reach SnapStart. Check your connection and try again.", error: true });
    } finally {
      setAiPending(false);
    }
  }

  async function save() {
    const missing = STEPS.map((s) => stepProblem(s, answers)).find(Boolean);
    if (missing) {
      setSaveError(missing);
      return;
    }
    setSaving(true);
    setSaveError(null);
    // No autosave may land after the save clears the draft
    closed.current = true;
    await inFlight.current?.catch(() => {});
    try {
      const profile = answersToProfile(answers);
      const result = editing ? await updateBusinessAction(profile) : await createBusinessAction(profile);
      if (!result.ok) throw new Error(result.message);
    } catch (error) {
      closed.current = false;
      const message = error instanceof Error && !(error instanceof TypeError) ? error.message : "";
      setSaveError(message || "Couldn’t reach SnapStart. Check your connection and try again.");
      setSaving(false);
      return;
    }
    // Inside the navigation transition, so the reset never shows on screen
    startTransition(() => {
      if (!editing) {
        // Start fresh next time: this screen stays mounted in the background
        setForm({ answers: EMPTY_ANSWERS, marks: {} });
        setStep("sell");
        setAiNote(null);
        setResumed(null);
      }
      dirty.current = false;
      closed.current = false;
      setFromReview(false);
      setSaving(false);
      router.push(editing ? "/business" : "/business?welcome=1");
    });
  }

  async function startOver() {
    closed.current = true;
    await inFlight.current?.catch(() => {});
    await discardIntakeDraftAction().catch(() => {});
    dirty.current = false;
    closed.current = false;
    setForm({ answers: start, marks: {} });
    setPractice(false);
    setResumed(null);
    setAutosave("idle");
    setFromReview(false);
    focusHeading.current = true;
    setStep(editing ? "review" : "sell");
  }

  const rows = summarize(answers, { followUps: true });
  const saved = autosave === "saved" ? "Progress saved" : autosave === "saving" ? "Saving…" : autosave === "failed" ? "Couldn’t save progress just now" : "";
  const savedIcon = autosave === "saved" ? <Icon name="check" size="xs" className="text-accent" /> : null;
  const resumeBanner = resumed ? (
    <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3.5 shadow-card sm:px-5">
      <IconTile icon="clock" />
      <p className="min-w-0 flex-1 basis-56">
        {editing ? "You have changes you haven’t confirmed yet, from " : "Welcome back. We kept your answers from "}
        <LocalDate iso={resumed} />.
      </p>
      <button type="button" onClick={startOver} disabled={busy} className={SECONDARY}>
        {editing ? "Discard my changes" : "Start over"}
      </button>
    </div>
  ) : null;

  if (step === "review") {
    let impact = null;
    if (editing && props.initialProfile) {
      const parsed = businessProfileSchema.safeParse(answersToProfile(answers));
      impact = parsed.success ? profileImpact(props.initialProfile, parsed.data, props.context) : null;
    }
    const unchanged = editing && sameAnswers(answers, props.initial);
    return (
      <PracticeSuggestions value={practice}>
        <div className="flex max-w-3xl flex-col gap-5">
          {resumeBanner}
          <ChapterTabs step="review" steps={steps} />
          <IntakeReview editing={editing} rows={rows} marks={marks} impact={impact} headingRef={headingRef} onEdit={editFromReview} disabled={saving}>
            {saveError ? (
              <p role="alert" className={ALERT}>
                {saveError}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-between gap-2.5 border-t border-line pt-[18px]">
              {editing ? (
                <button
                  type="button"
                  onClick={() =>
                    // Leaves the draft so the owner can come back to these changes
                    startTransition(() => {
                      setFromReview(false);
                      setSaveError(null);
                      router.push("/business");
                    })
                  }
                  disabled={saving}
                  className={SECONDARY}
                >
                  <Icon name="back" size="sm" />
                  Back to your business
                </button>
              ) : (
                <button type="button" onClick={back} disabled={saving} className={SECONDARY}>
                  <Icon name="back" size="sm" />
                  Back
                </button>
              )}
              <button type="button" onClick={save} disabled={saving || unchanged} className={PRIMARY}>
                {saving ? "Saving…" : editing ? "Confirm these changes" : "This is right. Continue"}
                {saving ? null : <Icon name="arrow" size="sm" />}
              </button>
            </div>
            {saved ? (
              <p role="status" className="flex items-center gap-1.5 text-sm text-muted">
                {savedIcon}
                {saved}
              </p>
            ) : null}
          </IntakeReview>
        </div>
      </PracticeSuggestions>
    );
  }

  const errorId = stepError ? id("step-error") : undefined;
  const position = steps.indexOf(step) + 1;
  const title = step === "details" ? detailsTitle(answers) : TITLES[step];
  const answered = rows.filter((row) => row.value);
  const questions = questionsFor(step, answers);
  const onQuestion = (field: QuestionField, value: string | string[]) => update(field, value as IntakeAnswers[typeof field]);
  const chapter = CHAPTERS[chapterIndex(step)];

  return (
    <PracticeSuggestions value={practice}>
      <div className="flex flex-col gap-5">
        {resumeBanner}
        <ChapterTabs step={step} steps={steps} />

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <section
            aria-labelledby={id("question")}
            className="flex min-w-0 flex-col gap-7 rounded-2xl border border-line bg-surface px-4 py-5 shadow-card sm:p-7 lg:flex-1"
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className={EYEBROW}>
                  {chapter.label} · Part {position} of {steps.length}
                </p>
                <span role="status" className="flex items-center gap-1.5 text-sm text-muted">
                  {savedIcon}
                  {saved}
                </span>
              </div>
              <StepTitle id={id("question")} headingRef={headingRef} title={title} />
              {ASKS_ITSELF.includes(step) ? (
                <WhyLine>
                  <b className="font-bold text-rule">Why we ask:</b> {WHY[step]}
                </WhyLine>
              ) : (
                <p className="text-[17px] text-muted">{WHY[step]}</p>
              )}
            </div>

            {step === "sell" ? (
              <SellStep
                id={id}
                answers={answers}
                marks={marks}
                onCategory={pickCategory}
                onToggleTag={(tag) => toggleIn("productTags", tag)}
                onToggleKind={(kind: OfferingKind) => toggleIn("offeringKinds", kind)}
                onFirstItems={(text) => update("firstItems", text)}
                onDescription={(text) => update("description", text)}
                onFill={fillWithAi}
                aiPending={aiPending}
                aiNote={aiNote}
                errorId={errorId}
              />
            ) : null}

            {step === "place" ? (
              <PlaceStep
                id={id}
                answers={answers}
                marks={marks}
                errorId={errorId}
                onState={(state) => update("state", state)}
                onText={(field, value) =>
                  change(({ answers: current, marks: currentMarks }) => ({
                    // A city-limits answer was about the old city
                    answers: { ...current, [field]: value, ...(field === "city" && value.trim() !== current.city.trim() ? { insideCityLimits: "" as const } : {}) },
                    marks: withoutMark(currentMarks, field),
                  }))
                }
                onCityPick={(city, county) =>
                  change(({ answers: current, marks: currentMarks }) => {
                    const nextAnswers = { ...current, city, ...(city.trim() !== current.city.trim() ? { insideCityLimits: "" as const } : {}) };
                    const nextMarks = withoutMark(currentMarks, "city");
                    // A city in one county fills it, unless the owner typed their own
                    if (county && (!current.county.trim() || currentMarks.county)) {
                      nextAnswers.county = county;
                      nextMarks.county = "default";
                    }
                    return { answers: nextAnswers, marks: nextMarks };
                  })
                }
              />
            ) : null}

            {step === "owners" ? (
              <div className="flex flex-col gap-4">
                {marks.owners ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <MarkBadge mark={marks.owners} />
                  </div>
                ) : null}
                <ChoiceCards
                  labelledBy={id("question")}
                  describedBy={errorId}
                  options={[
                    ["me", "Just me"],
                    ["others", "Me and other people"],
                  ]}
                  selected={answers.owners}
                  onSelect={(value) => update("owners", value)}
                />
                {answers.owners === "others" ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span id={id("owner-count-label")} className="text-[15.5px] font-semibold">
                      How many owners in total, including you?
                    </span>
                    <div role="group" aria-labelledby={id("owner-count-label")} className="flex items-center gap-2">
                      <button type="button" aria-label="Fewer owners" onClick={() => update("ownerCount", Math.max(2, answers.ownerCount - 1))} className={STEPPER}>
                        <Icon name="minus" />
                      </button>
                      <span aria-live="polite" className="min-w-10 text-center font-display text-2xl tabular-nums">
                        {answers.ownerCount}
                      </span>
                      <button type="button" aria-label="More owners" onClick={() => update("ownerCount", Math.min(MAX_OWNERS, answers.ownerCount + 1))} className={STEPPER}>
                        <Icon name="plus" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === "name" ? (
              <div className="flex flex-col gap-2.5">
                <label htmlFor={id("biz-name")} className="text-[15.5px] font-semibold">
                  Business name
                </label>
                <input
                  id={id("biz-name")}
                  type="text"
                  maxLength={100}
                  value={answers.name}
                  onChange={(e) => update("name", e.target.value)}
                  disabled={answers.noName}
                  aria-describedby={errorId}
                  aria-invalid={stepError ? true : undefined}
                  placeholder="For example: Sunrise Bakes"
                  className={`${INPUT} disabled:bg-wash disabled:text-faint sm:max-w-md`}
                />
                <CheckTile checked={answers.noName} onChange={(checked) => update("noName", checked)}>
                  I haven’t picked a name yet
                </CheckTile>
              </div>
            ) : null}

            {step === "timing" ? (
              <div className="flex flex-col gap-2.5">
                <label htmlFor={id("launch-date")} className={QUESTION_TITLE}>
                  What’s your goal launch date?
                </label>
                <WhyLine id={id("launch-why")}>
                  <b className="font-bold text-rule">Why we ask:</b> it’s the day you hope to make your first sale, and your dashboard counts down to it.
                </WhyLine>
                <input
                  id={id("launch-date")}
                  type="date"
                  value={answers.launchDate}
                  onChange={(e) => update("launchDate", e.target.value)}
                  disabled={noDate}
                  aria-describedby={[id("launch-why"), errorId].filter(Boolean).join(" ")}
                  className={`${INPUT} disabled:bg-wash disabled:text-faint sm:max-w-[280px]`}
                />
                <CheckTile
                  checked={noDate}
                  onChange={(checked) => {
                    setNoDate(checked);
                    // Stored as "unsure": no date yet is an answer, not a skipped question
                    update("launchTiming", checked ? "unsure" : "");
                    if (checked) update("launchDate", "");
                  }}
                >
                  I don’t have a date yet
                </CheckTile>
              </div>
            ) : null}

            {questions.map((spec) => (
              <QuestionBlock key={spec.field} spec={spec} answers={answers} mark={marks[spec.field]} id={id(spec.field)} onChange={onQuestion} describedBy={spec.field === "channels" ? errorId : undefined} />
            ))}

            {stepError ? (
              <p id={id("step-error")} ref={errorRef} role="alert" tabIndex={-1} className="flex items-start gap-2 text-[15px] font-bold text-danger">
                <Icon name="info" size="sm" className="mt-[3px]" />
                {stepError}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2.5 border-t border-line pt-[18px]">
              {position > 1 || fromReview ? (
                <button type="button" onClick={back} disabled={busy} className={SECONDARY}>
                  <Icon name="back" size="sm" />
                  Back
                </button>
              ) : (
                <span />
              )}
              <button type="button" onClick={next} disabled={busy} className={PRIMARY}>
                {fromReview ? "Back to summary" : nextStep(step, answers) === "review" ? "See my summary" : "Continue"}
                <Icon name="arrow" size="sm" />
              </button>
            </div>
          </section>

          <aside className="flex flex-col gap-3.5 lg:w-72 lg:shrink-0">
            <Card title="Your answers so far" icon="checklist" id={id("so-far")}>
              {answered.length > 10 ? <p className="text-sm text-muted">Your latest 10. You’ll see them all before you confirm.</p> : null}
              {answered.length ? (
                <dl className="flex flex-col">
                  {answered.slice(-10).map((row) => (
                    <div key={row.label} className="border-b border-line py-2 first:pt-0 last:border-b-0">
                      <dt className="text-[13.5px] text-muted">{row.label}</dt>
                      <dd className="text-[15px] font-semibold">{row.value.length > 70 ? `${row.value.slice(0, 67)}…` : row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">Nothing yet.</p>
              )}
              <p className="flex items-start gap-1.5 border-t border-line pt-3 text-sm text-muted">
                <Icon name="check" size="xs" className="mt-[3px] text-accent" />
                Saved as you go. Come back any time to pick up where you left off.
              </p>
            </Card>
          </aside>
        </div>
      </div>
    </PracticeSuggestions>
  );
}

function withoutMark(marks: Marks, field: keyof IntakeAnswers): Marks {
  const next = { ...marks };
  delete next[field];
  return next;
}

function StepTitle({ id, title, headingRef }: { id: string; title: string; headingRef: RefObject<HTMLHeadingElement | null> }) {
  return (
    <h1 id={id} ref={headingRef} tabIndex={-1} className="font-display text-[30px] leading-[1.15] tracking-[-0.01em] sm:text-[36px]">
      {title}
    </h1>
  );
}
