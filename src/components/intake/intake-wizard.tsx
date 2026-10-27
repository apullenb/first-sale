"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";
import {
  createBusinessAction,
  suggestAnswersAction,
  updateBusinessAction,
} from "@/app/(app)/business/actions";
import { MAX_OWNERS, US_STATE_CODES } from "@/lib/domain";
import {
  answersToProfile,
  applySuggestion,
  asks,
  EMPTY_ANSWERS,
  FOLLOW_UPS,
  stepProblem,
  STEPS,
  SUGGESTIBLE,
  summarize,
  type IntakeAnswers,
  type StepId,
  type SuggestibleField,
} from "@/lib/intake/answers";
import {
  BUDGET_LABELS,
  CHANNEL_LABELS,
  entries,
  EXPERIENCE_LABELS,
  HIRING_LABELS,
  LAUNCH_TIMING_LABELS,
  OFFERING_KIND_LABELS,
  PREMISES_LABELS,
  REGISTERED_AS_HELP,
  REGISTERED_AS_LABELS,
  STAGE_LABELS,
  STATE_NAMES,
  YES_NO_LABELS,
} from "@/lib/intake/options";
import { AiSuggestionBadge, ChoiceCards, ChoiceChips, PracticeSuggestions } from "./choices";

const EXAMPLE =
  "I bake cakes and bread at home in Ohio and want to sell at the Saturday farmers market and on Instagram.";

const WHY: Record<StepId, string> = {
  idea: "AI uses your description to suggest answers to the next questions. Every suggestion is marked, and you confirm or change it.",
  name: "Selling under a name that isn’t your own legal name usually means registering it as a DBA (“doing business as”). No name yet is fine.",
  place: "Rules come from your state, county and city. We only use official government sites for the places you pick. US only for now.",
  owners: "One owner or several changes which business structures fit, and which agreements you’ll want in writing.",
  status: "It lets us skip steps you’ve already done.",
  sell: "What you sell decides things like food rules, sales tax and labels.",
  channels: "Markets, storefronts and online sales each come with their own permits and tax rules.",
  premises: "Working from home can need zoning approval. A rented space has to be approved for your kind of business.",
  money: "Your budget shapes which costs come first. Hiring plans add employer steps to your checklist later.",
  timing: "It helps us put your steps in order, and explain more where you’re new.",
};

// Pick-one answers shown as chips; picking the chosen one again clears it
type ChipField =
  | "insideCityLimits"
  | "foodNeedsCold"
  | "shipsOrders"
  | "customersVisit"
  | "startupBudget"
  | "hiringPlans"
  | "launchTiming"
  | "experience";

type Props = { mode: "create" } | { mode: "edit"; initial: IntakeAnswers };

const INPUT = "min-h-12 rounded-lg border border-field bg-surface px-3 py-2.5 text-base";
const PRIMARY = "min-h-12 rounded-lg bg-accent px-5 font-bold text-white hover:bg-accent-ink disabled:opacity-60";
const SECONDARY = "min-h-12 rounded-lg border border-field bg-surface px-4 font-semibold hover:border-muted disabled:opacity-60";

