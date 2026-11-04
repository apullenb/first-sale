"use client";

import { type FormEvent, useId, useLayoutEffect, useRef, useState } from "react";
import { approvePictureAction, clearPicturesAction, deletePictureAction, makePictureAction, makeViewsAction } from "@/app/(app)/products/actions";
import { Icon } from "@/components/icons";
import { RUNNING_ELSEWHERE, useJobWatch } from "@/components/job-watch";
import { AI_BUTTON, ALERT, INPUT, SECONDARY } from "@/components/styles";
import { useRequestKey, Working } from "@/components/working";
import { EXTRA_VIEWS, type PictureView, VIEW_LABELS, type Wearer, WEARER_LABELS, WEARERS, wearerFor } from "@/lib/rules/picture-views";
import type { ListedProduct } from "./product-list";
import { failedMessage } from "@/lib/failure";


export interface Picture {
  id: string;
  view: PictureView;
  change: string | null;
  simulated: boolean;
  approved: boolean;
  src: string;
}

type Run = () => Promise<{ ok: true } | { ok: false; message: string; busy?: { workflow: string; subjectId: string | null } }>;

// One AI job at a time from this panel, followed if it's already running elsewhere
function useRun() {
  const job = useJobWatch();
  const inFlight = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => () => setError(null), []);
  async function run(key: string, action: Run, after?: () => void) {
    if (job.watching || inFlight.current) return;
    inFlight.current = true;
    setPending(key);
    setError(null);
    try {
      const result = await action();
      if (!result.ok && result.busy) return job.watch([result.busy as never]);
      if (!result.ok) return setError(result.message);
      after?.();
    } catch {
      setError(failedMessage());
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }
  return { run, pending, error, setError, watching: job.watching, busy: pending !== null || job.watching };
}

