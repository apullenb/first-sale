"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { deleteProductAction, describeItemAction, saveProductAction } from "@/app/(app)/products/actions";
import { ActionButton } from "@/components/action-button";
import { Icon } from "@/components/icons";
import { ALERT, DANGER, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { Chip } from "@/components/ui";
import {
  dollars,
  formOf,
  type ItemKind,
  marginOf,
  OPTION_LIMITS,
  optionsSummary,
  priceLabel,
  PRODUCT_LIMITS,
  type ProductForm,
  type ProductPhotoRef,
  type ProductValues,
  tracksVariantStock,
  variantLabel,
  variantRows,
  type VariantForm,
} from "@/lib/rules/products";
import { ItemPictures } from "./item-pictures";
import type { PictureView, Wearer } from "@/lib/rules/picture-views";

export interface PhotoChoice {
  key: string;
  ref: ProductPhotoRef;
  title: string;
  // Where it came from, such as "Approved edit"
  detail: string;
  src: string;
  practice: boolean;
}

export interface ListedProduct extends ProductValues {
  id: string;
  wearer?: Wearer | null;
}

export interface ItemPicture {
  id: string;
  productId: string;
  view: PictureView;
  change: string | null;
  simulated: boolean;
  approved: boolean;
  src: string;
}

export const photoKey = (ref: ProductPhotoRef | null) =>
  !ref
    ? ""
    : ref.source === "library"
      ? `library:${ref.fileId}`
      : ref.source === "version"
        ? `version:${ref.versionId}`
        : ref.source === "generated"
          ? `generated:${ref.pictureId}`
          : `original:${ref.photoId}`;

const OFFLINE = "Couldn’t reach SnapStart. Check your connection and try again.";
const empty = (kind: ItemKind): ProductForm => ({ kind, name: "", description: "", price: "", unitCost: "", quantity: "", duration: "", location: "", included: "", groups: [], variants: [], photo: null });
const NOUN: Record<ItemKind, { one: string; many: string; Title: string }> = {
  product: { one: "product", many: "products", Title: "Product" },
  service: { one: "service", many: "services", Title: "Service" },
};

// The owner's products or services: add, change, confirm and remove them. Prices are only what the owner types.
export function ProductList({
  kind,
  products,
  choices,
  pictures,
  changeLimit,
  total,
}: {
  kind: ItemKind;
  products: ListedProduct[];
  choices: PhotoChoice[];
  pictures: ItemPicture[];
  changeLimit: number;
  // Products and services together, for the limit
  total: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  // With nothing listed yet, the form is always open
  const [adding, setAdding] = useState(false);
  const byKey = new Map(choices.map((choice) => [choice.key, choice]));
  const noun = NOUN[kind];

  return (
    <div className="@container flex flex-col gap-4">
      {products.length ? (
        <ul className="flex flex-col gap-3" aria-label={`Your ${noun.many}`}>
          {products.map((product) => (
            <li key={product.id}>
              {editing === product.id ? (
                <ProductEditor
                  key={product.id}
                  id={product.id}
                  suggested={product.status === "suggested"}
                  initial={{ ...formOf(product), photo: byKey.has(photoKey(product.photo)) ? product.photo : null }}
                  choices={choices}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <ProductRow
                  product={product}
                  photo={byKey.get(photoKey(product.photo)) ?? null}
                  missingPhoto={product.photo !== null && !byKey.has(photoKey(product.photo))}
                  pictures={pictures.filter((picture) => picture.productId === product.id)}
                  changeLimit={changeLimit}
                  onEdit={() => setEditing(product.id)}
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {adding || products.length === 0 ? (
        total < PRODUCT_LIMITS.products ? (
          <ProductEditor id={null} suggested={false} initial={empty(kind)} choices={choices} onDone={() => setAdding(false)} canCancel={products.length > 0} />
        ) : null
      ) : total < PRODUCT_LIMITS.products ? (
        <button type="button" onClick={() => setAdding(true)} className={`${PRIMARY} w-fit`}>
          <Icon name="plus" size="sm" />
          Add a {noun.one}
        </button>
      ) : null}
      {total >= PRODUCT_LIMITS.products ? <p className="text-muted">You’ve added as many items as SnapStart keeps ({PRODUCT_LIMITS.products}).</p> : null}
    </div>
  );
}

function ProductRow({
  product,
  photo,
  missingPhoto,
  pictures,
  changeLimit,
  onEdit,
}: {
  product: ListedProduct;
  photo: PhotoChoice | null;
  missingPhoto: boolean;
  pictures: ItemPicture[];
  changeLimit: number;
  onEdit: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPictures, setShowPictures] = useState(false);
  useLayoutEffect(() => () => setError(null), []);
  const service = product.kind === "service";
  const suggested = product.status === "suggested";
  const price = priceLabel(product);
  const margin = !service && product.priceCents !== null && !product.options.variants.length ? marginOf(product.priceCents, product.unitCostCents) : null;
  const options = optionsSummary(product.options);
  const priced = product.options.variants.filter((variant) => variant.priceCents !== null || variant.quantity !== null);

  async function remove() {
    if (!window.confirm(`Remove “${product.name}”?`)) return;
    setPending(true);
    setError(null);
    try {
      const result = await deleteProductAction(product.id);
      if (!result.ok) setError(result.message);
    } catch {
      setError(OFFLINE);
    } finally {
      setPending(false);
    }
  }

  return (
    <article aria-label={product.name} className={`flex flex-col gap-4 rounded-[14px] border bg-surface p-4 shadow-card ${suggested ? "border-dashed border-ai/40" : "border-line"}`}>
      <div className="flex flex-col gap-4 @lg:flex-row">
        <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-soft">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.src} alt={`Photo of ${product.name}`} className="size-full object-cover" />
          ) : (
            <Icon name="image" size="lg" className="text-faint" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {suggested ? (
            <div className="flex flex-wrap gap-2">
              <Chip icon="sparkles" tone="ai">
                Suggested
              </Chip>
              <span className="self-center text-sm text-muted">Not used anywhere until you confirm it.</span>
            </div>
          ) : null}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-display text-[20px] leading-snug break-words">{product.name}</h3>
            {price ? <p className="text-lg font-bold">{price}</p> : <p className="text-sm text-muted">No price yet</p>}
          </div>
          {product.description ? <p className="text-rule">{product.description}</p> : null}
          {product.descriptionBy === "practice" ? (
            <p className="text-sm text-check">Practice draft, not written by AI. Write your own description.</p>
          ) : product.descriptionBy === "ai" ? (
            <p className="text-sm text-muted">Description drafted by AI. Check it says only what’s true.</p>
          ) : null}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {service && product.duration ? <li>Takes {product.duration}</li> : null}
            {service && product.location ? <li>Where: {product.location}</li> : null}
            {service && product.included ? <li>Includes: {product.included}</li> : null}
            {options ? <li>{options}</li> : null}
            {margin ? (
              <li>
                Costs you {dollars(product.unitCostCents ?? 0)}, so {margin.cents >= 0 ? `${dollars(margin.cents)} is left` : `you lose ${dollars(-margin.cents)}`} from each sale
                {margin.percent !== null && margin.cents >= 0 ? ` (${margin.percent}%)` : ""}
              </li>
            ) : null}
            {service ? null : <li>{product.quantity === null ? "Stock not tracked" : `${product.quantity} in stock`}</li>}
            {missingPhoto ? <li className="text-check">Its photo is no longer available. Pick another one.</li> : null}
            {photo?.practice ? <li className="text-check">Its photo is a practice preview.</li> : null}
          </ul>
          {priced.length ? (
            <ul aria-label={`Options for ${product.name}`} className="flex flex-wrap gap-2 text-sm">
              {priced.map((variant) => (
                <li key={variantLabel(variant.values)} className="rounded-lg border border-line bg-soft px-2.5 py-1">
                  {variantLabel(variant.values)}
                  {variant.priceCents !== null ? ` · ${dollars(variant.priceCents)}` : ""}
                  {variant.quantity !== null ? ` · ${variant.quantity} in stock` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-1 flex flex-wrap items-start gap-2">
            <button type="button" onClick={onEdit} className={SECONDARY}>
              <Icon name={suggested ? "check" : "pencil"} size="sm" />
              {suggested ? "Review and confirm" : "Edit"}
              <span className="sr-only"> {product.name}</span>
            </button>
            <button type="button" onClick={() => setShowPictures((open) => !open)} aria-expanded={showPictures} className={SECONDARY}>
              <Icon name="image" size="sm" />
              Pictures<span className="sr-only"> of {product.name}</span>
            </button>
            <button type="button" onClick={remove} disabled={pending} className={DANGER}>
              <Icon name="trash" size="sm" />
              {pending ? "Removing…" : "Remove"}
              <span className="sr-only"> {product.name}</span>
            </button>
          </div>
          <ActionButton
            action={() => describeItemAction(product.id)}
            label={product.description ? `Write a new description for ${product.name}` : `Draft a description for ${product.name}`}
            pendingLabel="Writing…"
            pendingStatus="Drafting a short description."
            ai
          />
          {error ? (
            <p role="alert" className={ALERT}>
              {error}
            </p>
          ) : null}
        </div>
      </div>
      {showPictures ? <ItemPictures item={product} pictures={pictures} inUse={product.photo?.source === "generated" ? product.photo.pictureId : null} changeLimit={changeLimit} hasOwnPhoto={product.photo?.source === "original" || product.photo?.source === "version"} /> : null}
    </article>
  );
}

function ProductEditor({
  id,
  suggested,
  initial,
  choices,
  onDone,
  canCancel = true,
}: {
  id: string | null;
  suggested: boolean;
  initial: ProductForm;
  choices: PhotoChoice[];
  onDone: () => void;
  canCancel?: boolean;
}) {
  const uid = useId();
  const [form, setForm] = useState<ProductForm>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => () => setError(null), []);
  useEffect(() => {
    if (id) heading.current?.focus();
  }, [id]);
  const service = form.kind === "service";
  const noun = NOUN[form.kind];

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const selected = photoKey(form.photo);

  async function save(confirm: boolean) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await saveProductAction({ id, confirm, ...form });
      if (!result.ok) return setError({ message: result.message, field: result.field });
      if (!id) setForm(empty(form.kind));
      onDone();
    } catch {
      setError({ message: OFFLINE });
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(true);
  }

  const invalid = (field: keyof ProductForm) => (error?.field === field ? { "aria-invalid": true, "aria-describedby": `${uid}-error` } : {});
  const field = (
    key: "name" | "price" | "unitCost" | "quantity" | "duration" | "location",
    label: string,
    help: string | null,
    props: { inputMode?: "decimal" | "numeric"; prefix?: string; optional?: boolean; maxLength: number },
  ) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${uid}-${key}`} className="font-semibold">
        {label} {props.optional ? <span className="font-normal text-muted">(optional)</span> : null}
      </label>
      <div className="relative">
        {props.prefix ? <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">{props.prefix}</span> : null}
        <input
          id={`${uid}-${key}`}
          value={form[key]}
          onChange={(event) => set(key, event.target.value)}
          inputMode={props.inputMode}
          maxLength={props.maxLength}
          className={`${INPUT} ${props.prefix ? "pl-7" : ""}`}
          {...(help ? { "aria-describedby": `${uid}-${key}-help` } : {})}
          {...invalid(key)}
        />
      </div>
      {help ? (
        <p id={`${uid}-${key}-help`} className="text-sm text-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
  const variantStock = tracksVariantStock({ groups: form.groups, variants: form.variants.map((row) => ({ values: row.values, priceCents: null, quantity: row.quantity.trim() ? 0 : null })) });

  return (
    <section aria-labelledby={`${uid}-heading`} className="rounded-[14px] border border-accent-ring bg-surface p-5 shadow-card">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h3 id={`${uid}-heading`} ref={heading} tabIndex={-1} className="font-display text-[22px] leading-snug outline-none">
          {id ? (suggested ? `Review ${initial.name}` : `Edit ${initial.name}`) : `Add a ${noun.one}`}
        </h3>
        {suggested ? <p className="text-rule">Check the name and description, add your price, then confirm. Until then it isn’t used on your website or in your marketing.</p> : null}
        {field("name", "Name", null, { maxLength: PRODUCT_LIMITS.name })}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${uid}-description`} className="font-semibold">
            Short description <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id={`${uid}-description`}
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            maxLength={PRODUCT_LIMITS.description}
            rows={2}
            className={INPUT}
          />
        </div>
        {service ? (
          <>
            <div className="grid gap-4 @md:grid-cols-2">
              {field("price", "How you price it", "As you’d say it, such as $40 an hour, $120 a visit or From $75.", { optional: true, maxLength: PRODUCT_LIMITS.priceText })}
              {field("duration", "How long it takes", "Such as 1 hour or about 2 days.", { optional: true, maxLength: PRODUCT_LIMITS.detail })}
            </div>
            {field("location", "Where it happens", "Such as at your home, at my studio or online.", { optional: true, maxLength: PRODUCT_LIMITS.detail })}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-included`} className="font-semibold">
                What’s included <span className="font-normal text-muted">(optional)</span>
              </label>
              <textarea id={`${uid}-included`} value={form.included} onChange={(event) => set("included", event.target.value)} maxLength={PRODUCT_LIMITS.included} rows={2} className={INPUT} />
            </div>
          </>
        ) : (
          <div className="grid gap-4 @md:grid-cols-3">
            {field("price", "Price", form.variants.length ? "What customers pay. Options can have their own price." : "What customers pay.", { inputMode: "decimal", prefix: "$", maxLength: 14 })}
            {field("unitCost", "What one costs you", "Materials and packaging.", { inputMode: "decimal", prefix: "$", optional: true, maxLength: 14 })}
            {variantStock ? (
              <p className="self-center text-sm text-muted">Stock is added up from the options below.</p>
            ) : (
              field("quantity", "How many you have", "Leave empty if you don’t count stock.", { inputMode: "numeric", optional: true, maxLength: 9 })
            )}
          </div>
        )}

        <OptionsEditor uid={uid} kind={form.kind} groups={form.groups} variants={form.variants} invalid={error?.field === "groups" || error?.field === "variants"} errorId={`${uid}-error`} onChange={(groups, variants) => setForm((current) => ({ ...current, groups, variants }))} />

        <fieldset className="flex flex-col gap-2" {...(error?.field === "photo" ? { "aria-describedby": `${uid}-error` } : {})}>
          <legend className="mb-1 font-semibold">
            Photo <span className="font-normal text-muted">(optional)</span>
          </legend>
          {choices.length ? (
            <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-line bg-soft p-2 @md:grid-cols-4">
              <PhotoOption name={`${uid}-photo`} checked={selected === ""} onChange={() => set("photo", null)} label="No photo">
                <span className="grid aspect-square w-full place-items-center rounded-lg bg-surface text-faint">
                  <Icon name="close" />
                </span>
              </PhotoOption>
              {choices.map((choice) => (
                <PhotoOption key={choice.key} name={`${uid}-photo`} checked={selected === choice.key} onChange={() => set("photo", choice.ref)} label={choice.title} detail={choice.detail}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={choice.src} alt="" loading="lazy" className="aspect-square w-full rounded-lg bg-surface object-cover" />
                </PhotoOption>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No photos yet. Upload one below, make a picture from the description once it’s saved, or add pictures to your Brand Library.</p>
          )}
        </fieldset>

        {error ? (
          <p id={`${uid}-error`} role="alert" className={ALERT}>
            {error.message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={PRIMARY}>
            <Icon name="check" size="sm" />
            {pending ? "Saving…" : !id ? `Add ${noun.one}` : suggested ? "Confirm" : "Save changes"}
          </button>
          {suggested ? (
            <button type="button" disabled={pending} onClick={() => void save(false)} className={SECONDARY}>
              Save as a suggestion
            </button>
          ) : null}
          {canCancel ? (
            <button type="button" onClick={onDone} className={SECONDARY}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

const parseChoices = (text: string) => {
  const seen = new Set<string>();
  return text
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && !seen.has(value.toLowerCase()) && seen.add(value.toLowerCase()));
};

const OPTION_EXAMPLES: Record<ItemKind, string> = { product: "Size, Color, Scent or Flavor", service: "Package, Size, Session length or Add-on" };

// Option groups and the price and stock of each combination; totals are worked out by rules on save
function OptionsEditor({
  uid,
  kind,
  groups,
  variants,
  invalid,
  errorId,
  onChange,
}: {
  uid: string;
  kind: ItemKind;
  groups: ProductForm["groups"];
  variants: VariantForm[];
  invalid: boolean;
  errorId: string;
  onChange: (groups: ProductForm["groups"], variants: VariantForm[]) => void;
}) {
  // What the owner typed, commas and all
  const [texts, setTexts] = useState<string[]>(() => groups.map((group) => group.values.join(", ")));
  const blank = (values: string[]): VariantForm => ({ values, price: "", quantity: "" });
  const update = (next: ProductForm["groups"], nextTexts: string[]) => {
    setTexts(nextTexts);
    const named = next.filter((group) => group.name.trim() && group.values.length);
    onChange(next, named.length === next.length ? variantRows(next, variants, blank) : variantRows(named, variants, blank));
  };
  const setVariant = (index: number, key: "price" | "quantity", value: string) => onChange(groups, variants.map((row, at) => (at === index ? { ...row, [key]: value } : row)));

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-4" {...(invalid ? { "aria-describedby": errorId } : {})}>
      <legend className="px-1 font-semibold">
        Options <span className="font-normal text-muted">(optional)</span>
      </legend>
      <p className="text-sm text-muted">
        Such as {OPTION_EXAMPLES[kind]}. Each choice can have its own price{kind === "product" ? " and stock" : ""}.
      </p>
      {groups.map((group, index) => (
        <div key={index} className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] @md:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-group-${index}`} className="text-sm font-semibold">
              Option {index + 1} name
            </label>
            <input
              id={`${uid}-group-${index}`}
              value={group.name}
              maxLength={OPTION_LIMITS.label}
              placeholder={kind === "product" ? "Size" : "Package"}
              onChange={(event) => update(groups.map((each, at) => (at === index ? { ...each, name: event.target.value } : each)), texts)}
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-values-${index}`} className="text-sm font-semibold">
              Option {index + 1} choices, separated by commas
            </label>
            <input
              id={`${uid}-values-${index}`}
              value={texts[index] ?? ""}
              placeholder={kind === "product" ? "Small, Medium, Large" : "Basic, Full, Deluxe"}
              onChange={(event) =>
                update(
                  groups.map((each, at) => (at === index ? { ...each, values: parseChoices(event.target.value) } : each)),
                  texts.map((text, at) => (at === index ? event.target.value : text)),
                )
              }
              className={INPUT}
            />
          </div>
          <button
            type="button"
            onClick={() =>
              update(
                groups.filter((_, at) => at !== index),
                texts.filter((_, at) => at !== index),
              )
            }
            className={SECONDARY}
          >
            <Icon name="trash" size="sm" />
            Remove<span className="sr-only"> option {index + 1}</span>
          </button>
        </div>
      ))}
      {groups.length < OPTION_LIMITS.groups ? (
        <button type="button" onClick={() => update([...groups, { name: "", values: [] }], [...texts, ""])} className={`${SECONDARY} w-fit`}>
          <Icon name="plus" size="sm" />
          Add an option
        </button>
      ) : null}
      {variants.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Each combination {variants.length > 1 ? `(${variants.length})` : ""}</p>
          <p className="text-sm text-muted">Leave a price empty to use the main price{kind === "product" ? ", and stock empty if you don’t count it" : ""}.</p>
          <ul className="flex flex-col gap-2">
            {variants.map((row, index) => (
              <li key={variantLabel(row.values)} className="grid items-center gap-2 rounded-lg bg-soft p-2 @md:grid-cols-[minmax(0,1fr)_10rem_8rem]">
                <span className="font-semibold break-words">{variantLabel(row.values)}</span>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">$</span>
                  <input
                    aria-label={`Price for ${variantLabel(row.values)}`}
                    value={row.price}
                    inputMode="decimal"
                    maxLength={14}
                    onChange={(event) => setVariant(index, "price", event.target.value)}
                    className={`${INPUT} pl-7`}
                  />
                </div>
                {kind === "product" ? (
                  <input
                    aria-label={`Stock for ${variantLabel(row.values)}`}
                    value={row.quantity}
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="Stock"
                    onChange={(event) => setVariant(index, "quantity", event.target.value)}
                    className={INPUT}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </fieldset>
  );
}

function PhotoOption({ name, checked, onChange, label, detail, children }: { name: string; checked: boolean; onChange: () => void; label: string; detail?: string; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-line bg-surface p-1.5 text-sm shadow-soft has-checked:border-accent has-checked:shadow-[0_0_0_3px_var(--color-accent-tint)] has-focus-visible:outline-2 has-focus-visible:outline-accent">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
      <span className="line-clamp-2 font-semibold break-words">{label}</span>
      {detail ? <span className="text-muted">{detail}</span> : null}
    </label>
  );
}
