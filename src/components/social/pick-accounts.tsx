"use client";

import { useLayoutEffect, useState } from "react";
import { pickSocialAccountsAction } from "@/app/(app)/social/actions";
import { Icon } from "@/components/icons";
import { PICKS, PickTile, Why } from "@/components/marketing/pieces";
import { ALERT, PRIMARY } from "@/components/styles";
import { MARKETING_PLATFORMS, type MarketingPlatformId, PLATFORM_DATA } from "@/data/marketing-platforms";
import { SKILL_LEVELS, SKILL_QUESTIONS, type SkillLevel } from "@/lib/marketing/intake";

const SOCIAL_QUESTION = SKILL_QUESTIONS.find((question) => question.area === "social")!;

// Accounts to set up, picked here before the marketing questions; saved with those answers
export function PickAccounts({ include, social }: { include: MarketingPlatformId[]; social: SkillLevel | null }) {
  const [picked, setPicked] = useState(include);
  const [level, setLevel] = useState(social);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const result = await pickSocialAccountsAction({ include: picked, social: level });
      if (!result.ok) setError(result.message);
    } catch {
      setError("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3" aria-describedby="pick-why">
        <legend className="mb-1 font-display text-[20px] leading-snug">Which accounts do you want?</legend>
        <Why id="pick-why">They’re saved with your marketing answers, so your plan starts from them.</Why>
        <div className={PICKS.cards}>
          {MARKETING_PLATFORMS.map((id) => (
            <PickTile
              key={id}
              pressed={picked.includes(id)}
              onClick={() => setPicked((list) => (list.includes(id) ? list.filter((each) => each !== id) : [...list, id]))}
              label={PLATFORM_DATA[id].name}
              description={PLATFORM_DATA[id].goodFor}
              layout="top"
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-3" aria-describedby="level-why">
        <legend className="mb-1 font-display text-[20px] leading-snug">{SOCIAL_QUESTION.title}</legend>
        <Why id="level-why">{SOCIAL_QUESTION.why}</Why>
        <div className={PICKS.cards}>
          {SKILL_LEVELS.map((value) => (
            <PickTile
              key={value}
              pressed={level === value}
              onClick={() => setLevel(value)}
              label={SOCIAL_QUESTION.options[value].label}
              description={SOCIAL_QUESTION.options[value].description}
              layout="top"
            />
          ))}
        </div>
      </fieldset>
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
      <button type="button" disabled={pending || !picked.length} onClick={save} className={`${PRIMARY} w-fit`}>
        <Icon name="check" size="sm" />
        {pending ? "Saving…" : "Set up these accounts"}
      </button>
    </div>
  );
}
