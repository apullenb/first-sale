"use client";

import Link from "next/link";
import { type ReactNode, useDeferredValue, useId, useLayoutEffect, useState } from "react";
import { checkPublishAction, disconnectHostAction, publishSiteAction, saveSiteDesignAction } from "@/app/(app)/website/site-actions";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { Done, LABEL, PickOption, PickTile, SectionHead, Segmented, SOFT } from "@/components/marketing/pieces";
import { ALERT, INPUT, PRIMARY, SECONDARY, SECONDARY_LINK, TEXT_LINK } from "@/components/styles";
import { Card } from "@/components/ui";
import {
  buyLinkProblem,
  dollars,
  isKnownPaymentLink,
  itemFor,
  parseDollars,
  SECTION_LABELS,
  SITE_SECTIONS,
  SITE_STYLES,
  type SiteDesign,
  type SiteItem,
  STYLE_LABELS,
} from "@/lib/website/site/design";
import { NETLIFY_CREDITS } from "@/data/netlify-credits";
import { renderSite, type SiteImage } from "@/lib/website/site/render";
import type { WebsiteCopy } from "@/lib/website/types";
import { SiteFrame } from "./site-frame";

export interface LibraryChoice {
  versionId: string;
  photoId: string;
  title: string;
  src: string;
  width: number;
  height: number;
  simulated: boolean;
}

export interface PublishPanel {
  signature: string;
  blockers: string[];
  notes: string[];
  // A Netlify app is registered on this copy of First Sale
  configured: boolean;
  connected: boolean;
  // Netlify sent the owner back: "connected" or "failed"
  returned: string | null;
  hosting: {
    url: string;
    adminUrl: string | null;
    simulated: boolean;
    state: "ready" | "processing" | "failed";
    publishedAt: string;
    upToDate: boolean;
  } | null;
}

interface Props {
  name: string;
  copy: WebsiteCopy;
  saved: SiteDesign;
  images: { logo: SiteImage | null; hero: SiteImage | null; favicon: SiteImage | null };
  library: LibraryChoice[];
  brandColors: { hex: string; name: string }[];
  contact: { email: string | null; phone: string | null };
  year: number;
  domain: string | null;
  practiceBrand: boolean;
  stepNumber: number;
  publish: PublishPanel | null;
  // Shown under the publish controls: doing it by hand
  publishHelp?: ReactNode;
}

const PART = "flex flex-col gap-2.5 border-t border-line pt-5";

type ItemDraft = { price: string; buyUrl: string; photo: string };

function draftsFrom(design: SiteDesign, copy: WebsiteCopy): Record<string, ItemDraft> {
  return Object.fromEntries(
    copy.offerings.map((offering) => {
      const item = itemFor(design, offering.name);
      return [
        offering.name,
        { price: item?.priceCents != null ? (item.priceCents / 100).toFixed(item.priceCents % 100 ? 2 : 0) : "", buyUrl: item?.buyUrl ?? "", photo: item?.photo?.versionId ?? "" },
      ];
    }),
  );
}

function itemsFrom(drafts: Record<string, ItemDraft>, copy: WebsiteCopy, library: LibraryChoice[]): SiteItem[] {
  return copy.offerings.flatMap((offering) => {
    const draft = drafts[offering.name];
    if (!draft) return [];
    const photo = library.find((each) => each.versionId === draft.photo);
    const priceCents = draft.price.trim() ? parseDollars(draft.price) : null;
    if (priceCents == null && !draft.buyUrl.trim() && !photo) return [];
    return [{ name: offering.name, priceCents, buyUrl: draft.buyUrl.trim(), photo: photo ? { photoId: photo.photoId, versionId: photo.versionId } : null }];
  });
}

