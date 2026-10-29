"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { recordDecisionsAction } from "@/app/(app)/structure/actions";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { ALERT, PRIMARY, SECONDARY } from "@/components/styles";
import { Card } from "@/components/ui";
import { DETAILS, displayDetail, STRUCTURE_LABELS } from "@/lib/details";
import type { BusinessStructure } from "@/lib/domain";
import { startingStructure } from "@/lib/structure/options";
import { ExplainWhy, RecommendedTag } from "./explain";

type Values = { structure_choice: string; name_registration_plan: string; tax_classification_plan: string };
type Key = keyof Values;

const KEYS: Key[] = ["structure_choice", "name_registration_plan", "tax_classification_plan"];
const SHORT: Record<Key, string> = { structure_choice: "How it’s owned", name_registration_plan: "Name you sell under", tax_classification_plan: "Taxes" };
const MISSING: Record<Key, string> = {
  structure_choice: "Pick how your business will be owned.",
  name_registration_plan: "Pick the name you’ll sell under.",
  tax_classification_plan: "Pick how you’re taxed.",
};

export interface StructureChoice {
  id: BusinessStructure;
  // A few words under the name
  short: string;
  // Reasons, rendered on the server; only for the recommended option
  why: ReactNode | null;
}

// A recommended answer for the name or tax question, with its reasons
export interface PlanPick {
  value: string;
  why: ReactNode;
}

export interface PlanChange {
  title: string;
  fee: string | null;
}

const FOCUS = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";
// A real radio, so the choice shows in every color mode; the card's ring shows focus
const RADIO = "size-5 shrink-0 cursor-pointer accent-accent focus-visible:outline-none";
// Links and folds inside a choice card sit above the label that covers it
const ABOVE = "[&_a]:relative [&_a]:z-10 [&_summary]:relative [&_summary]:z-10";

