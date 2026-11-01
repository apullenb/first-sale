"use client";

import { useId, useLayoutEffect, useState } from "react";
import { saveWebsiteCopyAction } from "@/app/(app)/website/actions";
import { Icon } from "@/components/icons";
import { SOFT } from "@/components/marketing/pieces";
import { ALERT, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import type { WebsiteCopy } from "@/lib/website/types";
import { placeholderCount } from "@/lib/website/words";

interface Props {
  copy: WebsiteCopy;
  flags: string[];
  approved: boolean;
  // Changes whenever the saved copy does
  signature: string;
}

// The owner's edits to the drafted words; approving saves a printable copy to Documents
export function CopyEditor({ copy: saved, flags, approved, signature }: Props) {
  const uid = useId();
  const [copy, setCopy] = useState(saved);
  const [seen, setSeen] = useState(signature);
  const [status, setStatus] = useState<"idle" | "saving" | "approving" | "saved" | "approved">("idle");
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  // A new draft from the server replaces the editor's contents
  if (seen !== signature) {
    setSeen(signature);
    setCopy(saved);
  }

  const text = JSON.stringify(copy);
  const dirty = text !== JSON.stringify(saved);
  const placeholders = placeholderCount(copy);
  const openFlags = flags.filter((flag) => {
    const quoted = flag.match(/“([^”]+)”/)?.[1];
    return !quoted || text.includes(quoted);
  });
  const pending = status === "saving" || status === "approving";

  function change(patch: Partial<WebsiteCopy>) {
    setCopy((current) => ({ ...current, ...patch }));
    if (status === "saved" || status === "approved") setStatus("idle");
  }

  async function save(approve: boolean) {
    if (approve && (placeholders || openFlags.length)) {
      const left = [placeholders ? `${placeholders} [bracketed] notes` : "", openFlags.length ? `${openFlags.length} numbers to check` : ""]
        .filter(Boolean)
        .join(" and ");
      if (!window.confirm(`There are still ${left}. Approve anyway?`)) return;
    }
    setStatus(approve ? "approving" : "saving");
    setError(null);
    try {
      const result = await saveWebsiteCopyAction({ copy, approve, draftedAt: signature });
      if (!result.ok) {
        setError(result.message);
        setStatus("idle");
      } else setStatus(approve ? "approved" : "saved");
    } catch {
      setError("Couldn’t reach SnapStart. Check your connection and try again.");
      setStatus("idle");
    }
  }

  const field = (label: string, value: string, onChange: (value: string) => void, options: { rows?: number; max: number; hint?: string }) => {
    const id = `${uid}-${label.replace(/\W+/g, "-").toLowerCase()}`;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {options.hint ? <p className="text-sm text-muted">{options.hint}</p> : null}
        {options.rows ? (
          <textarea id={id} rows={options.rows} maxLength={options.max} value={value} onChange={(event) => onChange(event.target.value)} className={`${INPUT} resize-y`} />
        ) : (
          <input id={id} type="text" maxLength={options.max} value={value} onChange={(event) => onChange(event.target.value)} className={INPUT} />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {openFlags.length ? (
        <ul className="flex list-disc flex-col gap-1 rounded-xl border border-check-ring bg-check-tint py-3 pr-3.5 pl-8 text-[15px] text-check">
          {openFlags.map((flag) => (
            <li key={flag}>{flag}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-muted" aria-live="polite">
        {placeholders
          ? `${placeholders} [bracketed] ${placeholders === 1 ? "note" : "notes"} left to fill in. Replace each with your own words, or delete it.`
          : "No [bracketed] notes left."}
      </p>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 w-full border-t border-line pt-5 font-display text-[20px] leading-snug">Home page</legend>
        {field("Headline", copy.headline, (headline) => change({ headline }), { max: 80 })}
        {field("Line under the headline", copy.subheadline, (subheadline) => change({ subheadline }), { max: 160 })}
        {field("Welcome", copy.intro, (intro) => change({ intro }), { rows: 4, max: 800 })}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 w-full border-t border-line pt-5 font-display text-[20px] leading-snug">About</legend>
        {field("Your story", copy.about, (about) => change({ about }), { rows: 6, max: 1500 })}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 w-full border-t border-line pt-5 font-display text-[20px] leading-snug">What you sell</legend>
        {copy.offerings.map((item, index) => (
          <div key={index} className={`${SOFT} flex flex-col gap-2 p-3.5`}>
            {field(`Item ${index + 1} name`, item.name, (name) => change({ offerings: copy.offerings.map((each, at) => (at === index ? { ...each, name } : each)) }), { max: 80 })}
            {field(`Item ${index + 1} description`, item.description, (description) => change({ offerings: copy.offerings.map((each, at) => (at === index ? { ...each, description } : each)) }), { rows: 2, max: 300 })}
            <button type="button" onClick={() => change({ offerings: copy.offerings.filter((_, at) => at !== index) })} className={`${SECONDARY} w-fit`}>
              <Icon name="trash" size="sm" />
              Remove item {index + 1}
            </button>
          </div>
        ))}
        {copy.offerings.length < 12 ? (
          <button type="button" onClick={() => change({ offerings: [...copy.offerings, { name: "", description: "" }] })} className={`${SECONDARY} w-fit`}>
            <Icon name="pencil" size="sm" />
            Add an item
          </button>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 w-full border-t border-line pt-5 font-display text-[20px] leading-snug">Ordering and contact</legend>
        {field("How to buy", copy.howToBuy, (howToBuy) => change({ howToBuy }), { rows: 4, max: 1200 })}
        {field("How to reach you", copy.contact, (contact) => change({ contact }), { rows: 3, max: 600 })}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 w-full border-t border-line pt-5 font-display text-[20px] leading-snug">Questions customers ask</legend>
        {copy.faq.map((entry, index) => (
          <div key={index} className={`${SOFT} flex flex-col gap-2 p-3.5`}>
            {field(`Question ${index + 1}`, entry.question, (question) => change({ faq: copy.faq.map((each, at) => (at === index ? { ...each, question } : each)) }), { max: 150 })}
            {field(`Answer ${index + 1}`, entry.answer, (answer) => change({ faq: copy.faq.map((each, at) => (at === index ? { ...each, answer } : each)) }), { rows: 2, max: 500 })}
            <button type="button" onClick={() => change({ faq: copy.faq.filter((_, at) => at !== index) })} className={`${SECONDARY} w-fit`}>
              <Icon name="trash" size="sm" />
              Remove question {index + 1}
            </button>
          </div>
        ))}
        {copy.faq.length < 8 ? (
          <button type="button" onClick={() => change({ faq: [...copy.faq, { question: "", answer: "" }] })} className={`${SECONDARY} w-fit`}>
            <Icon name="question" size="sm" />
            Add a question
          </button>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 w-full border-t border-line pt-5 font-display text-[20px] leading-snug">How search results show your site</legend>
        {field("Page title", copy.seoTitle, (seoTitle) => change({ seoTitle }), { max: 60, hint: "Up to 60 characters. Search engines show this as the link." })}
        {field("Description", copy.seoDescription, (seoDescription) => change({ seoDescription }), { rows: 2, max: 160, hint: "Up to 155 characters, shown under the link." })}
      </fieldset>

      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
      <p role="status" className="text-sm text-muted">
        {status === "saved" ? "Your changes are saved." : status === "approved" ? "Approved. A printable copy is in your Documents." : ""}
        {approved && !dirty && status === "idle" ? "You approved these words. A printable copy is in your Documents." : ""}
      </p>
      <div className="flex flex-wrap gap-2.5 border-t border-line pt-4">
        <button type="button" disabled={pending || !dirty} onClick={() => save(false)} className={SECONDARY}>
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        <button type="button" disabled={pending} onClick={() => save(true)} className={PRIMARY}>
          <Icon name="check" size="sm" />
          {status === "approving" ? "Approving…" : "Approve these words"}
        </button>
      </div>
    </div>
  );
}
