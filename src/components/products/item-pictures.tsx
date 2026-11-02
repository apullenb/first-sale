"use client";

import { type FormEvent, useId, useLayoutEffect, useRef, useState } from "react";
import { approvePictureAction, clearPicturesAction, makePictureAction } from "@/app/(app)/products/actions";
import { Icon } from "@/components/icons";
import { RUNNING_ELSEWHERE, useJobWatch } from "@/components/job-watch";
import { AI_BUTTON, ALERT, INPUT, SECONDARY } from "@/components/styles";
import { useRequestKey, Working } from "@/components/working";
import type { ListedProduct } from "./product-list";

const OFFLINE = "Couldn’t reach SnapStart. Check your connection, then try again.";

interface Picture {
  id: string;
  change: string | null;
  simulated: boolean;
  approved: boolean;
  src: string;
}

// Pictures made from an item's description: make one, ask for changes, and approve one before it's used
export function ItemPictures({ item, pictures, inUse, changeLimit }: { item: ListedProduct; pictures: Picture[]; inUse: string | null; changeLimit: number }) {
  const uid = useId();
  const requestKey = useRequestKey();
  const [change, setChange] = useState("");
  const [pending, setPending] = useState<"make" | "change" | null>(null);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const job = useJobWatch();
  useLayoutEffect(() => () => setError(null), []);
  const newest = pictures.at(-1) ?? null;
  const service = item.kind === "service";

  async function run(kind: "make" | "change") {
    if (job.watching || inFlight.current) return;
    if (kind === "change" && change.trim().length < 3) return setError("Say what you’d like changed.");
    inFlight.current = true;
    setPending(kind);
    setError(null);
    try {
      const result = await makePictureAction({ productId: item.id, requestKey: requestKey.get(), baseId: kind === "change" ? newest?.id : null, change: kind === "change" ? change : null });
      if (!result.ok && result.busy) return job.watch([result.busy]);
      if (!result.ok) return setError(result.message);
      requestKey.clear();
      setChange("");
    } catch {
      setError(OFFLINE);
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  function submitChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run("change");
  }

  return (
    <section aria-labelledby={`${uid}-heading`} className="@container flex flex-col gap-4 rounded-xl border border-line bg-soft p-4">
      <h4 id={`${uid}-heading`} className="font-bold">
        Pictures of {item.name}
      </h4>
      <p className="text-sm text-muted">
        Made from the description, in your brand’s picture style. {service ? "It shows the kind of work you do, not your actual work." : "Check it shows your product as it really is."} You approve one before it’s used.
      </p>
      {pictures.length ? (
        <ul className="grid grid-cols-2 gap-3 @md:grid-cols-3">
          {[...pictures].reverse().map((picture, index) => (
            <li key={picture.id}>
              <PictureCard picture={picture} productId={item.id} name={item.name} newest={index === 0} inUse={inUse === picture.id} />
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={() => void run("make")} disabled={pending !== null || job.watching} className={`${AI_BUTTON} self-start`}>
        <Icon name="sparkles" size="sm" />
        {pending === "make" ? "Making the picture…" : pictures.length ? "Make a new picture" : "Make a picture from the description"}
      </button>
      {newest ? (
        <form onSubmit={submitChange} className="flex flex-col gap-2">
          <label htmlFor={`${uid}-change`} className="font-semibold">
            Ask for a change to the newest picture
          </label>
          <textarea
            id={`${uid}-change`}
            rows={2}
            maxLength={changeLimit}
            value={change}
            onChange={(event) => {
              setChange(event.target.value);
              requestKey.clear();
            }}
            placeholder="Such as: a wooden table instead, or warmer light"
            className={INPUT}
          />
          <button type="submit" disabled={pending !== null || job.watching} className={`${SECONDARY} self-start`}>
            <Icon name="sparkles" size="sm" />
            {pending === "change" ? "Making the change…" : "Make this change"}
          </button>
        </form>
      ) : null}
      <Working active={pending !== null || job.watching} label={job.watching ? RUNNING_ELSEWHERE : "Making the picture. This can take a minute or two."} />
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
      {pictures.some((picture) => picture.id !== inUse) ? (
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm("Remove the pictures of this item you’re not using?")) return;
            const result = await clearPicturesAction(item.id).catch(() => null);
            if (!result?.ok) setError(result?.message ?? OFFLINE);
          }}
          className="w-fit text-sm text-muted underline underline-offset-[3px] hover:text-accent"
        >
          Remove pictures you’re not using
        </button>
      ) : null}
    </section>
  );
}

function PictureCard({ picture, productId, name, newest, inUse }: { picture: Picture; productId: string; name: string; newest: boolean; inUse: boolean }) {
  const uid = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!confirmed) return setError("Tick the box once you’ve checked the picture.");
    setPending(true);
    setError(null);
    try {
      const result = await approvePictureAction({ productId, pictureId: picture.id, confirmed: true });
      if (!result.ok) setError(result.message);
    } catch {
      setError(OFFLINE);
    } finally {
      setPending(false);
    }
  }

  return (
    <figure aria-label={`${newest ? "Newest picture" : "Earlier picture"} of ${name}`} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={picture.src} alt={`Picture of ${name}${picture.simulated ? ", practice preview" : ""}`} className="aspect-square w-full rounded-lg bg-soft object-cover" />
      <figcaption className="flex flex-col gap-1 text-sm">
        {picture.simulated ? <span className="font-semibold text-check">Practice preview, not made by AI</span> : null}
        <span className="text-muted">{picture.change ? `Change: ${picture.change}` : "From the description"}</span>
        {inUse ? <span className="font-semibold text-done">In use as its photo</span> : null}
      </figcaption>
      {inUse ? null : (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${uid}-ok`} className="flex items-start gap-2 text-sm">
            <input id={`${uid}-ok`} type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
            <span>{picture.simulated ? "I understand this is only a practice preview" : "I checked it shows what I sell accurately"}</span>
          </label>
          <button type="button" onClick={() => void approve()} disabled={pending} className={SECONDARY}>
            <Icon name="check" size="sm" />
            {pending ? "Saving…" : "Use this picture"}
          </button>
          {error ? (
            <p role="alert" className={ALERT}>
              {error}
            </p>
          ) : null}
        </div>
      )}
    </figure>
  );
}