// The item's picture set: a main photo, then three views made from it. Approved ones are its gallery, in this order.
export function ItemPictures({ item, pictures, inUse, changeLimit, hasOwnPhoto }: { item: ListedProduct; pictures: Picture[]; inUse: string | null; changeLimit: number; hasOwnPhoto: boolean }) {
  const uid = useId();
  const requestKey = useRequestKey();
  const work = useRun();
  const [wearer, setWearer] = useState<Wearer | null>(null);
  const labels = VIEW_LABELS[item.kind];
  const of = (view: PictureView) => pictures.filter((picture) => picture.view === view);
  const mainApproved = of("main").some((picture) => picture.approved && picture.id === inUse);
  const ask = wearerFor({ ...item, wearer: item.wearer ?? null }) === "ask";
  const anyViews = EXTRA_VIEWS.some((view) => of(view).length);
  const mainLabel = item.kind === "service"
    ? work.pending === "make:main" ? "Generating service photo…" : of("main").length ? "Generate another service photo" : "Generate service photo"
    : work.pending === "make:main" ? "Making the main photo…" : of("main").length ? "Make a new main photo" : hasOwnPhoto ? "Make a main photo from your photo" : "Make a main photo from the description";

  const make = (view: PictureView) =>
    work.run(`make:${view}`, () => makePictureAction({ productId: item.id, requestKey: requestKey.get(), view, baseId: null, change: null }), requestKey.clear);

  return (
    <section aria-labelledby={`${uid}-heading`} className="@container flex flex-col gap-5 rounded-xl border border-line bg-soft p-4">
      <div className="flex flex-col gap-1">
        <h4 id={`${uid}-heading`} className="font-bold">
          Pictures of {item.name}
        </h4>
        <p className="text-sm text-muted">
          First a main photo{hasOwnPhoto ? " made from your photo" : " made from the description"}, in your brand’s picture style. It is used as the item’s photo right away, and SnapStart can make three more views from it. Approved pictures are the item’s gallery, in this order.
          {item.kind === "service" ? " They show the kind of work you do, not your actual work." : ""}
        </p>
      </div>

      <ViewGroup title={labels.main} pictures={of("main")} item={item} inUse={inUse} changeLimit={changeLimit} work={work} view="main">
        <button data-writes type="button" onClick={() => void make("main")} disabled={work.busy} className={`${AI_BUTTON} self-start`}>
          <Icon name="sparkles" size="sm" />
          {mainLabel}
        </button>
      </ViewGroup>

      {mainApproved ? (
        <div className="flex flex-col gap-4 border-t border-line pt-4">
          <h5 className="font-bold">More views</h5>
          {ask ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-semibold">Who wears it?</legend>
              <p className="text-sm text-muted">So the in-use picture shows the right person. The description doesn’t say.</p>
              <div className="flex flex-wrap gap-2">
                {WEARERS.map((each) => (
                  <label key={each} className={`${SECONDARY} cursor-pointer has-checked:border-accent has-checked:bg-accent-tint`}>
                    <input type="radio" name={`${uid}-wearer`} checked={wearer === each} onChange={() => setWearer(each)} className="sr-only" />
                    {WEARER_LABELS[each]}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {anyViews ? null : (
            <button
              data-writes
              type="button"
              disabled={work.busy}
              onClick={() => {
                if (ask && !wearer) return work.setError("Choose who wears it first.");
                void work.run("views", () => makeViewsAction({ productId: item.id, requestKey: requestKey.get(), wearer: ask ? wearer : null }), requestKey.clear);
              }}
              className={`${AI_BUTTON} self-start`}
            >
              <Icon name="sparkles" size="sm" />
              {work.pending === "views" ? "Making 3 views…" : "Make 3 more views"}
            </button>
          )}
          {anyViews
            ? EXTRA_VIEWS.map((view) => (
                <ViewGroup key={view} title={labels[view]} pictures={of(view)} item={item} inUse={inUse} changeLimit={changeLimit} work={work} view={view}>
                  <button
                    data-writes
                    type="button"
                    disabled={work.busy}
                    onClick={() => {
                      if (view === "in_use" && ask && !wearer) return work.setError("Choose who wears it first.");
                      void (view === "in_use" && ask && wearer
                        ? work.run(`make:${view}`, () => makeViewsAction({ productId: item.id, requestKey: requestKey.get(), wearer, views: ["in_use"] }), requestKey.clear)
                        : make(view));
                    }}
                    className={`${SECONDARY} self-start`}
                  >
                    <Icon name="refresh" size="sm" />
                    {work.pending === `make:${view}` ? "Making…" : of(view).length ? "Make a new one" : "Make it"}
                    <span className="sr-only"> ({labels[view]})</span>
                  </button>
                </ViewGroup>
              ))
            : null}
        </div>
      ) : of("main").length ? (
        <p className="text-sm text-muted">Use a main photo to make the other views from it.</p>
      ) : null}

      <Working active={work.busy} label={work.watching ? RUNNING_ELSEWHERE : "Making pictures. This can take a minute or two."} />
      {work.error ? (
        <p role="alert" className={ALERT}>
          {work.error}
        </p>
      ) : null}
      {pictures.some((picture) => !picture.approved && picture.id !== inUse) ? (
        <button
          data-writes
          type="button"
          onClick={async () => {
            if (!window.confirm("Remove the pictures of this item you haven’t approved?")) return;
            const result = await clearPicturesAction(item.id).catch(() => null);
            if (!result?.ok) work.setError(result?.message ?? failedMessage());
          }}
          className="w-fit text-sm text-muted underline underline-offset-[3px] hover:text-accent"
        >
          Remove pictures you haven’t approved
        </button>
      ) : null}
    </section>
  );
}

function ViewGroup({
  title,
  view,
  pictures,
  item,
  inUse,
  changeLimit,
  work,
  children,
}: {
  title: string;
  view: PictureView;
  pictures: Picture[];
  item: ListedProduct;
  inUse: string | null;
  changeLimit: number;
  work: ReturnType<typeof useRun>;
  children: React.ReactNode;
}) {
  const uid = useId();
  const requestKey = useRequestKey();
  const [change, setChange] = useState("");
  const newest = pictures.at(-1) ?? null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newest) return;
    if (change.trim().length < 3) return work.setError("Say what you’d like changed.");
    void work.run(`change:${view}`, () => makePictureAction({ productId: item.id, requestKey: requestKey.get(), view, baseId: newest.id, change }), () => {
      requestKey.clear();
      setChange("");
    });
  }

  return (
    <section aria-labelledby={`${uid}-title`} className="flex flex-col gap-3">
      <h5 id={`${uid}-title`} className="font-semibold">
        {title}
      </h5>
      {pictures.length ? (
        <ul className="grid grid-cols-2 gap-3 @md:grid-cols-3">
          {[...pictures].reverse().map((picture, index) => (
            <li key={picture.id}>
              <PictureCard picture={picture} productId={item.id} name={item.name} title={title} newest={index === 0} inUse={inUse === picture.id} main={view === "main"} />
            </li>
          ))}
        </ul>
      ) : null}
      {children}
      {newest ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={`${uid}-change`} className="text-sm font-semibold">
            Ask for a change to the newest {title.toLowerCase()}
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
            placeholder="Such as: warmer light, or show more of the back"
            className={INPUT}
          />
          <button type="submit" disabled={work.busy} className={`${SECONDARY} self-start`}>
            <Icon name="sparkles" size="sm" />
            {work.pending === `change:${view}` ? "Making the change…" : "Make this change"}
            <span className="sr-only"> ({title})</span>
          </button>
        </form>
      ) : null}
    </section>
  );
}

function PictureCard({ picture, productId, name, title, newest, inUse, main }: { picture: Picture; productId: string; name: string; title: string; newest: boolean; inUse: boolean; main: boolean }) {
  const uid = useId();
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: () => Promise<{ ok: boolean; message?: string }>) {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError(result.message ?? failedMessage());
    } catch {
      setError(failedMessage());
    } finally {
      setPending(false);
    }
  }

  const approved = main ? inUse : picture.approved;
  return (
    <figure aria-label={`${newest ? "Newest" : "Earlier"} ${title.toLowerCase()} of ${name}`} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={picture.src} alt={`${title} of ${name}${picture.simulated ? ", practice preview" : ""}`} className="aspect-square w-full rounded-lg bg-soft object-cover" />
      <figcaption className="flex flex-col gap-1 text-sm">
        {picture.simulated ? <span className="font-semibold text-check">Practice preview, not made by AI</span> : null}
        {picture.change ? <span className="text-muted">Change: {picture.change}</span> : null}
        {approved ? <span className="font-semibold text-done">{main ? "In use as its main photo" : "Approved, in the gallery"}</span> : null}
      </figcaption>
      {approved ? null : (
        <div className="flex flex-col gap-2">
          {picture.simulated ? (
            <label htmlFor={`${uid}-ok`} className="flex items-start gap-2 text-sm">
              <input id={`${uid}-ok`} type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
              <span>I understand this is only a practice preview</span>
            </label>
          ) : null}
          <button
            data-writes
            type="button"
            disabled={pending}
            onClick={() => (confirmed || !picture.simulated ? void act(() => approvePictureAction({ productId, pictureId: picture.id, confirmed: true })) : setError("Tick the box to confirm this is only a practice preview."))}
            className={SECONDARY}
          >
            <Icon name="check" size="sm" />
            {pending ? "Saving…" : main ? "Use as main photo" : "Approve"}
          </button>
        </div>
      )}
      {inUse ? null : (
        <button data-writes type="button" disabled={pending} onClick={() => void act(() => deletePictureAction(picture.id))} className="w-fit text-sm text-muted underline underline-offset-[3px] hover:text-danger">
          Remove<span className="sr-only"> this {title.toLowerCase()}</span>
        </button>
      )}
      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
    </figure>
  );
}