// Step 4 (look and live preview) and, for the site First Sale builds, step 5 (publish)
export function SiteStudio(props: Props) {
  const { copy, saved, library, publish } = props;
  const uid = useId();
  const [design, setDesign] = useState(saved);
  const [drafts, setDrafts] = useState(() => draftsFrom(saved, copy));
  // Compared by value: other actions on the page refresh it without changing these
  const savedKey = JSON.stringify(saved);
  const namesKey = JSON.stringify(copy.offerings.map((offering) => offering.name));
  const [seen, setSeen] = useState({ saved: savedKey, names: namesKey });
  const [device, setDevice] = useState<"phone" | "computer">("computer");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "publishing">("idle");
  const [error, setError] = useState<{ at: "design" | "publish"; message: string } | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  // A newer saved design replaces the editor's contents; new words keep what's typed for items still there
  if (seen.saved !== savedKey) {
    setSeen({ saved: savedKey, names: namesKey });
    setDesign(saved);
    setDrafts(draftsFrom(saved, copy));
  } else if (seen.names !== namesKey) {
    setSeen({ saved: savedKey, names: namesKey });
    setDrafts((before) => ({
      ...draftsFrom(saved, copy),
      ...Object.fromEntries(Object.entries(before).filter(([name]) => copy.offerings.some((offering) => offering.name === name))),
    }));
  }

  const current: SiteDesign = { ...design, items: itemsFrom(drafts, copy, library) };
  const priceErrors = copy.offerings.filter((offering) => drafts[offering.name]?.price.trim() && parseDollars(drafts[offering.name].price) == null);
  const linkErrors = copy.offerings.flatMap((offering) => {
    const problem = buyLinkProblem(drafts[offering.name]?.buyUrl ?? "");
    return problem ? [`${offering.name}: ${problem}`] : [];
  });
  // Items for words that changed since don't count as edits
  const dirty = JSON.stringify(current) !== JSON.stringify({ ...saved, items: itemsFrom(draftsFrom(saved, copy), copy, library) });

  const preview = useDeferredValue(
    renderSite({
      name: props.name,
      copy,
      design: current,
      images: { ...props.images, photos: Object.fromEntries(library.map((photo) => [photo.versionId, photo])) },
      contact: props.contact,
      year: props.year,
      highlightNotes: true,
      anchorBase: "about:srcdoc",
    }),
  );

  function change(patch: Partial<SiteDesign>) {
    setDesign((before) => ({ ...before, ...patch }));
    if (status === "saved") setStatus("idle");
  }

  function changeItem(name: string, patch: Partial<ItemDraft>) {
    setDrafts((before) => ({ ...before, [name]: { ...(before[name] ?? { price: "", buyUrl: "", photo: "" }), ...patch } }));
    if (status === "saved") setStatus("idle");
  }

  async function run(next: "saving" | "publishing", action: () => Promise<{ ok: boolean; message?: string }>) {
    const at = next === "saving" ? "design" : "publish";
    setStatus(next);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError({ at, message: result.message ?? "That didn’t work. Try again." });
      setStatus(result.ok && next === "saving" ? "saved" : "idle");
    } catch {
      setError({ at, message: "Couldn’t reach First Sale. Check your connection and try again." });
      setStatus("idle");
    }
  }

  async function save() {
    if (priceErrors.length || linkErrors.length) {
      setError({ at: "design", message: "Fix the prices and links marked below, then save." });
      return;
    }
    await run("saving", () => saveSiteDesignAction(current));
  }

  async function publishNow() {
    if (!publish) return;
    const real = publish.connected;
    const question = real
      ? `Put your site online now? Anyone on the internet will be able to see it. On Netlify’s Free plan, each publish uses ${NETLIFY_CREDITS.perPublish} of your ${NETLIFY_CREDITS.freeMonthly} credits for the month.`
      : "Run a practice publish? First Sale checks everything, but nothing goes online.";
    if (!window.confirm(question)) return;
    // Sent with the publish, so the server refuses if the connection changed since
    await run("publishing", () => publishSiteAction({ signature: publish.signature, real }));
  }

  const pending = status === "saving" || status === "publishing";

  return (
    <>
      <section aria-labelledby="step-design" className="@container flex flex-col gap-4">
        <SectionHead
          id="step-design"
          number={props.stepNumber}
          title={publish ? "Design it and see it live" : "See how it could look"}
          lead={
            publish
              ? "This is your real site, drawn from your approved words, brand and items. Change the look below and the preview updates as you go. Nothing goes online until you publish in the next step."
              : "A preview from your words and brand. Your real site will use the design you pick on your platform, but the prices, photos and colors you set here are copied into the steps below."
          }
        />
        <div className="grid items-start gap-5 @4xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
          <Card title="Your design" icon="palette" id="design-controls-heading" headingLevel={3} bodyClassName="gap-5">
            <div className="flex flex-col gap-2.5">
              <p id={`${uid}-look`} className={LABEL}>
                Look
              </p>
              <div role="group" aria-labelledby={`${uid}-look`} className="grid gap-2">
                {SITE_STYLES.map((style) => (
                  <PickTile
                    key={style}
                    pressed={design.style === style}
                    onClick={() => change({ style })}
                    label={STYLE_LABELS[style].name}
                    description={STYLE_LABELS[style].hint}
                    layout="top"
                  />
                ))}
              </div>
            </div>

            <div className={PART}>
              <p id={`${uid}-color`} className={LABEL}>
                Main color
              </p>
              {props.brandColors.length ? (
                <div role="group" aria-labelledby={`${uid}-color`} className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
                  {props.brandColors.map((color) => (
                    <PickTile
                      key={color.hex}
                      pressed={design.color.toLowerCase() === color.hex.toLowerCase()}
                      onClick={() => change({ color: color.hex.toLowerCase() })}
                      lead={<span aria-hidden="true" className="size-5 shrink-0 rounded-full ring-1 ring-ink/20" style={{ background: color.hex }} />}
                      label={color.name}
                      layout="word"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Your brand colors show here once you{" "}
                  <Link href="/logo" className={TEXT_LINK}>
                    create or upload your logo
                  </Link>
                  .
                </p>
              )}
              <label className="flex min-h-11 items-center gap-3 text-[15px]">
                <input
                  type="color"
                  value={design.color}
                  onChange={(event) => change({ color: event.target.value.toLowerCase() })}
                  className="h-11 w-14 cursor-pointer rounded-[10px] border border-line-strong bg-surface"
                />
                <span>
                  Or pick any color <span className="font-mono text-muted">{design.color}</span>
                </span>
              </label>
            </div>

            <fieldset className="flex flex-col gap-2 border-t border-line pt-5">
              <legend className={`${LABEL} float-left mb-2.5 w-full`}>Show on the site</legend>
              {props.images.logo ? <Check label="Your logo" checked={design.showLogo} onChange={(showLogo) => change({ showLogo })} /> : null}
              {props.images.hero ? <Check label="Your header picture" checked={design.showHero} onChange={(showHero) => change({ showHero })} /> : null}
              {SITE_SECTIONS.map((section) => (
                <Check
                  key={section}
                  label={SECTION_LABELS[section]}
                  checked={!design.hidden.includes(section)}
                  onChange={(on) => change({ hidden: on ? design.hidden.filter((each) => each !== section) : [...design.hidden, section] })}
                />
              ))}
              {props.contact.email ? <Check label={`Email button (${props.contact.email})`} checked={design.showEmail} onChange={(showEmail) => change({ showEmail })} /> : null}
              {props.contact.phone ? <Check label={`Call button (${props.contact.phone})`} checked={design.showPhone} onChange={(showPhone) => change({ showPhone })} /> : null}
              {!props.contact.email && !props.contact.phone ? (
                <p className="text-sm text-muted">
                  Add a business email or phone in{" "}
                  <Link href="/business#details-heading" className={TEXT_LINK}>
                    your business details
                  </Link>{" "}
                  to show contact buttons.
                </p>
              ) : null}
            </fieldset>

            {copy.offerings.length ? (
              <fieldset className="flex flex-col gap-3 border-t border-line pt-5">
                <legend className={`${LABEL} float-left mb-2.5 w-full`}>Your items</legend>
                <p className="text-sm text-muted">
                  Prices show only if you type them. A buy link opens your own payment page: make one in Stripe or Square (see the steps below), then paste it here.
                </p>
                {copy.offerings.map((offering, index) => {
                  const draft = drafts[offering.name] ?? { price: "", buyUrl: "", photo: "" };
                  const priceBad = draft.price.trim() !== "" && parseDollars(draft.price) == null;
                  const linkProblem = buyLinkProblem(draft.buyUrl);
                  const id = `${uid}-item-${index}`;
                  return (
                    <div key={`${index}-${offering.name}`} className={`${SOFT} flex flex-col gap-2 p-3.5`}>
                      <p className="font-bold">{offering.name}</p>
                      <label htmlFor={`${id}-price`} className="text-sm font-semibold">
                        Price
                      </label>
                      <input
                        id={`${id}-price`}
                        inputMode="decimal"
                        maxLength={12}
                        placeholder="Like 12 or 12.50"
                        value={draft.price}
                        aria-invalid={priceBad}
                        onChange={(event) => changeItem(offering.name, { price: event.target.value })}
                        className={INPUT}
                      />
                      {priceBad ? <p className="text-sm text-danger">Type a dollar amount, like 12 or 12.50.</p> : null}
                      {!priceBad && draft.price.trim() ? <p className="text-sm text-muted">Shows as {dollars(parseDollars(draft.price) ?? 0)}</p> : null}
                      <label htmlFor={`${id}-link`} className="text-sm font-semibold">
                        Buy link (optional)
                      </label>
                      <input
                        id={`${id}-link`}
                        type="url"
                        inputMode="url"
                        autoCapitalize="none"
                        spellCheck={false}
                        maxLength={500}
                        placeholder="https://buy.stripe.com/…"
                        value={draft.buyUrl}
                        aria-invalid={Boolean(linkProblem)}
                        onChange={(event) => changeItem(offering.name, { buyUrl: event.target.value })}
                        className={INPUT}
                      />
                      {linkProblem ? <p className="text-sm text-danger">{linkProblem}</p> : null}
                      {!linkProblem && draft.buyUrl.trim() && !isKnownPaymentLink(draft.buyUrl) ? (
                        <p className="text-sm text-check">This isn’t a Stripe or Square link. Make sure it’s your own payment page.</p>
                      ) : null}
                      {library.length ? (
                        <>
                          <label htmlFor={`${id}-photo`} className="text-sm font-semibold">
                            Photo
                          </label>
                          <select id={`${id}-photo`} value={draft.photo} onChange={(event) => changeItem(offering.name, { photo: event.target.value })} className={INPUT}>
                            <option value="">No photo</option>
                            {library.map((photo) => (
                              <option key={photo.versionId} value={photo.versionId}>
                                {photo.title}
                                {photo.simulated ? " (practice)" : ""}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : null}
                    </div>
                  );
                })}
                {!library.length ? (
                  <p className="text-sm text-muted">
                    Approved photos from{" "}
                    <Link href="/photos" className={TEXT_LINK}>
                      Product photos
                    </Link>{" "}
                    can go with each item.
                  </p>
                ) : null}
              </fieldset>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-line pt-4">
              {error?.at === "design" ? (
                <p role="alert" className={ALERT}>
                  {error.message}
                </p>
              ) : null}
              <p role="status" className="text-sm text-muted">
                {status === "saved" && !dirty ? "Saved." : dirty ? "You have changes that aren’t saved yet." : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={pending || !dirty} onClick={save} className={PRIMARY}>
                  <Icon name="check" size="sm" />
                  {status === "saving" ? "Saving…" : "Save design"}
                </button>
                <button
                  type="button"
                  disabled={pending || !dirty}
                  onClick={() => {
                    setDesign(saved);
                    setDrafts(draftsFrom(saved, copy));
                    setError(null);
                  }}
                  className={SECONDARY}
                >
                  Undo changes
                </button>
              </div>
            </div>
          </Card>

          <div className="min-w-0 @4xl:sticky @4xl:top-4">
            <Card title="Live preview" icon="monitor" id="preview-heading" headingLevel={3}>
              <figure className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Segmented
                    label="Preview size"
                    value={device}
                    onChange={(value) => setDevice(value as "phone" | "computer")}
                    options={[
                      { value: "computer", label: "Computer", icon: "monitor" },
                      { value: "phone", label: "Phone", icon: "phone" },
                    ]}
                  />
                  <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 truncate rounded-lg border border-line bg-soft px-2.5 py-1.5 text-sm text-muted">
                    <Icon name="lock" size="xs" />
                    <span className="truncate">{props.domain ?? "your-web-address.com"}</span>
                  </span>
                </div>
                <div className="rounded-xl border border-line bg-wash p-2 sm:p-3">
                  <SiteFrame html={preview} title={`Preview of the ${props.name} website`} device={device} />
                </div>
                <figcaption className="text-sm text-muted">
                  Yellow marks are [bracketed] notes still to fill in. Buy buttons don’t open from the preview.
                  {props.practiceBrand ? " Your logo and pictures here are practice previews, not made for your business." : ""}
                </figcaption>
              </figure>
            </Card>
          </div>
        </div>
      </section>

      {publish ? (
        <section aria-labelledby="step-publish" className="flex flex-col gap-4">
          <SectionHead id="step-publish" number={props.stepNumber + 1} title="Publish it" />
          <Card bodyClassName="gap-4">
            <PublishControls
              publish={publish}
              dirty={dirty}
              pending={pending}
              publishing={status === "publishing"}
              error={error?.at === "publish" ? error.message : null}
              onPublish={publishNow}
            />
          </Card>
          {props.publishHelp}
        </section>
      ) : null}
    </>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <PickOption type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} label={label} layout="word" />;
}

function PublishControls({
  publish,
  dirty,
  pending,
  publishing,
  error,
  onPublish,
}: {
  publish: PublishPanel;
  dirty: boolean;
  pending: boolean;
  publishing: boolean;
  error: string | null;
  onPublish: () => void;
}) {
  const [busy, setBusy] = useState<"disconnecting" | "checking" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const { hosting } = publish;
  const realSite = hosting && !hosting.simulated;
  const upToDate = Boolean(realSite && hosting.upToDate);
  const blocked = publish.blockers.length > 0;

  async function act(kind: "disconnecting" | "checking", action: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(kind);
    setProblem(null);
    try {
      const result = await action();
      if (!result.ok) setProblem(result.message ?? "That didn’t work. Try again.");
    } catch {
      setProblem("Couldn’t reach First Sale. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {publish.returned === "connected" && publish.connected ? (
        <div role="status">
          <Done>Netlify is connected. You can publish when you’re ready.</Done>
        </div>
      ) : null}
      {publish.returned === "failed" ? (
        <p role="alert" className={ALERT}>
          Netlify didn’t finish connecting. Try again, and click Authorize on Netlify’s page.
        </p>
      ) : null}

      {hosting ? (
        hosting.simulated ? (
          <div className="rounded-xl border border-check-ring bg-check-tint px-4 py-3 text-[15px] text-check">
            <p>
              <strong>Practice publish</strong> on <LocalDate iso={hosting.publishedAt} />: every check passed, but nothing went online. Connected to Netlify, your site
              would get an address like <span className="font-mono break-all">{hosting.url}</span>.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-xl border border-accent-ring bg-accent-tint px-4 py-3 text-accent-ink">
            <p>
              <strong>
                {hosting.state === "ready" ? "Your site is online" : hosting.state === "processing" ? "Netlify is putting your site online" : "Your last publish didn’t go live"}
              </strong>{" "}
              at{" "}
              <a href={hosting.url} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} break-all`}>
                {hosting.url}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              . {hosting.state === "failed" ? "Tried" : "Published"} <LocalDate iso={hosting.publishedAt} />.
            </p>
            {hosting.state === "failed" ? <p className="text-sm">Netlify has your site, but not this version yet. Publish again to finish.</p> : null}
            {hosting.state === "processing" ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span>Netlify was still finishing when First Sale last asked. It usually takes under a minute.</span>
                <button type="button" disabled={busy !== null} onClick={() => act("checking", checkPublishAction)} className={SECONDARY}>
                  {busy === "checking" ? "Checking…" : "Check again"}
                </button>
              </div>
            ) : null}
            {hosting.state === "ready" && !hosting.upToDate ? <p className="text-sm font-semibold">You’ve changed your site since. Publish again to update it.</p> : null}
            {hosting.adminUrl ? (
              <a href={hosting.adminUrl} target="_blank" rel="noopener noreferrer" className={`${TEXT_LINK} w-fit text-sm`}>
                Open it in Netlify
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
          </div>
        )
      ) : null}

      {publish.blockers.length ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-check-ring bg-check-tint px-4 py-3 text-check">
          <p className="flex items-center gap-2 font-bold">
            <Icon name="info" size="sm" />
            Before you can publish
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {publish.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : (
        <Done>Everything First Sale checks is ready.</Done>
      )}
      {publish.notes.length ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-rule">
          {publish.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      <div className={`${SOFT} flex flex-col gap-2 px-4 py-3.5`}>
        <p className={LABEL}>Where it goes online</p>
        {publish.connected ? (
          <>
            <p className="text-rule">Connected to your Netlify account. Publishing puts your site there, on Netlify’s Free plan.</p>
            <p className="text-sm text-rule">
              The Free plan gives {NETLIFY_CREDITS.freeMonthly} credits a month. Each publish uses {NETLIFY_CREDITS.perPublish}, and visits use a little more. If
              they run out, Netlify pauses the site until the next month, so publish when you’ve finished a round of changes.{" "}
              <a href={NETLIFY_CREDITS.source} target="_blank" rel="noopener noreferrer" className={TEXT_LINK}>
                Netlify pricing
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              , checked <LocalDate iso={`${NETLIFY_CREDITS.checkedOn}T12:00:00Z`} />.
            </p>
            <button
              type="button"
              disabled={pending || busy !== null}
              onClick={() => {
                if (!window.confirm("Disconnect Netlify? Your site stays online in your Netlify account, but First Sale can’t update it until you connect again.")) return;
                void act("disconnecting", disconnectHostAction);
              }}
              className={`${SECONDARY} w-fit`}
            >
              {busy === "disconnecting" ? "Disconnecting…" : "Disconnect Netlify"}
            </button>
            <p className="text-sm text-muted">To remove First Sale’s access completely, revoke it in Netlify under your user settings, Applications.</p>
          </>
        ) : publish.configured ? (
          <>
            <p className="text-rule">
              Make a free Netlify account (the first item in the next step), then connect it here. On Netlify’s page, click Authorize. First Sale only publishes when you
              click Publish.
            </p>
            <a href="/website/netlify/connect" className={SECONDARY_LINK}>
              Connect Netlify
            </a>
          </>
        ) : (
          <p className="text-rule">
            This copy of First Sale isn’t set up to publish to Netlify for you, so Publish runs every check as a practice run. To put your site online now,
            download it and drop it on Netlify yourself: the steps are below.
          </p>
        )}
      </div>

      {error || problem ? (
        <p role="alert" className={ALERT}>
          {error ?? problem}
        </p>
      ) : null}
      {dirty ? <p className="text-sm text-check">Save your design changes in step 4 first, so you publish what you see.</p> : null}
      {publish.connected && upToDate && !dirty ? (
        <p className="text-sm text-muted">Nothing has changed since your last publish. Publishing again still uses Netlify credits.</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={blocked || dirty || pending} onClick={onPublish} className={PRIMARY}>
          <Icon name="globe" size="sm" />
          {publishing
            ? "Publishing…"
            : publish.connected
              ? upToDate
                ? "Publish again"
                : realSite
                  ? "Publish my changes"
                  : "Publish my site"
              : "Practice publish"}
        </button>
        {!blocked && !dirty ? (
          <a href="/website/download" download className={SECONDARY_LINK}>
            <Icon name="download" size="sm" />
            Download my site (.zip)
          </a>
        ) : null}
      </div>
      <p role="status" className="sr-only">
        {publishing ? "Publishing your site. This can take a minute." : ""}
      </p>
    </div>
  );
}
