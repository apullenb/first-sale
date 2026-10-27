"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useLayoutEffect, useRef, useState } from "react";
import { generatePhotoAction } from "@/app/(app)/photos/actions";
import { ActorChip } from "@/components/actor-chip";
import { AI_BUTTON, ALERT, INPUT } from "@/components/styles";
import { MAX_ANSWER } from "@/lib/photos/instructions";
import { CATEGORIES, CROPS, LOOKS } from "@/lib/photos/looks";
import { PHOTO_CATEGORIES, PHOTO_CROPS, PHOTO_LOOKS, type PhotoCategory, type PhotoCrop, type PhotoLook } from "@/lib/photos/types";
import { useRequestKey, Working } from "./working";

const CHOICE =
  "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border border-field bg-surface px-3.5 py-2.5 has-checked:border-accent has-checked:bg-accent-tint has-focus-visible:ring-2 has-focus-visible:ring-accent";

interface Props {
  photoId: string;
  objects: { name: string }[];
  question: string | null;
  // The check's guess, so the owner knows it came from AI
  aiCategory: boolean;
  initial: { category: PhotoCategory | null; forSale: string[]; answer: string | null; look: PhotoLook; crop: PhotoCrop };
  season: string;
  hasVersions: boolean;
  // Why making a version is off right now, if it is
  blocked: string | null;
}

export function PhotoSetup({ photoId, objects, question, aiCategory, initial, season, hasVersions, blocked }: Props) {
  const uid = useId();
  const router = useRouter();
  const requestKey = useRequestKey();
  const [category, setCategory] = useState<PhotoCategory | null>(initial.category);
  const [forSale, setForSale] = useState<string[]>(initial.forSale);
  const [answer, setAnswer] = useState(initial.answer ?? "");
  const [look, setLook] = useState<PhotoLook>(initial.look);
  const [crop, setCrop] = useState<PhotoCrop>(initial.crop);
  const [pending, setPending] = useState(false);
  // Set before the first await, so a second submit in the same moment can't slip through
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  // A different request gets a new key
  function changed<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      requestKey.clear();
      setError(null);
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || blocked) return;
    if (!category) return setError("Choose what kind of product this is.");
    if (objects.length > 1 && forSale.length === 0) return setError("Tick at least one thing you’re selling.");
    if (question && !answer.trim()) return setError("Answer the question about your photo first.");
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await generatePhotoAction({ photoId, requestKey: requestKey.get(), look, crop, category, forSale, answer });
      if (!result.ok) return setError(result.message);
      requestKey.clear();
      router.push(`/photos/${photoId}?v=${result.value}`);
    } catch {
      // Same key on the next try, so a photo already made isn't paid for twice
      setError("Couldn’t reach First Sale. Check your connection, then try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">What kind of product is this?</legend>
        <p className="text-sm text-muted">
          {aiCategory ? "AI’s guess is picked. Change it if it’s wrong: each kind has its own rules for staying accurate." : "Choose one. Each kind has its own rules for staying accurate."}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PHOTO_CATEGORIES.map((value) => (
            <label key={value} className={CHOICE}>
              <input
                type="radio"
                name={`${uid}-category`}
                checked={category === value}
                onChange={() => changed(setCategory)(value)}
                className="mt-1 size-4 shrink-0 accent-accent"
              />
              <span className="font-semibold">{CATEGORIES[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {objects.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Which of these are you selling?</legend>
          <p className="text-sm text-muted">Anything you don’t tick is taken out of the photo, so it doesn’t look included.</p>
          <div className="flex flex-col gap-2">
            {objects.map((object) => (
              <label key={object.name} className={CHOICE}>
                <input
                  type="checkbox"
                  checked={forSale.includes(object.name)}
                  onChange={(event) =>
                    changed(setForSale)(event.target.checked ? [...forSale, object.name] : forSale.filter((name) => name !== object.name))
                  }
                  className="mt-1 size-4 shrink-0 accent-accent"
                />
                <span>{object.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {question ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-answer`} className="flex flex-wrap items-center gap-2 font-semibold">
            <ActorChip actor="ai" /> {question}
          </label>
          <input
            id={`${uid}-answer`}
            type="text"
            maxLength={MAX_ANSWER}
            value={answer}
            onChange={(event) => changed(setAnswer)(event.target.value)}
            className={INPUT}
            aria-describedby={`${uid}-answer-help`}
          />
          <p id={`${uid}-answer-help`} className="text-sm text-muted">
            Your answer helps keep the photo true to what customers will get.
          </p>
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Choose a look</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PHOTO_LOOKS.map((value) => (
            <label key={value} className={CHOICE}>
              <input
                type="radio"
                name={`${uid}-look`}
                checked={look === value}
                onChange={() => changed(setLook)(value)}
                className="mt-1 size-4 shrink-0 accent-accent"
              />
              <span className="flex flex-col">
                <span className="font-semibold">
                  {LOOKS[value].label}
                  {value === "seasonal" ? ` (${season})` : ""}
                  {value === "studio" ? <span className="font-normal text-muted"> · default</span> : null}
                </span>
                <span className="text-sm text-muted">{LOOKS[value].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Shape</legend>
        <div className="flex flex-wrap gap-2">
          {PHOTO_CROPS.map((value) => (
            <label key={value} className={`${CHOICE} items-center`}>
              <input
                type="radio"
                name={`${uid}-crop`}
                checked={crop === value}
                onChange={() => changed(setCrop)(value)}
                className="size-4 shrink-0 accent-accent"
              />
              <span className="font-semibold">
                {CROPS[value].label} <span className="font-normal text-muted">{CROPS[value].ratio}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-sm text-muted">The whole product stays in the frame whichever shape you pick.</p>
      </fieldset>

      {blocked ? (
        <p className={ALERT}>{blocked}</p>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <button type="submit" disabled={pending} className={AI_BUTTON}>
            {pending ? "Making your photo…" : hasVersions ? "Make another version" : "Make my store photo"}
          </button>
          <p className="text-sm text-muted">Your original photo is kept as it is. Each try is saved as a new version.</p>
        </div>
      )}
      <Working active={pending} label="Making your photo, then checking it against your original. This can take a minute or two." />
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </form>
  );
}
