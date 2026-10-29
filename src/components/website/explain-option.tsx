"use client";

import { useLayoutEffect, useState } from "react";
import { explainOptionAction } from "@/app/(app)/website/option-actions";
import { ActorChip } from "@/components/actor-chip";
import { Icon } from "@/components/icons";
import { ALERT, SECONDARY } from "@/components/styles";
import type { OptionExplanation } from "@/lib/website/options";

// "Explain more": fetched once per option, then shown or hidden
export function ExplainOption({ optionKey, name, explanation }: { optionKey: string; name: string; explanation: OptionExplanation | null }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function toggle() {
    if (open || explanation) {
      setOpen(!open);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await explainOptionAction(optionKey);
      if (!result.ok) setError(result.message);
      else setOpen(true);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={toggle} disabled={pending} aria-expanded={open} className={`${SECONDARY} w-fit`}>
        <Icon name={open ? "close" : "lightbulb"} size="sm" />
        {pending ? "Explaining…" : open ? "Hide the explanation" : `Explain ${name} more`}
      </button>
      <p role="status" className={pending ? "text-sm text-muted" : "sr-only"}>
        {pending ? `Writing a plain explanation of ${name} for your business.` : ""}
      </p>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
      {open && explanation ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-ai/15 bg-ai-tint px-4 py-3.5 text-[15px]">
          <p className="flex items-center gap-2 text-sm font-semibold text-ai-ink">
            {explanation.simulated ? <ActorChip actor="rule" /> : <ActorChip actor="ai" />}
            {explanation.simulated ? "Practice mode: no AI explanation" : "Explained by AI from the facts on this card"}
          </p>
          {explanation.flags.length ? (
            <ul className="flex flex-col gap-1 rounded-lg border border-check-ring bg-check-tint px-3 py-2 text-sm text-check">
              {explanation.flags.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
          ) : null}
          <p>{explanation.overview}</p>
          <Part title="What it’s like to use" text={explanation.whatItsLike} />
          <Part title="Why it could fit you" text={explanation.goodFit} />
          <Part title="What to watch out for" text={explanation.watchOut} />
          <Part title="Your first year" text={explanation.firstYear} />
          {explanation.stillNeed.length ? (
            <div>
              <p className="font-bold">You’ll still need</p>
              <ul className="list-disc pl-5 text-rule">
                {explanation.stillNeed.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Part({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="font-bold">{title}</p>
      <p className="text-rule">{text}</p>
    </div>
  );
}
