"use client";

import Link from "next/link";
import { saveWebsiteCopyAction } from "@/app/(app)/website/actions";
import { PracticeBanner } from "@/components/practice-banner";
import { type ReactNode, useDeferredValue, useId, useLayoutEffect, useState } from "react";
import { designThemeAction, finishSiteAction, saveSiteDesignAction } from "@/app/(app)/website/site-actions";
import { Icon } from "@/components/icons";
import { LocalDate } from "@/components/local-date";
import { Done, LABEL, PickOption, PickTile, SectionHead, Segmented, SOFT } from "@/components/marketing/pieces";
import { ALERT, INPUT, PRIMARY, SECONDARY, TEXT_LINK } from "@/components/styles";
import { Card } from "@/components/ui";
import {
  buyLinkProblem,
  dollars,
  isKnownPaymentLink,
  itemFor,
  parseDollars,
  productPrice,
  SECTION_LABELS,
  SITE_SECTIONS,
  SITE_STYLES,
  type SiteDesign,
  type SiteItem,
  type SiteProduct,
  STYLE_LABELS,
  withProducts,
} from "@/lib/website/site/design";
import { renderSite, type SiteImage } from "@/lib/website/site/render";
import type { WebsiteCopy } from "@/lib/website/types";
import { FullScreenPreview, SiteFrame } from "./site-frame";
import { failedMessage } from "@/lib/failure";

export interface LibraryChoice {
  versionId: string;
  photoId: string;
  title: string;
  src: string;
  width: number;
  height: number;
  simulated: boolean;
}

export interface FinishPanel {
  signature: string;
  blockers: string[];
  notes: string[];
  // The last demo finish; upToDate when nothing has changed since
  finished: { at: string; upToDate: boolean } | null;
}

interface Props {
  name: string;
  draftedAt: string;
  copy: WebsiteCopy;
  saved: SiteDesign;
  images: { logo: SiteImage | null; hero: SiteImage | null; favicon: SiteImage | null };
  library: LibraryChoice[];
  brandColors: { hex: string; name: string }[];
  products: SiteProduct[];
  contact: { email: string | null; phone: string | null };
  year: number;
  domain: string | null;
  practiceBrand: boolean;
  stepNumber: number;
  finish: FinishPanel;
  // Shown under the finish step
  after?: ReactNode;
}

const PART = "flex flex-col gap-2.5 border-t border-line pt-5";

type ItemDraft = { price: string; buyUrl: string; photo: string };