export function IntakeWizard(props: Props) {
  const router = useRouter();
  const uid = useId();
  // Unique per instance: kept-mounted screens can hold a second wizard
  const id = (name: string) => `${uid}-${name}`;
  const editing = props.mode === "edit";
  const [answers, setAnswers] = useState<IntakeAnswers>(editing ? props.initial : EMPTY_ANSWERS);
  const [step, setStep] = useState(0);
  const [reviewing, setReviewing] = useState(editing);
  // Set when a question was opened from the review, so Continue goes straight back
  const [fromReview, setFromReview] = useState(false);
  const [suggested, setSuggested] = useState<Partial<Record<SuggestibleField, true>>>({});
  const [aiNote, setAiNote] = useState<{ text: string; error: boolean } | null>(null);
  const [practiceSuggestions, setPracticeSuggestions] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  // Focus moves only after the owner changes question, not when a kept screen is shown again
  const focusHeading = useRef(false);

  const stepId = STEPS[step];
  const busy = aiPending || saving;

  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus();
  }, [step, reviewing]);

  function go(change: () => void) {
    focusHeading.current = true;
    setStepError(null);
    change();
  }

  function update<K extends keyof IntakeAnswers>(field: K, value: IntakeAnswers[K]) {
    setAnswers((current) => ({ ...current, [field]: value }));
    setSuggested((current) => {
      const next = { ...current };
      delete next[field as SuggestibleField];
      return next;
    });
    setStepError(null);
  }

  function toggle<K extends "offeringKinds" | "channels">(field: K, value: IntakeAnswers[K][number]) {
    const list = answers[field] as string[];
    update(field, (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]) as IntakeAnswers[K]);
  }

  function choose<K extends ChipField>(field: K, value: IntakeAnswers[K]) {
    update(field, answers[field] === value ? ("" as IntakeAnswers[K]) : value);
  }

  function changeCity(city: string) {
    update("city", city);
    // That answer was about the old city
    if (answers.insideCityLimits && city.trim() !== answers.city.trim()) update("insideCityLimits", "");
  }

  function next() {
    const problem = stepProblem(stepId, answers);
    if (problem) {
      flushSync(() => setStepError(problem));
      errorRef.current?.focus();
      return;
    }
    // Continuing past a question confirms its AI suggestions
    setSuggested((current) => {
      const kept = { ...current };
      for (const [field, shownOn] of Object.entries(SUGGESTIBLE)) {
        if (shownOn === stepId) delete kept[field as SuggestibleField];
      }
      return kept;
    });
    go(() => {
      if (fromReview || step === STEPS.length - 1) {
        setFromReview(false);
        setReviewing(true);
      } else {
        setStep(step + 1);
      }
    });
  }

  function back() {
    // Returning to the review still needs this question answered
    if (fromReview) {
      const problem = stepProblem(stepId, answers);
      if (problem) {
        flushSync(() => setStepError(problem));
        errorRef.current?.focus();
        return;
      }
    }
    go(() => {
      if (fromReview) {
        setFromReview(false);
        setReviewing(true);
      } else if (reviewing) {
        setReviewing(false);
      } else {
        setStep(Math.max(0, step - 1));
      }
    });
  }

  function editFromReview(target: StepId) {
    go(() => {
      setReviewing(false);
      setFromReview(true);
      setStep(STEPS.indexOf(target));
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
      // Navigation is locked while waiting, so the suggestible answers haven't changed since the click
      const { applied } = applySuggestion(answers, result.value);
      setAnswers((current) => applySuggestion(current, result.value).answers);
      setSuggested((current) => ({ ...current, ...Object.fromEntries(applied.map((field) => [field, true])) }));
      setPracticeSuggestions(result.value.simulated);
      const count = `${applied.length} ${applied.length === 1 ? "answer" : "answers"}`;
      setAiNote({
        text: result.value.simulated
          ? applied.length
            ? `Practice mode suggested ${count} from your description with simple word matching, not AI. They’re marked “Practice suggestion” for you to check closely.`
            : "Practice mode’s word matching didn’t find answers to fill in. Add more detail, or just continue."
          : applied.length
            ? `AI suggested ${count} from your description. They’re marked “AI suggestion” for you to check.`
            : "AI didn’t find answers to fill in. Add more detail, or just continue.",
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
    try {
      const profile = answersToProfile(answers);
      const result = editing ? await updateBusinessAction(profile) : await createBusinessAction(profile);
      if (!result.ok) throw new Error(result.message);
    } catch (error) {
      const message = error instanceof Error && !(error instanceof TypeError) ? error.message : "";
      setSaveError(message || "Couldn’t reach First Sale. Check your connection and try again.");
      setSaving(false);
      return;
    }
    // Inside the navigation transition, so the reset never shows on screen
    startTransition(() => {
      if (!editing) {
        // Start fresh next time: this screen stays mounted in the background
        setAnswers(EMPTY_ANSWERS);
        setStep(0);
        setReviewing(false);
        setSuggested({});
        setAiNote(null);
      }
      setFromReview(false);
      setSaving(false);
      router.push(editing ? "/business" : "/business?welcome=1");
    });
  }

  const rows = summarize(answers, { followUps: true });
  const answered = rows.filter((row) => row.value);
  // A suggested follow-up counts only while its question is asked
  const isSuggested = (field: SuggestibleField) =>
    Boolean(suggested[field]) && !FOLLOW_UPS.some((followUp) => followUp === field && !asks(followUp, answers));
  const stepHasSuggestion = Object.entries(SUGGESTIBLE).some(
    ([field, shownOn]) => shownOn === stepId && isSuggested(field as SuggestibleField),
  );
  const unsaved = editing && comparable(answers) !== comparable(props.initial);

  if (reviewing) {
    return (
      <PracticeSuggestions value={practiceSuggestions}>
        <div className="flex max-w-3xl flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold text-accent-ink">{editing ? "Your business" : "Last step"}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl font-bold leading-tight tracking-tight">
                {editing ? "Your answers" : "Check your answers"}
              </h1>
              {unsaved ? (
                <span className="rounded-full bg-check-tint px-2.5 py-0.5 text-[13px] font-bold text-check">Unsaved changes</span>
              ) : null}
            </div>
            <p className="text-lg text-muted">
              This is what we understood. Everything here shapes your requirements and startup plan.
            </p>
          </div>
          <dl className="rounded-2xl bg-surface px-5 ring-1 ring-ink/5">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule-tint py-3.5 last:border-b-0">
                <dt className="w-44 font-semibold text-rule">{row.label}</dt>
                <dd className={`flex min-w-0 flex-1 basis-60 flex-wrap items-center gap-2 ${row.value ? "" : "text-muted"}`}>
                  {row.value || "Not answered"}
                  {row.fields.some(isSuggested) ? <AiSuggestionBadge /> : null}
                </dd>
                <button
                  type="button"
                  onClick={() => editFromReview(row.step)}
                  disabled={saving}
                  aria-label={`Edit ${row.label.toLowerCase()}`}
                  className="min-h-11 rounded-lg border border-field px-3.5 text-sm font-semibold hover:border-muted disabled:opacity-60"
                >
                  Edit
                </button>
              </div>
            ))}
          </dl>
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
                  // Drop unsaved edits inside the navigation, so the revert never shows
                  startTransition(() => {
                    setAnswers(props.initial);
                    setSuggested({});
                    setFromReview(false);
                    setSaveError(null);
                    setStepError(null);
                    setAiNote(null);
                    router.push("/business");
                  })
                }
                disabled={saving}
                className={SECONDARY}
              >
                Cancel
              </button>
            ) : (
              <button type="button" onClick={back} disabled={saving} className={SECONDARY}>
                Back
              </button>
            )}
            <button type="button" onClick={save} disabled={saving} className={PRIMARY}>
              {saving ? "Saving…" : editing ? "Save changes" : "Confirm and continue"}
            </button>
          </div>
        </div>
      </PracticeSuggestions>
    );
  }

  const errorId = stepError ? id("step-error") : undefined;
  const city = answers.city.trim();

  const chips = <K extends ChipField>(field: K, labels: Record<Exclude<IntakeAnswers[K], "">, string>, labelledBy: string, describedBy?: string) => (
    <ChoiceChips
      labelledBy={labelledBy}
      describedBy={describedBy}
      options={entries(labels)}
      selected={answers[field] ? [answers[field] as Exclude<IntakeAnswers[K], "">] : []}
      onToggle={(value) => choose(field, value)}
    />
  );

  return (
    <PracticeSuggestions value={practiceSuggestions}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-accent-ink">
            Question {step + 1} of {STEPS.length}
          </span>
          <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(((step + 1) / (STEPS.length + 1)) * 100)}%` }} />
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <section aria-labelledby={id("question")} className="flex min-w-0 flex-col gap-4 rounded-2xl bg-surface p-6 ring-1 ring-ink/5 lg:flex-1">
            {stepId === "idea" ? (
              <>
                <Question id={id("question")} headingRef={headingRef} title="Tell us about your idea" />
                <p className="text-[17px] text-rule">
                  In your own words: what you’ll sell, who you’ll sell to, and where. A sentence or two is plenty.
                </p>
                <label htmlFor={id("describe")} className="font-semibold">
                  Your idea
                </label>
                <textarea
                  id={id("describe")}
                  rows={5}
                  maxLength={1000}
                  value={answers.description}
                  onChange={(e) => update("description", e.target.value)}
                  readOnly={aiPending}
                  placeholder={`For example: ${EXAMPLE}`}
                  className="w-full resize-y rounded-xl border border-field p-3 text-base"
                />
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={fillWithAi}
                    disabled={busy || !answers.description.trim()}
                    className="min-h-12 rounded-lg bg-ai px-5 font-bold text-white disabled:opacity-60"
                  >
                    {aiPending ? "Reading your description…" : "Fill in the questions for me"}
                  </button>
                  <button
                    type="button"
                    onClick={() => update("description", EXAMPLE)}
                    disabled={busy || Boolean(answers.description.trim())}
                    className={SECONDARY}
                  >
                    Use the example
                  </button>
                  <span className="text-sm text-muted">Or skip this and answer each question yourself.</span>
                </div>
                {aiNote ? (
                  <p
                    role="status"
                    className={`rounded-xl px-3.5 py-3 text-[15px] ${aiNote.error ? "bg-check-tint text-check" : "bg-ai-tint text-ai-ink"}`}
                  >
                    {aiNote.text}
                  </p>
                ) : null}
              </>
            ) : null}

            {stepId === "name" ? (
              <>
                <Question id={id("question")} headingRef={headingRef} title="What’s your business called?" />
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
                  className={`${INPUT} disabled:bg-ground`}
                />
                <label className="flex min-h-11 items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={answers.noName}
                    onChange={(e) => update("noName", e.target.checked)}
                    className="size-5 accent-accent"
                  />
                  I haven’t picked a name yet
                </label>
              </>
            ) : null}

            {stepId === "place" ? (
              <>
                <Question id={id("question")} headingRef={headingRef} title="Where will your business be?" suggested={isSuggested("state")} />
                <p className="text-rule">
                  <span className="font-semibold text-ink">Country:</span> United States. First Sale works for US businesses for now.
                </p>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
                  <Field label="State" htmlFor={id("state")}>
                    <select
                      id={id("state")}
                      value={answers.state}
                      onChange={(e) => update("state", e.target.value as IntakeAnswers["state"])}
                      aria-describedby={errorId}
                      aria-invalid={stepError ? true : undefined}
                      className={INPUT}
                    >
                      <option value="">Choose a state</option>
                      {US_STATE_CODES.map((code) => (
                        <option key={code} value={code}>
                          {STATE_NAMES[code]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="County" htmlFor={id("county")}>
                    <input id={id("county")} type="text" maxLength={100} value={answers.county} onChange={(e) => update("county", e.target.value)} className={INPUT} />
                  </Field>
                  <Field label="City or town" htmlFor={id("city")}>
                    <input id={id("city")} type="text" maxLength={100} value={answers.city} onChange={(e) => changeCity(e.target.value)} className={INPUT} />
                  </Field>
                </div>
                {asks("insideCityLimits", answers) ? (
                  <FollowUp
                    id={id("city-limits")}
                    title={`Is your address inside the city limits of ${city}?`}
                    why="A mailing address can name a city you’re not actually inside, and city rules apply only inside city limits. If you’re not sure, your county’s property or planning office can tell you."
                  >
                    {chips("insideCityLimits", YES_NO_LABELS, id("city-limits-question"), id("city-limits-why"))}
                  </FollowUp>
                ) : null}
              </>
            ) : null}

            {stepId === "owners" ? (
              <>
                <Question id={id("question")} headingRef={headingRef} title="Who owns the business?" suggested={isSuggested("owners")} />
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
                      <button
                        type="button"
                        aria-label="Fewer owners"
                        onClick={() => update("ownerCount", Math.max(2, answers.ownerCount - 1))}
                        className="size-11 rounded-lg border border-field text-lg font-bold"
                      >
                        −
                      </button>
                      <span aria-live="polite" className="min-w-8 text-center text-lg font-bold">
                        {answers.ownerCount}
                      </span>
                      <button
                        type="button"
                        aria-label="More owners"
                        onClick={() => update("ownerCount", Math.min(MAX_OWNERS, answers.ownerCount + 1))}
                        className="size-11 rounded-lg border border-field text-lg font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {stepId === "status" ? (
              <>
                <Question id={id("question")} headingRef={headingRef} title="Where are you now?" suggested={isSuggested("stage")} />
                <ChoiceCards
                  labelledBy={id("question")}
                  options={entries(STAGE_LABELS)}
                  selected={answers.stage}
                  onSelect={(value) => update("stage", value)}
                />
                {asks("registeredAs", answers) ? (
                  <FollowUp
                    id={id("registered")}
                    title="What kind of business did you register?"
                    why="Each kind comes with its own next steps. Pick “Not sure” if you don’t know."
                    suggested={isSuggested("registeredAs")}
                  >
                    <ChoiceCards
                      labelledBy={id("registered-question")}
                      describedBy={id("registered-why")}
                      options={entries(REGISTERED_AS_LABELS)}
                      descriptions={REGISTERED_AS_HELP}
                      selected={answers.registeredAs}
                      onSelect={(value) => update("registeredAs", value)}
                    />
                  </FollowUp>
                ) : null}
              </>
            ) : null}

            {stepId === "sell" ? (
              <>
                <Question id={id("question")} headingRef={headingRef} title="What will you sell?" suggested={isSuggested("offeringKinds")} />
                <p className="text-rule">Pick all that fit.</p>
                <ChoiceChips
                  labelledBy={id("question")}
                  describedBy={errorId}
                  options={entries(OFFERING_KIND_LABELS)}
                  selected={answers.offeringKinds}
                  onToggle={(value) => toggle("offeringKinds", value)}
                />
                <Field label="What will you sell first?" htmlFor={id("first-items")}>
                  <input
                    id={id("first-items")}
                    type="text"
                    maxLength={300}
                    value={answers.firstItems}
                    onChange={(e) => update("firstItems", e.target.value)}
                    placeholder="For example: lemon loaves, sourdough, custom cakes"
                    className={INPUT}
                  />
                </Field>
                {asks("foodNeedsCold", answers) ? (
                  <FollowUp
                    id={id("cold")}
                    title="Does any of it need to be kept cold, like cheesecake or cream pies?"
                    why="Rules for food made at home often depend on whether it needs to be kept cold."
                  >
                    {chips("foodNeedsCold", YES_NO_LABELS, id("cold-question"), id("cold-why"))}
                  </FollowUp>
                ) : null}
              </>
            ) : null}

            {stepId === "channels" ? (
              <>
                <Question id={id("question")} headingRef={headingRef} title="How will you sell?" suggested={isSuggested("channels")} />
                <p className="text-rule">Pick all that apply. You can change this later.</p>
                <ChoiceChips
                  labelledBy={id("question")}
                  describedBy={errorId}
                  options={entries(CHANNEL_LABELS)}
                  selected={answers.channels}
                  onToggle={(value) => toggle("channels", value)}
                />
                {asks("shipsOrders", answers) ? (
                  <FollowUp
                    id={id("ships")}
                    title="Will you ship orders?"
                    why="Shipping can add sales tax and labeling questions."
                    suggested={isSuggested("shipsOrders")}
                  >
                    {chips("shipsOrders", YES_NO_LABELS, id("ships-question"), id("ships-why"))}
                  </FollowUp>
                ) : null}
              </>
            ) : null}

            {stepId === "premises" ? (
              <>
                <Question id={id("question")} headingRef={headingRef} title="Where will you work?" suggested={isSuggested("premises")} />
                <ChoiceCards
                  labelledBy={id("question")}
                  options={entries(PREMISES_LABELS)}
                  selected={answers.premises}
                  onSelect={(value) => update("premises", value)}
                />
                {asks("customersVisit", answers) ? (
                  <FollowUp
                    id={id("visits")}
                    title="Will customers come to your home, for pickups or appointments?"
                    why="Rules for home businesses often limit customer visits."
                  >
                    {chips("customersVisit", YES_NO_LABELS, id("visits-question"), id("visits-why"))}
                  </FollowUp>
                ) : null}
              </>
            ) : null}

            {stepId === "money" ? (
              <>
                <Question id={id("question")} headingRef={headingRef} title="Money and help" />
                <h2 id={id("budget-question")} className="mt-1 text-[17px] font-bold">
                  About how much can you spend getting started?
                </h2>
                {chips("startupBudget", BUDGET_LABELS, id("budget-question"))}
                <h2 id={id("hiring-question")} className="mt-2 text-[17px] font-bold">
                  Do you plan to hire anyone?
                </h2>
                {chips("hiringPlans", HIRING_LABELS, id("hiring-question"))}
              </>
            ) : null}

            {stepId === "timing" ? (
              <>
                <Question id={id("question")} headingRef={headingRef} title="Timing and experience" />
                <h2 id={id("launch-question")} className="mt-1 text-[17px] font-bold">
                  When do you hope to start selling?
                </h2>
                {chips("launchTiming", LAUNCH_TIMING_LABELS, id("launch-question"))}
                <h2 id={id("experience-question")} className="mt-2 text-[17px] font-bold">
                  Have you run a business before?
                </h2>
                {chips("experience", EXPERIENCE_LABELS, id("experience-question"))}
              </>
            ) : null}

            {stepHasSuggestion ? (
              <p className="rounded-lg bg-ai-tint px-3 py-2.5 text-sm text-ai-ink">
                Answers marked “AI suggestion” came from your description. Change anything that’s wrong. Continuing confirms them.
              </p>
            ) : null}

            {stepError ? (
              <p id={id("step-error")} ref={errorRef} role="alert" tabIndex={-1} className="text-sm font-semibold text-danger">
                {stepError}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2.5 border-t border-rule-tint pt-3">
              {step > 0 || fromReview ? (
                <button type="button" onClick={back} disabled={busy} className={SECONDARY}>
                  Back
                </button>
              ) : (
                <span />
              )}
              <button type="button" onClick={next} disabled={busy} className={PRIMARY}>
                {fromReview ? "Back to review" : step === STEPS.length - 1 ? "Review my answers" : "Continue"}
              </button>
            </div>
          </section>

          <aside className="flex flex-col gap-3.5 lg:w-72 lg:shrink-0">
            <div className="flex flex-col gap-1.5 rounded-2xl bg-surface p-4.5 ring-1 ring-ink/5">
              <h2 className="font-bold">Why we ask</h2>
              <p className="text-[15px] text-rule">{WHY[stepId]}</p>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4.5 ring-1 ring-ink/5">
              <h2 className="font-bold">Your answers so far</h2>
              {answered.length ? (
                <dl className="flex flex-col gap-2">
                  {answered.map((row) => (
                    <div key={row.label}>
                      <dt className="text-[13px] font-semibold text-muted">{row.label}</dt>
                      <dd className="text-[15px]">{row.value.length > 70 ? `${row.value.slice(0, 67)}…` : row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-muted">Nothing yet.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </PracticeSuggestions>
  );
}

// Same answers in any pick order compare equal
function comparable(a: IntakeAnswers): string {
  const profile = answersToProfile(a);
  return JSON.stringify({
    ...profile,
    offeringKinds: [...profile.offeringKinds].sort(),
    channels: [...profile.channels].sort(),
  });
}

function Question({
  id,
  title,
  suggested,
  headingRef,
}: {
  id: string;
  title: string;
  suggested?: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <h1 id={id} ref={headingRef} tabIndex={-1} className="font-display text-3xl font-bold leading-tight tracking-tight">
        {title}
      </h1>
      {suggested ? <AiSuggestionBadge /> : null}
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

// A question that only shows when an earlier answer makes it matter
function FollowUp({ id, title, why, suggested, children }: { id: string; title: string; why: string; suggested?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-ground p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id={`${id}-question`} className="text-[17px] font-bold">
          {title}
        </h2>
        {suggested ? <AiSuggestionBadge /> : null}
      </div>
      <p id={`${id}-why`} className="text-[15px] text-rule">
        {why}
      </p>
      {children}
    </div>
  );
}