// The owner's own decision: answer three questions, see exactly what will be recorded and what it changes, then confirm
export function DecisionForm({
  current,
  owners,
  basis,
  stale,
  recordedAt,
  choices,
  extra,
  suggested,
  nameText,
  taxText,
  namePicks,
  taxPicks,
  changes,
  unsure,
}: {
  current: Values;
  owners: number;
  basis: string[];
  // Recorded with answers that have changed since, so it can be confirmed again unchanged
  stale: boolean;
  // When the structure was last recorded
  recordedAt: string | null;
  choices: StructureChoice[];
  // A less common option, folded away
  extra: StructureChoice | null;
  // The rules' suggestion, used for the name and tax picks until a structure is chosen
  suggested: BusinessStructure;
  // What each structure means for the name and taxes, from the rules
  nameText: Partial<Record<string, string>>;
  taxText: Partial<Record<string, string>>;
  // Recommended name and tax answers for each structure; no name pick when the answers don't make it clear
  namePicks: Partial<Record<string, PlanPick | null>>;
  taxPicks: Partial<Record<string, PlanPick | null>>;
  // Plan steps each structure keeps and leaves out; null before requirements are checked
  changes: Partial<Record<string, { kept: PlanChange[]; left: PlanChange[] }>> | null;
  unsure: ReactNode;
}) {
  const uid = useId();
  // A recorded structure that no longer fits the owners has to be chosen again
  const [values, setValues] = useState<Values>({ ...current, structure_choice: startingStructure(current.structure_choice, owners) });
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The view swaps between the options and the review, so focus moves with it
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const moved = useRef(false);
  // After saving, the review button is disabled, so focus goes to the confirmation
  const saved = useRef(false);
  useEffect(() => {
    if (!moved.current) return;
    const target = confirming ? reviewHeading.current : saved.current ? status.current : reviewButton.current;
    saved.current = false;
    target?.focus();
    target?.scrollIntoView({ block: "center" });
  }, [confirming]);
  const show = (next: boolean) => {
    moved.current = true;
    setConfirming(next);
  };

  const pick = (key: Key, value: string) => {
    setValues({ ...values, [key]: value });
    setDone(false);
  };
  const complete = KEYS.every((key) => values[key]);
  const changed = KEYS.filter((key) => values[key] !== current[key]);
  const missing = KEYS.find((key) => !values[key]);
  const structure = values.structure_choice;
  const structureName = structure && structure !== "undecided" ? STRUCTURE_LABELS[structure as BusinessStructure] : null;
  // Name and tax picks follow the chosen structure, or the suggested one until then
  const basisFor = structureName ? structure : suggested;
  const basisName = STRUCTURE_LABELS[basisFor as BusinessStructure].replace(/ \(LLC\)$/, "").toLowerCase();
  const namePick = namePicks[basisFor] ?? null;
  const taxPick = taxPicks[basisFor] ?? null;

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      const result = await recordDecisionsAction(values);
      if (!result.ok) setError(result.message);
      else {
        setDone(true);
        saved.current = true;
        show(false);
      }
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (confirming) {
    const plan = changes?.[structure];
    return (
      <section aria-labelledby={`${uid}-review`} className="flex flex-col gap-5">
        <button type="button" onClick={() => show(false)} disabled={pending} className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-semibold text-muted hover:text-accent">
          <Icon name="back" size="sm" />
          Back to the questions
        </button>
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-[13.5px] font-bold uppercase tracking-[0.08em] text-accent">
            <Icon name="stamp" size="sm" />
            Review
          </p>
          <h3 id={`${uid}-review`} ref={reviewHeading} tabIndex={-1} className="font-display text-[28px] leading-tight focus:outline-none sm:text-[32px]">
            Ready to record your decision?
          </h3>
          <p className="max-w-2xl text-lg text-muted">Check what you’re choosing and what it changes. Nothing changes until you record it.</p>
        </div>

        <div className="grid items-start gap-5 md:grid-cols-2">
          <Card title="You’re choosing" icon="scale" id={`${uid}-choosing`} headingLevel={3} bodyClassName="gap-0 pt-1">
            <dl className="flex flex-col">
              {KEYS.map((key) => (
                <div key={key} className="flex flex-col gap-0.5 border-b border-line py-2.5 last:border-b-0">
                  <dt className="text-[15px] text-muted">{SHORT[key]}</dt>
                  <dd className="font-semibold">
                    {displayDetail(key, values[key])}
                    {changed.includes(key) ? (
                      <span className="ml-1.5 text-sm font-normal text-muted">(was {current[key] ? displayDetail(key, current[key]) : "not decided"})</span>
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="What recording does" icon="check" id={`${uid}-does`} headingLevel={3}>
            <ul className="flex flex-col gap-2 text-[15px]">
              {[
                "Saves it as your decision. Your licenses, registrations and forms use it.",
                "Files nothing. Forming a company or registering a name is a step you take yourself.",
                "Keeps a dated record, with these answers, in your history.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-px grid size-6 shrink-0 place-items-center rounded-[7px] border border-accent-ring bg-accent-tint text-accent">
                    <Icon name="check" size="xs" strokeWidth={2.4} />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="What changes in your plan" icon="list" id={`${uid}-changes`} headingLevel={3}>
          {!changes ? (
            <p className="text-muted">Your requirements aren’t checked yet, so no steps change.</p>
          ) : !plan ? (
            <p className="text-muted">Steps for each structure stay “Depends on something” until you decide.</p>
          ) : plan.kept.length || plan.left.length ? (
            <ul className="flex flex-col gap-1.5">
              {plan.kept.map((step) => (
                <li key={`k-${step.title}`} className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-px grid size-6 shrink-0 place-items-center rounded-[7px] border border-accent-ring bg-accent-tint text-accent">
                    <Icon name="plus" size="xs" strokeWidth={2.4} />
                  </span>
                  <span>
                    <span className="sr-only">In your plan: </span>
                    {step.title}
                    {step.fee ? ` (${step.fee})` : ""}
                  </span>
                </li>
              ))}
              {plan.left.map((step) => (
                <li key={`l-${step.title}`} className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-px grid size-6 shrink-0 place-items-center rounded-[7px] border border-line bg-wash text-muted">
                    <Icon name="minus" size="xs" strokeWidth={2.4} />
                  </span>
                  <span>
                    <span className="sr-only">Left out: </span>
                    {step.title}
                    {step.fee ? ` (${step.fee})` : ""} <span className="text-muted">· comes back if you change</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">None of your steps depend on this choice.</p>
          )}
          {changes ? (
            <p className="text-sm text-muted">Licenses and registrations shows these for you to review before anything changes. Steps you’ve finished stay finished.</p>
          ) : null}
        </Card>

        <Card title="Based on these answers" icon="info" id={`${uid}-basis`} headingLevel={3}>
          <ul className="flex flex-wrap gap-2">
            {basis.map((line) => (
              <li key={line} className="rounded-full border border-line bg-soft px-3 py-1 text-[14.5px] text-rule">
                {line}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">If these answers change later, First Sale tells you this choice was made with older answers.</p>
        </Card>

        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={confirm} disabled={pending} className={PRIMARY}>
            <Icon name="stamp" size="sm" />
            {pending ? "Saving…" : "Record my decision"}
          </button>
          <button type="button" onClick={() => show(false)} disabled={pending} className={SECONDARY}>
            <Icon name="back" size="sm" />
            Go back
          </button>
        </div>
      </section>
    );
  }

  const optionCard = (choice: StructureChoice) => {
    const checked = structure === choice.id;
    return (
      <div
        key={choice.id}
        className={`relative flex flex-col gap-2 rounded-[14px] border bg-surface p-4 shadow-soft transition motion-reduce:transition-none ${ABOVE} ${FOCUS} ${
          checked ? "border-accent shadow-[0_0_0_3px_var(--color-accent-tint)]" : "border-line-strong hover:border-muted"
        }`}
      >
        <label className="flex cursor-pointer items-start gap-3 after:absolute after:inset-0 after:rounded-[14px]">
          <input
            type="radio"
            name={`${uid}-structure_choice`}
            value={choice.id}
            checked={checked}
            onChange={() => pick("structure_choice", choice.id)}
            className={`relative z-10 mt-1 ${RADIO}`}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-display text-lg leading-snug">{STRUCTURE_LABELS[choice.id]}</span>
            <span className="text-[15px] text-muted">{choice.short}</span>
          </span>
        </label>
        {choice.why ? (
          <div className="flex flex-col gap-0.5 pl-8">
            <RecommendedTag />
            <ExplainWhy>{choice.why}</ExplainWhy>
          </div>
        ) : null}
      </div>
    );
  };

  // One answer to the name or tax question, with the rules' pick marked
  const planChoice = (key: Key, value: string, label: string, hint: string | null, recommended: PlanPick | null) => {
    const checked = values[key] === value;
    return (
      <div
        key={value}
        className={`relative flex flex-col gap-1 rounded-xl border bg-surface px-3.5 py-2.5 shadow-soft transition motion-reduce:transition-none ${ABOVE} ${FOCUS} ${
          checked ? "border-accent shadow-[0_0_0_3px_var(--color-accent-tint)]" : "border-line-strong hover:border-muted"
        }`}
      >
        <label className="flex min-h-[30px] cursor-pointer items-center gap-3 after:absolute after:inset-0 after:rounded-xl">
          <input type="radio" name={`${uid}-${key}`} value={value} checked={checked} onChange={() => pick(key, value)} className={`relative z-10 ${RADIO}`} />
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold leading-snug">{label}</span>
            {hint ? <span className="text-sm text-muted">{hint}</span> : null}
          </span>
        </label>
        {recommended?.value === value ? (
          <div className="flex flex-col gap-0.5 pl-8">
            <RecommendedTag />
            <ExplainWhy>{recommended.why}</ExplainWhy>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {recordedAt ? (
        <p className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] text-muted shadow-soft">
          <Icon name="check" size="sm" className="mt-0.5 text-done" />
          <span>
            Saved <LocalDate iso={recordedAt} />
            {current.structure_choice ? `: ${displayDetail("structure_choice", current.structure_choice)}` : ""}. Change anything below and record it again. Each change is kept in your
            decision history.
          </span>
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-[22px] leading-snug">1. How will your business be owned?</legend>
        <div className="grid items-start gap-3 md:grid-cols-2">{choices.map(optionCard)}</div>
        {extra ? (
          <details open={structure === extra.id} className="group/extra rounded-[14px] border border-line bg-surface shadow-soft">
            <summary className="flex min-h-[58px] cursor-pointer list-none items-center gap-3 px-[18px] py-3.5 [&::-webkit-details-marker]:hidden">
              <span className="grid min-w-0 flex-1 gap-px">
                <b className="text-[16.5px] font-bold">Also possible: {STRUCTURE_LABELS[extra.id].toLowerCase()}</b>
                <small className="text-[14.5px] text-muted">Less common for a first business</small>
              </span>
              <Icon name="chevron" className="text-faint transition-transform group-open/extra:rotate-90 motion-reduce:transition-none" />
            </summary>
            <div className="px-[18px] pb-[18px]">{optionCard(extra)}</div>
          </details>
        ) : null}
        <div className="md:max-w-[calc(50%-6px)]">{planChoice("structure_choice", "undecided", STRUCTURE_LABELS.undecided, "Steps that depend on it wait until you decide", null)}</div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-[22px] leading-snug">2. What name will you sell under?</legend>
        {!namePick && nameText[basisFor] ? (
          <p className="rounded-xl border border-line bg-soft px-3.5 py-3 text-[15px] text-rule">
            <span className="font-semibold">For a {basisName}:</span> {nameText[basisFor]}
          </p>
        ) : null}
        <div className="flex max-w-2xl flex-col gap-2">
          {DETAILS.name_registration_plan.options.map(([value, label]) => planChoice("name_registration_plan", value, label, null, namePick))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-[22px] leading-snug">3. How will you be taxed?</legend>
        <div className="flex max-w-2xl flex-col gap-2">
          {DETAILS.tax_classification_plan.options.map(([value, label]) =>
            planChoice("tax_classification_plan", value, label, value === "default" && taxText[basisFor] ? `For a ${basisName}: ${taxText[basisFor]}` : null, taxPick),
          )}
        </div>
      </fieldset>

      <details className="group/unsure rounded-[14px] border border-line bg-surface shadow-soft">
        <summary className="flex min-h-[58px] cursor-pointer list-none items-center gap-3 px-[18px] py-3.5 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-accent-ring bg-accent-tint text-accent">
            <Icon name="question" />
          </span>
          <span className="grid min-w-0 flex-1 gap-px">
            <b className="text-[16.5px] font-bold">Want a second opinion?</b>
            <small className="text-[14.5px] text-muted">Questions to take to a professional, and where to get help</small>
          </span>
          <Icon name="chevron" className="text-faint transition-transform group-open/unsure:rotate-90 motion-reduce:transition-none" />
        </summary>
        <div className="px-[18px] pb-[18px]">{unsure}</div>
      </details>

      <div className="flex flex-col items-start gap-2">
        <button ref={reviewButton} type="button" onClick={() => show(true)} disabled={!complete || (!changed.length && !stale)} className={PRIMARY}>
          {!changed.length && stale ? "Keep it with my new answers" : "Review my choice"}
          <Icon name="arrow" size="sm" />
        </button>
        {missing ? <p className="text-[14.5px] text-muted">{MISSING[missing]}</p> : !changed.length && !stale ? <p className="text-[14.5px] text-muted">Change something above to record it again.</p> : null}
        <p ref={status} tabIndex={-1} role="status" className={done ? "flex items-center gap-1.5 text-[15px] font-semibold text-done focus:outline-none" : "sr-only"}>
          {done ? (
            <>
              <Icon name="check" size="sm" />
              Recorded. You can change it any time, and the history keeps each change.
            </>
          ) : (
            ""
          )}
        </p>
      </div>
    </div>
  );
}