function draftsFrom(design: SiteDesign, copy: WebsiteCopy): Record<string, ItemDraft> {
  return Object.fromEntries(
    copy.offerings.map((offering) => {
      const item = itemFor(design, offering.name);
      return [
        offering.name,
        { price: item?.priceCents != null ? (item.priceCents / 100).toFixed(item.priceCents % 100 ? 2 : 0) : "", buyUrl: item?.buyUrl ?? "", photo: item?.hidePhoto ? "none" : item?.photo?.versionId ?? "" },
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
    if (priceCents == null && !draft.buyUrl.trim() && !photo && draft.photo !== "none") return [];
    return [{ name: offering.name, priceCents, buyUrl: draft.buyUrl.trim(), photo: photo ? { photoId: photo.photoId, versionId: photo.versionId } : null, ...(draft.photo === "none" ? { hidePhoto: true } : {}) }];
  });
}

// The SnapStart site: look and live preview, then the demo finish
export function SiteStudio(props: Props) {
  const { saved, library, finish, products } = props;
  const uid = useId();
  const [fullPreview, setFullPreview] = useState(false);
  const [design, setDesign] = useState(saved);
  const [words, setWords] = useState(props.copy);
  const wordsKey = JSON.stringify(props.copy);
  const [seenWords, setSeenWords] = useState(wordsKey);
  if (seenWords !== wordsKey) { setSeenWords(wordsKey); setWords(props.copy); }
  const [themeRequest, setThemeRequest] = useState("");
  const [designing, setDesigning] = useState(false);
  const wordsDirty = JSON.stringify(words) !== JSON.stringify(props.copy);
  // The items to edit: the drafted words' items, then saved products that are turned on
  const copy = withProducts(words, products, design).copy;
  const savedCopy = withProducts(props.copy, products, saved).copy;
  const [drafts, setDrafts] = useState(() => draftsFrom(withProducts(props.copy, products, saved).design, copy));
  // Compared by value: other actions on the page refresh it without changing these
  const savedKey = JSON.stringify(saved);
  const namesKey = JSON.stringify(copy.offerings.map((offering) => offering.name));
  const [seen, setSeen] = useState({ saved: savedKey, names: namesKey });
  const [device, setDevice] = useState<"phone" | "computer">("computer");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "finishing">("idle");
  const [error, setError] = useState<{ at: "design" | "finish"; message: string } | null>(null);
  useLayoutEffect(() => () => setError(null), []);

  // A newer saved design replaces the editor's contents; new words keep what's typed for items still there
  if (seen.saved !== savedKey) {
    setSeen({ saved: savedKey, names: namesKey });
    setDesign(saved);
    setDrafts(draftsFrom(withProducts(props.copy, products, saved).design, savedCopy));
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
  const dirty = wordsDirty || JSON.stringify(current) !== JSON.stringify({ ...saved, items: itemsFrom(draftsFrom(withProducts(props.copy, products, saved).design, savedCopy), savedCopy, library) });

  const shown = withProducts(words, products, current);
  const preview = useDeferredValue(
    renderSite({
      name: props.name,
      copy: shown.copy,
      design: shown.design,
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

  async function run(next: "saving" | "finishing", action: () => Promise<{ ok: boolean; message?: string }>) {
    const at = next === "saving" ? "design" : "finish";
    setStatus(next);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError({ at, message: result.message ?? "That didn’t work. Try again." });
      setStatus(result.ok && next === "saving" ? "saved" : "idle");
    } catch {
      setError({ at, message: failedMessage() });
      setStatus("idle");
    }
  }

  async function save() {
    if (priceErrors.length || linkErrors.length) {
      setError({ at: "design", message: "Fix the prices and links marked below, then save." });
      return;
    }
    await run("saving", async () => {
      if (wordsDirty) {
        const result = await saveWebsiteCopyAction({ copy: words, approve: false, draftedAt: props.draftedAt });
        if (!result.ok) return result;
      }
      return saveSiteDesignAction(current);
    });
  }

  async function designWithAi() {
    setDesigning(true); setError(null);
    try {
      const result = await designThemeAction(themeRequest);
      if (!result.ok) { setError({ at: "design", message: result.message }); return; }
      const image = library.find((image) => image.versionId === result.value.heroId);
      change({ theme: result.value.theme, color: result.value.theme.accent, ...(image ? { heroImage: { photoId: image.photoId, versionId: image.versionId }, showHero: true } : {}) });
    } catch { setError({ at: "design", message: failedMessage() }); }
    finally { setDesigning(false); }
  }

  async function finishNow() {
    // Sent with the finish, so the server refuses a version that changed since
    await run("finishing", () => finishSiteAction({ signature: finish.signature }));
  }

  const pending = designing || status === "saving" || status === "finishing";

  return (
    <>
      {fullPreview ? <FullScreenPreview html={preview} name={props.name} onClose={() => setFullPreview(false)} /> : null}
      <section aria-labelledby="step-design" className="@container flex flex-col gap-4">
        <SectionHead
          id="step-design"
          number={props.stepNumber}
          title="Design it and see it live"
          lead="Choose a template and make it yours. Open the full-screen preview to explore your site."
        />
        <div className="grid items-start gap-5 @4xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
          <Card title="Your design" icon="palette" id="design-controls-heading" headingLevel={3} bodyClassName="gap-5">
            <div className="flex flex-col gap-3 rounded-xl bg-soft p-4">
              <h4 className="font-semibold">Designed around your brand</h4>
              <p className="text-sm text-muted">Your brand choices guide the colors, typography, layout and images. Review the result in the preview, then save.</p>
              <label className="text-sm font-semibold" htmlFor={`${uid}-theme-request`}>Design direction</label>
              <textarea id={`${uid}-theme-request`} className={INPUT} maxLength={1000} value={themeRequest} onChange={(event) => setThemeRequest(event.target.value)} placeholder="For example: a full-width header photo, refined lettering and soft cream backgrounds" />
              <button type="button" data-writes disabled={pending} className={PRIMARY} onClick={designWithAi}>{designing ? "Designing your theme…" : design.theme ? "Refine theme with AI" : "Design theme from my brand"}</button>
              {design.theme ? <><strong>{design.theme.name}</strong><p className="text-sm">{design.theme.rationale}</p></> : null}
              {design.theme ? <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">Layout<select aria-label="Layout" className={INPUT} value={design.theme.layout} onChange={(event) => change({ theme: { ...design.theme!, layout: event.target.value as "split" | "cover" | "centered" } })}><option value="split">Split image and text</option><option value="cover">Full-width photo</option><option value="centered">Centered editorial</option></select></label>
                <label className="flex flex-col gap-1 text-sm">Typography<select aria-label="Typography" className={INPUT} value={design.theme.font} onChange={(event) => change({ theme: { ...design.theme!, font: event.target.value as "sans" | "serif" | "editorial" } })}><option value="sans">Modern sans serif</option><option value="serif">Classic serif</option><option value="editorial">Editorial serif</option></select></label>
                {([['background', 'Page background'], ['surface', 'Section background']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="color" aria-label={label} value={design.theme![key]} onChange={(event) => change({ theme: { ...design.theme!, [key]: event.target.value } })} />{label}</label>)}
              </div> : null}
              {design.theme?.simulated ? <PracticeBanner what="This theme is a practice suggestion." /> : null}
            </div>
            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer font-semibold">Edit page text</summary>
              <div className="mt-3 flex flex-col gap-3">
                {([['headline', 'Headline'], ['subheadline', 'Subtitle'], ['intro', 'Introduction'], ['about', 'About text'], ['howToBuy', 'Ordering text'], ['contact', 'Contact text']] as const).map(([key, label]) => <label key={key} className="flex flex-col gap-1 text-sm font-semibold">{label}<textarea aria-label={label} className={INPUT} value={words[key]} maxLength={key === "headline" ? 80 : key === "subheadline" ? 160 : key === "about" ? 1500 : key === "contact" ? 600 : key === "intro" ? 800 : 1200} onChange={(event) => setWords((before) => ({ ...before, [key]: event.target.value }))} /></label>)}
                {wordsDirty ? <p className="text-sm text-muted">Text changes update the preview immediately. Save, then approve your words in step 3.</p> : null}
              </div>
            </details>
            {library.length ? <div className="flex flex-col gap-2">
              <label className={LABEL} htmlFor={`${uid}-hero`}>Header image</label>
              <select id={`${uid}-hero`} className={INPUT} value={design.heroImage?.versionId ?? ""} onChange={(event) => { const image = library.find((image) => image.versionId === event.target.value); change({ heroImage: image ? { photoId: image.photoId, versionId: image.versionId } : null, showHero: Boolean(image) }); }}>
                <option value="">No header image</option>{library.map((image) => <option key={image.versionId} value={image.versionId}>{image.title}</option>)}
              </select>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {design.heroImage ? <img src={library.find((image) => image.versionId === design.heroImage?.versionId)?.src} alt="Selected header image" className="aspect-video w-full rounded-lg object-cover" /> : null}
              <p className="text-xs text-muted">Brand images, uploads and product photos from your library.</p>
            </div> : null}
            <div className="flex flex-col gap-2.5">
              <p id={`${uid}-look`} className={LABEL}>
                Look
              </p>
              <div role="group" aria-labelledby={`${uid}-look`} className="grid gap-2">
                {SITE_STYLES.map((style) => (
                  <PickTile
                    key={style}
                    pressed={design.style === style}
                    onClick={() => change({ style, theme: undefined })}
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
                      onClick={() => change({ color: color.hex.toLowerCase(), ...(design.theme ? { theme: { ...design.theme, accent: color.hex.toLowerCase() } } : {}) })}
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
                  onChange={(event) => change({ color: event.target.value.toLowerCase(), ...(design.theme ? { theme: { ...design.theme, accent: event.target.value.toLowerCase() } } : {}) })}
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
              {products
                .map((product) => (
                  <Check
                    key={product.id}
                    label={`${product.name} (from your products)`}
                    checked={!design.hiddenProducts.includes(product.id)}
                    onChange={(on) =>
                      change({ hiddenProducts: on ? design.hiddenProducts.filter((each) => each !== product.id) : [...design.hiddenProducts, product.id] })
                    }
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
                  Your saved products supply the names, descriptions, photos and prices. Use the controls below to change how they appear on this site.
                </p>
                <Link href="/products" className={TEXT_LINK}>Edit products and descriptions →</Link>
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
                      {!draft.price.trim() && productPrice(products, offering.name) != null ? (
                        <p className="text-sm text-muted">Shows {dollars(productPrice(products, offering.name) ?? 0)} from your products. Type a price to change it here.</p>
                      ) : null}
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
                            <option value="">Use product photo</option><option value="none">No photo</option>
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
                <button type="button" data-writes disabled={pending || !dirty} onClick={save} className={PRIMARY}>
                  <Icon name="check" size="sm" />
                  {status === "saving" ? "Saving…" : "Save design"}
                </button>
                <button
                  type="button"
                  disabled={pending || !dirty}
                  onClick={() => {
                    setDesign(saved);
                    setWords(props.copy);
                    setDrafts(draftsFrom(withProducts(props.copy, products, saved).design, savedCopy));
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
              <button type="button" onClick={() => setFullPreview(true)} className={SECONDARY}><Icon name="monitor" size="sm" />View full-screen preview <span aria-hidden="true">↗</span></button>
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

      <section aria-labelledby="step-finish" className="flex flex-col gap-4">
        <SectionHead
          id="step-finish"
          number={props.stepNumber + 1}
          title="Finish your site"
          lead="Check your site is ready. Your preview stays private until hosting is connected."
        />
        <Card bodyClassName="gap-4">
          <FinishControls finish={finish} dirty={dirty} pending={pending} finishing={status === "finishing"} error={error?.at === "finish" ? error.message : null} onFinish={finishNow} />
        </Card>
        {props.after}
      </section>
    </>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <PickOption type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} label={label} layout="word" />;
}

function FinishControls({
  finish,
  dirty,
  pending,
  finishing,
  error,
  onFinish,
}: {
  finish: FinishPanel;
  dirty: boolean;
  pending: boolean;
  finishing: boolean;
  error: string | null;
  onFinish: () => void;
}) {
  const blocked = finish.blockers.length > 0;
  const { finished } = finish;
  return (
    <div className="flex flex-col gap-4">
      {finished ? (
        <div role="status" className="flex flex-col gap-1.5 rounded-xl border border-accent-ring bg-accent-tint px-4 py-3.5 text-accent-ink">
          <p className="flex items-start gap-2.5 font-semibold">
            <Icon name="check" size="sm" className="mt-1" strokeWidth={2.4} />
            <span>Your site is ready. Not published online.</span>
          </p>
          <p className="text-sm">
            Finished <LocalDate iso={finished.at} />. This step counts as done.
            {finished.upToDate ? "" : " You’ve changed your site since; finish again to check the new version."}
          </p>
        </div>
      ) : null}

      {blocked ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-check-ring bg-check-tint px-4 py-3 text-check">
          <p className="flex items-center gap-2 font-bold">
            <Icon name="info" size="sm" />
            Before you can finish
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {finish.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : (
        <Done>Everything SnapStart checks is ready.</Done>
      )}
      {finish.notes.length ? (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-rule">
          {finish.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className={ALERT}>
          {error}
        </p>
      ) : null}
      {dirty ? <p className="text-sm text-check">Save your design changes first, so you finish what you see.</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" data-writes disabled={blocked || dirty || pending || Boolean(finished?.upToDate)} onClick={onFinish} className={PRIMARY}>
          <Icon name="flag" size="sm" />
          {finishing ? "Finishing…" : finished ? "Check again" : "Finish my site"}
        </button>
      </div>
      <p role="status" className="sr-only">
        {finishing ? "Checking your site." : ""}
      </p>
    </div>
  );
}
