"use client";

import { useLayoutEffect, useState, useTransition } from "react";
import { chooseContactAction, markContactHaveAction, saveContactAction, undoContactHaveAction } from "@/app/(app)/contact/actions";
import type { ActionResult } from "@/app/(app)/business/actions";
import { Icon } from "@/components/icons";
import { ALERT, INPUT, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";
import { Chip, OutsideLink, Source } from "@/components/ui";
import { type ContactGuide, GMAIL_GUIDE, VOICE_GUIDE } from "@/data/contact-setup";
import { CONTACT_STEP_TITLE, type ContactItem, type ItemState } from "@/lib/rules/contact-setup";

const ITEMS: Record<ContactItem, { label: string; field: string; type: string; autoComplete: string; placeholder: string; guide: ContactGuide }> = {
  email: { label: "Business email", field: "Your business email", type: "email", autoComplete: "email", placeholder: "hello@yourbusiness.com", guide: GMAIL_GUIDE },
  phone: { label: "Business phone", field: "Your business phone", type: "tel", autoComplete: "tel", placeholder: "(512) 555-0123", guide: VOICE_GUIDE },
};

type Choice = "have" | "help" | "later";

export interface ContactItemView {
  state: ItemState;
  // Saved in Business details
  value: string | null;
}

// Whether the owner has a business email and phone, or wants help or to do it later. Nothing is sent and no password is asked for.
export function ContactSetup({ items, guides = "choice" }: { items: Record<ContactItem, ContactItemView>; guides?: "choice" | "open" }) {
  return (
    <div className="flex flex-col gap-5">
      {(Object.keys(ITEMS) as ContactItem[]).map((item) => (
        <ItemSetup key={item} item={item} view={items[item]} openGuide={guides === "open"} />
      ))}
    </div>
  );
}

function ItemSetup({ item, view, openGuide }: { item: ContactItem; view: ContactItemView; openGuide: boolean }) {
  const spec = ITEMS[item];
  const [choice, setChoice] = useState<Choice | null>(view.state === "todo" && openGuide ? "help" : null);
  const [value, setValue] = useState(view.value ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const headingId = `contact-${item}`;
  const inputId = `contact-${item}-value`;

  // Clear old errors when the page is hidden: kept-mounted screens keep their state
  useLayoutEffect(() => () => setError(null), []);

  function run(action: () => Promise<ActionResult>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) return setError(result.message);
        after?.();
      } catch {
        setError("Couldn’t reach SnapStart. Check your connection and try again.");
      }
    });
  }

  function pick(next: Choice) {
    setChoice(next);
    if (next !== "have") run(() => chooseContactAction({ item, choice: next }));
  }

  const done = view.state === "done" && !editing;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 id={headingId} className="text-[17.5px] font-bold">
          {spec.label}
        </h3>
        {view.state === "done" ? (
          <Chip tone="done" icon="check">
            Done
          </Chip>
        ) : view.state === "todo" ? (
          <Chip tone="warn">In your plan</Chip>
        ) : null}
      </div>

      {done ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-semibold">{view.value ?? "You already have one."}</span>
          {view.value ? (
            <button type="button" onClick={() => setEditing(true)} className={`min-h-11 ${TEXT_LINK}`}>
              Change<span className="sr-only"> your {spec.label.toLowerCase()}</span>
            </button>
          ) : (
            <button type="button" data-writes disabled={pending} onClick={() => run(() => undoContactHaveAction(item))} className={`min-h-11 ${TEXT_LINK}`}>
              Undo<span className="sr-only">: I already have a {spec.label.toLowerCase()}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {editing ? null : (
            <div role="group" aria-labelledby={headingId} className="flex flex-wrap gap-2">
              {(
                [
                  ["have", "I have one"],
                  ["help", "Help me set one up"],
                  ["later", "Do this later"],
                ] as const
              ).map(([key, label]) => (
                <button key={key} type="button" data-writes={key === "have" ? undefined : ""} aria-pressed={choice === key} disabled={pending} onClick={() => pick(key)} className={choice === key ? PRIMARY : SECONDARY}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {choice === "have" || editing ? (
            <form
              noValidate
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  () => saveContactAction({ item, value }),
                  () => {
                    setEditing(false);
                    setChoice(null);
                  },
                );
              }}
            >
              <label htmlFor={inputId} className="font-semibold">
                {spec.field}
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id={inputId}
                  type={spec.type}
                  autoComplete={spec.autoComplete}
                  maxLength={item === "email" ? 200 : 40}
                  value={value}
                  placeholder={spec.placeholder}
                  onChange={(event) => setValue(event.target.value)}
                  className={`${INPUT} min-w-0 flex-1 basis-56`}
                />
                <button type="submit" disabled={pending} className={PRIMARY}>
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
              <p className="text-sm text-muted">Saved to your business details, where forms and your website read your public contact details. Never enter a password here.</p>
            </form>
          ) : null}

          {choice === "help" ? <Guide guide={spec.guide} /> : null}

          {choice === "later" ? (
            <p role="status" className="flex items-center gap-2 text-[15px] text-rule">
              <Icon name="check" size="sm" className="text-accent" />
              Added to your plan as “{CONTACT_STEP_TITLE}”. Finish it here whenever you’re ready.
            </p>
          ) : null}

          {view.state === "todo" ? (
            <button type="button" data-writes disabled={pending} onClick={() => run(() => markContactHaveAction(item))} className={`w-fit min-h-11 ${TEXT_LINK}`}>
              I already have this
            </button>
          ) : null}
        </>
      )}

      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </section>
  );
}

// Google's own steps, with every fact quoted from Google's pages; the owner signs up on Google's site
export function Guide({ guide }: { guide: ContactGuide }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-soft p-4">
      <p className="font-bold">{guide.title}</p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 marker:font-semibold marker:text-accent">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Source url={guide.stepsSource.url} title={guide.stepsSource.title} checkedOn={guide.stepsSource.checked} lead="Steps from" />
      <OutsideLink href={guide.signUp.url}>Sign up on {guide.signUp.label}</OutsideLink>
      <ul className="flex flex-col gap-1.5 text-[15px]">
        {guide.facts.map((fact) => (
          <li key={fact.quote} className="flex flex-col">
            <span>
              <b className="font-semibold">{fact.label}:</b> “{fact.quote}”
            </span>
            <Source url={fact.source.url} title={fact.source.title} checkedOn={fact.source.checked} />
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">{guide.unstated}</p>
      <p className="text-sm text-muted">You create the account yourself on Google’s site. SnapStart doesn’t create accounts or see your password.</p>
    </div>
  );
}
