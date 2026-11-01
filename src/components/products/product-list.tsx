"use client";

import { type FormEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { deleteProductAction, saveProductAction } from "@/app/(app)/products/actions";
import { Icon } from "@/components/icons";
import { ALERT, DANGER, INPUT, PRIMARY, SECONDARY } from "@/components/styles";
import { dollars, formOf, marginOf, PRODUCT_LIMITS, type ProductForm, type ProductPhotoRef, type ProductValues } from "@/lib/rules/products";

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
}

export const photoKey = (ref: ProductPhotoRef | null) =>
  !ref ? "" : ref.source === "library" ? `library:${ref.fileId}` : ref.source === "version" ? `version:${ref.versionId}` : `original:${ref.photoId}`;

const OFFLINE = "Couldn’t reach SnapStart. Check your connection and try again.";
const EMPTY: ProductForm = { name: "", description: "", price: "", unitCost: "", quantity: "", photo: null };

// The owner's products: add, change and remove them. Prices are only what the owner types.
export function ProductList({ products, choices }: { products: ListedProduct[]; choices: PhotoChoice[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  // With no products yet, the form is always open
  const [adding, setAdding] = useState(false);
  const byKey = new Map(choices.map((choice) => [choice.key, choice]));

  return (
    <div className="@container flex flex-col gap-4">
      {products.length ? (
        <ul className="flex flex-col gap-3" aria-label="Your products">
          {products.map((product) => (
            <li key={product.id}>
              {editing === product.id ? (
                <ProductEditor
                  key={product.id}
                  id={product.id}
                  initial={{ ...formOf(product), photo: byKey.has(photoKey(product.photo)) ? product.photo : null }}
                  choices={choices}
                  onDone={() => setEditing(null)}
                />
              ) : (
                <ProductRow product={product} photo={byKey.get(photoKey(product.photo)) ?? null} missingPhoto={product.photo !== null && !byKey.has(photoKey(product.photo))} onEdit={() => setEditing(product.id)} />
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {adding || products.length === 0 ? (
        <ProductEditor id={null} initial={EMPTY} choices={choices} onDone={() => setAdding(false)} canCancel={products.length > 0} />
      ) : products.length < PRODUCT_LIMITS.products ? (
        <button type="button" onClick={() => setAdding(true)} className={`${PRIMARY} w-fit`}>
          <Icon name="plus" size="sm" />
          Add a product
        </button>
      ) : (
        <p className="text-muted">You’ve added as many products as SnapStart keeps ({PRODUCT_LIMITS.products}).</p>
      )}
    </div>
  );
}

function ProductRow({ product, photo, missingPhoto, onEdit }: { product: ListedProduct; photo: PhotoChoice | null; missingPhoto: boolean; onEdit: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useLayoutEffect(() => () => setError(null), []);
  const margin = marginOf(product.priceCents, product.unitCostCents);

  async function remove() {
    if (!window.confirm(`Remove “${product.name}” from your products?`)) return;
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
    <article aria-label={product.name} className="flex flex-col gap-4 rounded-[14px] border border-line bg-surface p-4 shadow-card @lg:flex-row">
      <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-soft">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.src} alt={`Photo of ${product.name}`} className="size-full object-cover" />
        ) : (
          <Icon name="image" size="lg" className="text-faint" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="font-display text-[20px] leading-snug break-words">{product.name}</h3>
          <p className="text-lg font-bold">{dollars(product.priceCents)}</p>
        </div>
        {product.description ? <p className="text-rule">{product.description}</p> : null}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {margin ? (
            <li className="flex flex-wrap items-center gap-1.5">
              Costs you {dollars(product.unitCostCents ?? 0)}, so {margin.cents >= 0 ? `${dollars(margin.cents)} is left` : `you lose ${dollars(-margin.cents)}`} from each sale
              {margin.percent !== null && margin.cents >= 0 ? ` (${margin.percent}%)` : ""}
            </li>
          ) : null}
          <li>{product.quantity === null ? "Stock not tracked" : `${product.quantity} in stock`}</li>
          {missingPhoto ? <li className="text-check">Its photo is no longer available. Pick another one.</li> : null}
          {photo?.practice ? <li className="text-check">Its photo is a practice preview.</li> : null}
        </ul>
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" onClick={onEdit} className={SECONDARY}>
            <Icon name="pencil" size="sm" />
            Edit<span className="sr-only"> {product.name}</span>
          </button>
          <button type="button" onClick={remove} disabled={pending} className={DANGER}>
            <Icon name="trash" size="sm" />
            {pending ? "Removing…" : "Remove"}
            <span className="sr-only"> {product.name}</span>
          </button>
        </div>
        {error ? (
          <p role="alert" className={ALERT}>
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function ProductEditor({ id, initial, choices, onDone, canCancel = true }: { id: string | null; initial: ProductForm; choices: PhotoChoice[]; onDone: () => void; canCancel?: boolean }) {
  const uid = useId();
  const [form, setForm] = useState<ProductForm>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => () => setError(null), []);
  useEffect(() => {
    if (id) heading.current?.focus();
  }, [id]);

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm((current) => ({ ...current, [key]: value }));
  const selected = photoKey(form.photo);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await saveProductAction({ id, ...form });
      if (!result.ok) return setError({ message: result.message, field: result.field });
      if (!id) setForm(EMPTY);
      onDone();
    } catch {
      setError({ message: OFFLINE });
    } finally {
      setPending(false);
    }
  }

  const invalid = (field: keyof ProductForm) => (error?.field === field ? { "aria-invalid": true, "aria-describedby": `${uid}-error` } : {});
  const field = (key: "name" | "price" | "unitCost" | "quantity", label: string, help: string | null, props: { inputMode?: "decimal" | "numeric"; prefix?: string; optional?: boolean; maxLength: number }) => (
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
          {...invalid(key)}
        />
      </div>
      {help ? <p className="text-sm text-muted">{help}</p> : null}
    </div>
  );

  return (
    <section aria-labelledby={`${uid}-heading`} className="rounded-[14px] border border-accent-ring bg-surface p-5 shadow-card">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h3 id={`${uid}-heading`} ref={heading} tabIndex={-1} className="font-display text-[22px] leading-snug outline-none">
          {id ? `Edit ${initial.name}` : "Add a product"}
        </h3>
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
        <div className="grid gap-4 @md:grid-cols-3">
          {field("price", "Price", "What customers pay.", { inputMode: "decimal", prefix: "$", maxLength: 14 })}
          {field("unitCost", "What one costs you", "Materials and packaging.", { inputMode: "decimal", prefix: "$", optional: true, maxLength: 14 })}
          {field("quantity", "How many you have", "Leave empty if you don’t count stock.", { inputMode: "numeric", optional: true, maxLength: 9 })}
        </div>

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
            <p className="text-sm text-muted">No photos yet. Make store photos on the Product photos page, or add pictures to your Brand Library, and they’ll show here.</p>
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
            {pending ? "Saving…" : id ? "Save changes" : "Add product"}
          </button>
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
