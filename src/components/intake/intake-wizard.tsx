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
import { LocalDate } from "@/components/local-date";
import { PRIMARY, SECONDARY } from "@/components/styles";
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
import { ChoiceCards, PracticeSuggestions } from "./choices";
import { IntakeReview } from "./intake-review";
import { PlaceStep } from "./place-step";
import { MarkBadge, QuestionBlock } from "./question-block";
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
  timing: "It helps us order your steps and explain more where you’re new.",
};

function detailsTitle(a: IntakeAnswers): string {
  const category = categoryFor(a.category);
  return category && category.id !== "other" ? `About your ${category.label.toLowerCase()}` : "A few details";
}

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
    if (saved && (saved === "review" || stepsFor(draft.answers).includes(saved))) return saved;
    return editing ? "review" : "sell";
  });
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
      setAiNote({ text: "Couldn’t reach First Sale. Check your connection and try again.", error: true });
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
      setSaveError(message || "Couldn’t reach First Sale. Check your connection and try again.");
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
  const resumeBanner = resumed ? (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-tint px-4 py-3 text-accent-ink">
      <p>
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
          <IntakeReview editing={editing} rows={rows} marks={marks} impact={impact} headingRef={headingRef} onEdit={editFromReview} disabled={saving} />
          {saveError ? (
            <p role="alert" className="rounded-lg bg-check-tint px-3 py-2.5 text-sm text-check">
              {saveError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2.5">
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
                Back to your business
              </button>
            ) : (
              <button type="button" onClick={back} disabled={saving} className={SECONDARY}>
                Back
              </button>
            )}
            <button type="button" onClick={save} disabled={saving || unchanged} className={PRIMARY}>
              {saving ? "Saving…" : editing ? "Confirm these changes" : "This is right. Continue"}
            </button>
          </div>
          {saved ? (
            <p role="status" className="text-sm text-muted">
              {saved}
            </p>
          ) : null}
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

  return (
    <PracticeSuggestions value={practice}>
      <div className="flex flex-col gap-5">
        {resumeBanner}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-accent-ink">
              Part {position} of {steps.length}
            </span>
            <span role="status" className="text-sm text-muted">
              {saved}
            </span>
          </div>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((position / (steps.length + 1)) * 100)}%` }} />
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <section aria-labelledby={id("question")} className="flex min-w-0 flex-col gap-5 rounded-2xl bg-surface p-5 ring-1 ring-ink/5 sm:p-6 lg:flex-1">
            <StepTitle id={id("question")} headingRef={headingRef} title={title} />

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
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <MarkBadge mark={marks.owners} />
                </div>
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
                  <div className="flex flex-wrap items-center gap-3">
                    <span id={id("owner-count-label")} className="font-semibold">
                      How many owners in total, including you?
                    </span>
                    <div role="group" aria-labelledby={id("owner-count-label")} className="flex items-center gap-1.5">
                      <button type="button" aria-label="Fewer owners" onClick={() => update("ownerCount", Math.max(2, answers.ownerCount - 1))} className="size-11 rounded-lg border border-field text-lg font-bold">
                        −
                      </button>
                      <span aria-live="polite" className="min-w-8 text-center text-lg font-bold">
                        {answers.ownerCount}
                      </span>
                      <button type="button" aria-label="More owners" onClick={() => update("ownerCount", Math.min(MAX_OWNERS, answers.ownerCount + 1))} className="size-11 rounded-lg border border-field text-lg font-bold">
                        +
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === "name" ? (
              <div className="flex flex-col gap-2">
                <label htmlFor={id("biz-name")} className="font-semibold">
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
                  className="min-h-12 rounded-lg border border-field bg-surface px-3 py-2.5 text-base disabled:bg-ground"
                />
                <label className="flex min-h-11 items-center gap-2.5">
                  <input type="checkbox" checked={answers.noName} onChange={(e) => update("noName", e.target.checked)} className="size-5 accent-accent" />
                  I haven’t picked a name yet
                </label>
              </div>
            ) : null}

            {questions.map((spec) => (
              <QuestionBlock key={spec.field} spec={spec} answers={answers} mark={marks[spec.field]} id={id(spec.field)} onChange={onQuestion} describedBy={spec.field === "channels" ? errorId : undefined} />
            ))}

            {stepError ? (
              <p id={id("step-error")} ref={errorRef} role="alert" tabIndex={-1} className="text-sm font-semibold text-danger">
                {stepError}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2.5 border-t border-rule-tint pt-3">
              {position > 1 || fromReview ? (
                <button type="button" onClick={back} disabled={busy} className={SECONDARY}>
                  Back
                </button>
              ) : (
                <span />
              )}
              <button type="button" onClick={next} disabled={busy} className={PRIMARY}>
                {fromReview ? "Back to summary" : nextStep(step, answers) === "review" ? "See my summary" : "Continue"}
              </button>
            </div>
          </section>

          <aside className="flex flex-col gap-3.5 lg:w-72 lg:shrink-0">
            <div className="flex flex-col gap-1.5 rounded-2xl bg-surface p-4.5 ring-1 ring-ink/5">
              <h2 className="font-bold">Why we ask</h2>
              <p className="text-[15px] text-rule">{WHY[step]}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4.5 ring-1 ring-ink/5">
              <h2 className="font-bold">Your answers so far</h2>
              {answered.length > 10 ? <p className="text-sm text-muted">Your latest 10. You’ll see them all before you confirm.</p> : null}
              {answered.length ? (
                <dl className="flex flex-col gap-2">
                  {answered.slice(-10).map((row) => (
                    <div key={row.label}>
                      <dt className="text-[13px] font-semibold text-muted">{row.label}</dt>
                      <dd className="text-[15px]">{row.value.length > 70 ? `${row.value.slice(0, 67)}…` : row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">Nothing yet.</p>
              )}
              <p className="text-sm text-muted">Saved as you go. Come back any time to pick up where you left off.</p>
            </div>
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
    <h1 id={id} ref={headingRef} tabIndex={-1} className="font-display text-3xl font-bold leading-tight tracking-tight">
      {title}
    </h1>
  );
}
